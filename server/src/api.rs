//! The accounts API (ADR 0007): sign up, log in, log out, who am I, recover.
//! Answers are JSON (`ApiMe` or `ApiError`); a session is an HttpOnly cookie.
use crate::auth;
use crate::http::{AppState, client_ip, origin_ok};
use crate::protocol::{ApiError, ApiErrorCode, ApiMe, LogInRequest, Look, RecoverRequest, SignUpRequest};
use crate::store::{self, UserRow};
use crate::time::now_ms;
use axum::Json;
use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use std::net::SocketAddr;

const AVATARS: u8 = 4;
const COLOURS: u8 = 6;

pub struct Failure(StatusCode, ApiErrorCode, &'static str);

impl IntoResponse for Failure {
    fn into_response(self) -> Response {
        (
            self.0,
            Json(ApiError {
                error: self.1,
                detail: self.2.to_string(),
            }),
        )
            .into_response()
    }
}

type Answer = Result<Response, Failure>;

fn server_error() -> Failure {
    Failure(
        StatusCode::INTERNAL_SERVER_ERROR,
        ApiErrorCode::Server,
        "Something went wrong in the café. Try again.",
    )
}

fn server<E: std::fmt::Display>(e: E) -> Failure {
    tracing::error!(target: "api", error = %e, "request failed");
    server_error()
}

fn bad_input(detail: &'static str) -> Failure {
    Failure(StatusCode::BAD_REQUEST, ApiErrorCode::BadInput, detail)
}

/// An account action's refusal gets one line, with its code (crit 10), but
/// never the name typed, since a password sometimes lands in the name field.
/// A server error has its own line already.
fn logged(what: &'static str, answer: Answer) -> Answer {
    if let Err(Failure(_, code, _)) = &answer
        && *code != ApiErrorCode::Server
    {
        let code = serde_json::to_value(code).ok().and_then(|v| v.as_str().map(str::to_string));
        tracing::info!(target: "action", what, outcome = "refused", code);
    }
    answer
}

fn me_of(user: &UserRow) -> ApiMe {
    ApiMe {
        id: user.id as u32,
        name: user.name.clone(),
        look: Look {
            avatar: user.avatar,
            colour: user.colour,
        },
        recovery_code: None,
    }
}

/// The per-name bucket's key: the name, ignoring case, from one address, so
/// nobody elsewhere can use up someone's tries. None for a name too long to
/// exist, which must never sit in memory as a key.
fn name_key(name: &str, ip: &str) -> Option<String> {
    let chars = name.chars().count();
    (1..=20).contains(&chars).then(|| format!("{}|{ip}", name.to_lowercase()))
}

/// Origin check, then the per-address and per-name buckets.
fn guard(app: &AppState, headers: &HeaderMap, peer: SocketAddr, name: &str) -> Result<(), Failure> {
    if !origin_ok(headers) {
        return Err(Failure(
            StatusCode::FORBIDDEN,
            ApiErrorCode::Forbidden,
            "Requests must come from the café's own pages.",
        ));
    }
    let ip = client_ip(headers, peer, app.config.behind_fly);
    let Some(key) = name_key(name, &ip) else {
        return Err(bad_input("Names are 3 to 20 letters, digits, _ or -."));
    };
    let now = now_ms();
    let mut limits = app.auth_limits.lock().expect("the limits lock isn't poisoned");
    let by_ip = limits.by_ip.take(&ip, now);
    let by_name = limits.by_name.take(&key, now);
    if by_ip && by_name {
        Ok(())
    } else {
        Err(Failure(
            StatusCode::TOO_MANY_REQUESTS,
            ApiErrorCode::RateLimited,
            "Too many tries. Wait a minute and try again.",
        ))
    }
}

async fn hash(app: &AppState, secret: String) -> Result<String, Failure> {
    let _permit = app.hashing.acquire().await.map_err(server)?;
    tokio::task::spawn_blocking(move || auth::hash_secret(&secret))
        .await
        .map_err(server)
}

async fn verify(app: &AppState, secret: String, hash: String) -> Result<bool, Failure> {
    let _permit = app.hashing.acquire().await.map_err(server)?;
    tokio::task::spawn_blocking(move || auth::verify_secret(&secret, &hash))
        .await
        .map_err(server)
}

async fn start_session(app: &AppState, user_id: i64, me: ApiMe) -> Answer {
    let token = auth::new_session_token();
    let token_hash = auth::token_hash(&token);
    let max_age = app.tuning.session_days * 86_400;
    let now = now_ms();
    let expires = now + max_age * 1000;
    app.store
        .call(move |c| {
            store::purge_sessions(c, now)?;
            store::insert_session(c, &token_hash, user_id, expires)
        })
        .await
        .map_err(server)?;
    let cookie = HeaderValue::from_str(&auth::session_cookie(&token, max_age)).map_err(server)?;
    Ok(([(header::SET_COOKIE, cookie)], Json(me)).into_response())
}

fn session_token(headers: &HeaderMap) -> Option<String> {
    let cookies = headers.get(header::COOKIE)?.to_str().ok()?;
    auth::cookie_value(cookies, auth::SESSION_COOKIE).map(str::to_string)
}

/// The signed-in user, extending the session by another 30 days from now.
pub async fn current_user(app: &AppState, headers: &HeaderMap) -> Result<Option<UserRow>, Failure> {
    let Some(token) = session_token(headers) else { return Ok(None) };
    let token_hash = auth::token_hash(&token);
    let now = now_ms();
    let extend_to = now + app.tuning.session_days * 86_400_000;
    app.store
        .call(move |c| {
            let Some(user_id) = store::session_user(c, &token_hash, now)? else {
                return Ok(None);
            };
            store::extend_session(c, &token_hash, extend_to)?;
            store::user_by_id(c, user_id)
        })
        .await
        .map_err(server)
}

pub async fn signup(
    State(app): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<SignUpRequest>,
) -> Answer {
    logged("signup", signup_answer(app, peer, headers, req).await)
}

async fn signup_answer(app: AppState, peer: SocketAddr, headers: HeaderMap, req: SignUpRequest) -> Answer {
    guard(&app, &headers, peer, &req.name)?;
    if !auth::valid_username(&req.name) {
        return Err(bad_input("A name is 3 to 20 letters, digits, _ or -."));
    }
    if !auth::valid_password(&req.password) {
        return Err(bad_input("A password is 8 to 128 characters."));
    }
    if req.look.avatar >= AVATARS || req.look.colour >= COLOURS {
        return Err(bad_input("Pick one of the looks on offer."));
    }
    let code = auth::new_recovery_code();
    let password_hash = hash(&app, req.password.clone()).await?;
    let recovery_hash = hash(&app, auth::normalise_code(&code)).await?;
    let (name, look, now) = (req.name.clone(), req.look, now_ms());
    let id = app
        .store
        .call(move |c| store::insert_user(c, &name, &password_hash, &recovery_hash, look.avatar, look.colour, now))
        .await
        .map_err(server)?
        .ok_or(Failure(StatusCode::CONFLICT, ApiErrorCode::NameTaken, "That name is taken."))?;
    tracing::info!(target: "action", uid = id, who = %req.name, what = "signup");
    start_session(
        &app,
        id,
        ApiMe {
            id: id as u32,
            name: req.name,
            look: req.look,
            recovery_code: Some(code),
        },
    )
    .await
}

pub async fn login(
    State(app): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<LogInRequest>,
) -> Answer {
    logged("login", login_answer(app, peer, headers, req).await)
}

async fn login_answer(app: AppState, peer: SocketAddr, headers: HeaderMap, req: LogInRequest) -> Answer {
    guard(&app, &headers, peer, &req.name)?;
    let name = req.name.clone();
    let user = app.store.call(move |c| store::user_by_name(c, &name)).await.map_err(server)?;
    let refused = Failure(
        StatusCode::UNAUTHORIZED,
        ApiErrorCode::BadLogin,
        "That name and password don't match.",
    );
    let Some(user) = user else {
        // Spend the time a real check takes, so a missing name isn't quicker to find.
        let _ = hash(&app, req.password).await;
        return Err(refused);
    };
    if !verify(&app, req.password, user.password_hash.clone()).await? {
        return Err(refused);
    }
    tracing::info!(target: "action", uid = user.id, who = %user.name, what = "login");
    start_session(&app, user.id, me_of(&user)).await
}

pub async fn logout(State(app): State<AppState>, headers: HeaderMap) -> Answer {
    logged("logout", logout_answer(app, headers).await)
}

async fn logout_answer(app: AppState, headers: HeaderMap) -> Answer {
    if !origin_ok(&headers) {
        return Err(Failure(
            StatusCode::FORBIDDEN,
            ApiErrorCode::Forbidden,
            "Requests must come from the café's own pages.",
        ));
    }
    if let Some(user) = current_user(&app, &headers).await? {
        tracing::info!(target: "action", uid = user.id, who = %user.name, what = "logout");
    }
    if let Some(token) = session_token(&headers) {
        let token_hash = auth::token_hash(&token);
        app.store
            .call(move |c| store::delete_session(c, &token_hash))
            .await
            .map_err(server)?;
    }
    let clear = HeaderValue::from_str(&auth::session_cookie("", 0)).map_err(server)?;
    Ok((StatusCode::NO_CONTENT, [(header::SET_COOKIE, clear)]).into_response())
}

pub async fn me(State(app): State<AppState>, headers: HeaderMap) -> Answer {
    let Some(user) = current_user(&app, &headers).await? else {
        return Err(Failure(StatusCode::UNAUTHORIZED, ApiErrorCode::SignedOut, "You're not signed in."));
    };
    Ok(Json(me_of(&user)).into_response())
}

pub async fn recover(
    State(app): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<RecoverRequest>,
) -> Answer {
    logged("recover", recover_answer(app, peer, headers, req).await)
}

async fn recover_answer(app: AppState, peer: SocketAddr, headers: HeaderMap, req: RecoverRequest) -> Answer {
    guard(&app, &headers, peer, &req.name)?;
    if !auth::valid_password(&req.password) {
        return Err(bad_input("A password is 8 to 128 characters."));
    }
    let name = req.name.clone();
    let user = app.store.call(move |c| store::user_by_name(c, &name)).await.map_err(server)?;
    let refused = Failure(
        StatusCode::UNAUTHORIZED,
        ApiErrorCode::BadRecovery,
        "That name and recovery code don't match.",
    );
    let Some(user) = user else {
        let _ = hash(&app, req.code).await;
        return Err(refused);
    };
    if !verify(&app, auth::normalise_code(&req.code), user.recovery_hash.clone()).await? {
        return Err(refused);
    }
    let code = auth::new_recovery_code();
    let password_hash = hash(&app, req.password).await?;
    let recovery_hash = hash(&app, auth::normalise_code(&code)).await?;
    let user_id = user.id;
    app.store
        .call(move |c| {
            store::set_secrets(c, user_id, &password_hash, &recovery_hash)?;
            store::delete_sessions_for(c, user_id)
        })
        .await
        .map_err(server)?;
    tracing::info!(target: "action", uid = user_id, who = %user.name, what = "recover");
    let mut me = me_of(&user);
    me.recovery_code = Some(code);
    start_session(&app, user_id, me).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::extract::connect_info::MockConnectInfo;
    use axum::http::Request;
    use serde_json::json;
    use tower::ServiceExt;

    #[tokio::test]
    async fn account_refusals_say_why_but_not_who_and_a_logout_is_logged() {
        // Phase 3's review, finding 12.
        let dir = tempfile::tempdir().unwrap();
        let app = crate::http::tests::app(dir.path()).layer(MockConnectInfo(SocketAddr::from(([10, 0, 0, 9], 5000))));
        let sink = crate::test_logs::LogSink::default();
        let _logging = sink.capture();
        let send = |path: &str, body: serde_json::Value, cookie: Option<&str>| {
            let mut req = Request::post(path).header(header::CONTENT_TYPE, "application/json");
            if let Some(cookie) = cookie {
                req = req.header(header::COOKIE, cookie);
            }
            app.clone().oneshot(req.body(Body::from(body.to_string())).unwrap())
        };
        let look = json!({"avatar": 0, "colour": 0});
        let res = send(
            "/api/signup",
            json!({"name": "sam", "password": "correct horse", "look": look}),
            None,
        )
        .await
        .unwrap();
        assert!(res.status().is_success(), "{}", res.status());
        let cookie = res.headers()[header::SET_COOKIE]
            .to_str()
            .unwrap()
            .split(';')
            .next()
            .unwrap()
            .to_string();
        for (path, body) in [
            ("/api/signup", json!({"name": "sam", "password": "correct horse", "look": look})),
            ("/api/signup", json!({"name": "x", "password": "correct horse", "look": look})),
            ("/api/login", json!({"name": "sam", "password": "wrong horse battery"})),
            (
                "/api/recover",
                json!({"name": "nobody", "code": "abcd-efgh", "password": "correct horse"}),
            ),
        ] {
            assert!(send(path, body, None).await.unwrap().status().is_client_error());
        }
        assert!(send("/api/logout", json!({}), Some(&cookie)).await.unwrap().status().is_success());
        let lines = sink.lines();
        let refused: Vec<&serde_json::Value> = lines.iter().filter(|v| v["outcome"] == "refused").collect();
        let said: Vec<(&str, &str)> = refused
            .iter()
            .map(|v| (v["what"].as_str().unwrap_or("?"), v["code"].as_str().unwrap_or("?")))
            .collect();
        assert_eq!(
            said,
            [
                ("signup", "nameTaken"),
                ("signup", "badInput"),
                ("login", "badLogin"),
                ("recover", "badRecovery")
            ],
            "{lines:?}"
        );
        assert!(
            refused.iter().all(|v| v["who"].is_null() && !v.to_string().contains("horse")),
            "{refused:?}"
        );
        assert!(lines.iter().any(|v| v["what"] == "logout" && v["who"] == "sam"), "{lines:?}");
    }

    #[test]
    fn a_name_too_long_to_exist_is_never_a_limit_key() {
        // A 2 MB name must not become a bucket that sits in memory.
        assert_eq!(name_key(&"x".repeat(21), "10.0.0.1"), None);
        assert_eq!(name_key("", "10.0.0.1"), None);
        assert!(name_key(&"x".repeat(20), "10.0.0.1").is_some());
    }

    #[test]
    fn a_name_is_limited_per_address_so_nobody_else_can_lock_it() {
        assert_eq!(name_key("Sam", "10.0.0.1"), name_key("sam", "10.0.0.1"));
        assert_ne!(name_key("sam", "10.0.0.1"), name_key("sam", "10.0.0.2"));
    }
}
