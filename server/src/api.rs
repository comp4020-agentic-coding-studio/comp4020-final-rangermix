//! The accounts API (ADR 0007): sign up, log in, log out, who am I, recover.
//! Answers are JSON (`ApiMe` or `ApiError`); a session is an HttpOnly cookie.
use crate::auth;
use crate::http::{AppState, client_ip, origin_ok};
use crate::protocol::{ApiError, ApiErrorCode, ApiMe, CheckNameRequest, LogInRequest, Look, RecoverRequest, SignUpRequest};
use crate::store::{self, UserRow};
// Accounts keep Canberra's own clock, not the café's, which a demo account
// moves on: a jump must spend nobody's session (slice 17's review, finding 4).
use crate::time::canberra_now_ms as now_ms;
use axum::Json;
use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use std::net::SocketAddr;

pub const AVATARS: u8 = 4;
pub const COLOURS: u8 = 6;

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

/// How long a name a check found free stays paid for, for its sign-up.
const CHECKED_FOR_MS: u64 = 10 * 60_000;

/// What a guarded call is: a sign-up may have been paid for by its check.
#[derive(PartialEq)]
enum Guarded {
    Other,
    /// A sign-up: free once if a check just found its name free here.
    SignUp,
}

/// Origin check, then the per-address and per-name buckets.
fn guard(app: &AppState, headers: &HeaderMap, peer: SocketAddr, name: &str) -> Result<(), Failure> {
    guard_as(app, headers, peer, name, Guarded::Other).map(|_| ())
}

/// The guard, saying the key it charged, so a check that finds a name free
/// can note it paid for the sign-up after it.
fn guard_as(app: &AppState, headers: &HeaderMap, peer: SocketAddr, name: &str, what: Guarded) -> Result<String, Failure> {
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
    limits.checked.retain(|_, at| now.saturating_sub(*at) < CHECKED_FOR_MS);
    if what == Guarded::SignUp && limits.checked.remove(&key).is_some() {
        // Its check paid, a moment ago, from this address (slice 20's review, finding 4).
        return Ok(key);
    }
    let by_ip = limits.by_ip.take(&ip, now);
    let by_name = limits.by_name.take(&key, now);
    if by_ip && by_name {
        Ok(key)
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

/// A name sign-up would refuse before looking it up: badly formed, or one
/// of the café's own.
fn refused_name(name: &str) -> Option<Failure> {
    if !auth::valid_username(name) {
        return Some(bad_input("A name is 3 to 20 letters, digits, _ or -."));
    }
    if auth::reserved_username(name) {
        return Some(Failure(
            StatusCode::CONFLICT,
            ApiErrorCode::NameTaken,
            "That name is the café's own.",
        ));
    }
    None
}

fn name_taken() -> Failure {
    Failure(StatusCode::CONFLICT, ApiErrorCode::NameTaken, "That name is taken.")
}

/// Whether sign-up would take this name (slice 20): guarded and limited as
/// sign-up is, so it tells nobody more, or faster, than sign-up does. A free
/// name logs nothing, since no account acted.
pub async fn check_name(
    State(app): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<CheckNameRequest>,
) -> Answer {
    logged("check_name", check_name_answer(app, peer, headers, req).await)
}

async fn check_name_answer(app: AppState, peer: SocketAddr, headers: HeaderMap, req: CheckNameRequest) -> Answer {
    let key = guard_as(&app, &headers, peer, &req.name, Guarded::Other)?;
    if let Some(refused) = refused_name(&req.name) {
        return Err(refused);
    }
    let name = req.name;
    let user = app.store.call(move |c| store::user_by_name(c, &name)).await.map_err(server)?;
    match user {
        Some(_) => Err(name_taken()),
        None => {
            // Free: the sign-up after it has paid (slice 20's review, finding 4).
            let mut limits = app.auth_limits.lock().expect("the limits lock isn't poisoned");
            if limits.checked.len() < 10_000 {
                limits.checked.insert(key, now_ms());
            }
            Ok(StatusCode::NO_CONTENT.into_response())
        }
    }
}

async fn signup_answer(app: AppState, peer: SocketAddr, headers: HeaderMap, req: SignUpRequest) -> Answer {
    guard_as(&app, &headers, peer, &req.name, Guarded::SignUp)?;
    if let Some(refused) = refused_name(&req.name) {
        return Err(refused);
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
        .ok_or_else(name_taken)?;
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
    async fn the_cafes_own_names_cant_be_signed_up() {
        // Slice 17: `demo` and digits, and `bot_`, are the café's.
        let dir = tempfile::tempdir().unwrap();
        let app = crate::http::tests::app(dir.path()).layer(MockConnectInfo(SocketAddr::from(([10, 0, 0, 9], 5000))));
        for name in ["demo7", "Bot_7"] {
            let body = json!({"name": name, "password": "correct horse", "look": {"avatar": 0, "colour": 0}});
            let req = Request::post("/api/signup")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(body.to_string()))
                .unwrap();
            let res = app.clone().oneshot(req).await.unwrap();
            assert_eq!(res.status(), StatusCode::CONFLICT, "{name}");
        }
    }

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

    #[tokio::test]
    async fn a_name_check_answers_what_sign_up_would_guarded_and_limited_as_it_is() {
        // Slice 20: "I'm new" asks before it asks for a look.
        let dir = tempfile::tempdir().unwrap();
        let app = crate::http::tests::app(dir.path()).layer(MockConnectInfo(SocketAddr::from(([10, 0, 0, 9], 5000))));
        let sink = crate::test_logs::LogSink::default();
        let _logging = sink.capture();
        let send = |path: &str, body: serde_json::Value, origin: Option<&str>| {
            let mut req = Request::post(path)
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::HOST, "cafe.test");
            if let Some(origin) = origin {
                req = req.header(header::ORIGIN, origin);
            }
            app.clone().oneshot(req.body(Body::from(body.to_string())).unwrap())
        };
        let check = |name: &str| send("/api/check-name", json!({ "name": name }), Some("https://cafe.test"));
        let answer = |res: axum::response::Response| async move {
            let status = res.status();
            let body = axum::body::to_bytes(res.into_body(), 4096).await.unwrap();
            let json: serde_json::Value = serde_json::from_slice(&body).unwrap_or(serde_json::Value::Null);
            (
                status,
                json["error"].as_str().unwrap_or("").to_string(),
                json["detail"].as_str().unwrap_or("").to_string(),
            )
        };
        assert_eq!(check("pip").await.unwrap().status(), StatusCode::NO_CONTENT);
        let look = json!({"avatar": 0, "colour": 0});
        let res = send(
            "/api/signup",
            json!({"name": "Pip", "password": "correct horse", "look": look}),
            None,
        )
        .await
        .unwrap();
        assert!(res.status().is_success(), "{}", res.status());
        assert_eq!(
            answer(check("PIP").await.unwrap()).await,
            (StatusCode::CONFLICT, "nameTaken".into(), "That name is taken.".into())
        );
        assert_eq!(
            answer(check("demo9").await.unwrap()).await,
            (StatusCode::CONFLICT, "nameTaken".into(), "That name is the café's own.".into())
        );
        assert_eq!(
            answer(check("x").await.unwrap()).await,
            (
                StatusCode::BAD_REQUEST,
                "badInput".into(),
                "A name is 3 to 20 letters, digits, _ or -.".into()
            )
        );
        let elsewhere = send("/api/check-name", json!({ "name": "wren" }), Some("https://elsewhere.test"))
            .await
            .unwrap();
        assert_eq!(elsewhere.status(), StatusCode::FORBIDDEN);
        // The sign-up's per-name limit: five tries a minute, then refused.
        let statuses: Vec<StatusCode> = futures_util::future::join_all((0..6).map(|_| check("moss")))
            .await
            .into_iter()
            .map(|r| r.unwrap().status())
            .collect();
        assert_eq!(statuses.iter().filter(|s| **s == StatusCode::NO_CONTENT).count(), 5, "{statuses:?}");
        assert!(statuses.contains(&StatusCode::TOO_MANY_REQUESTS), "{statuses:?}");
        let lines = sink.lines();
        let checks: Vec<&serde_json::Value> = lines.iter().filter(|v| v["what"] == "check_name").collect();
        let codes: Vec<&str> = checks.iter().map(|v| v["code"].as_str().unwrap_or("?")).collect();
        assert_eq!(
            codes,
            ["nameTaken", "nameTaken", "badInput", "forbidden", "rateLimited"],
            "{lines:?}"
        );
        assert!(checks.iter().all(|v| v["outcome"] == "refused" && v["who"].is_null()), "{checks:?}");
        // Only the sign-up names the account it made.
        let others: Vec<&serde_json::Value> = lines.iter().filter(|v| v["what"] != "signup").collect();
        let all = format!("{others:?}").to_lowercase();
        for name in ["pip", "demo9", "wren", "moss"] {
            assert!(!all.contains(name), "{name} in {all}");
        }
    }

    /// A POST of JSON from 10.0.0.9 through `app`, its status.
    async fn status_of(app: &axum::Router, path: &str, body: serde_json::Value) -> StatusCode {
        let req = Request::post(path)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body.to_string()))
            .unwrap();
        app.clone().oneshot(req).await.unwrap().status()
    }

    #[tokio::test]
    async fn a_name_check_spends_sign_ups_own_buckets_and_a_sign_up_after_it_spends_nothing_more() {
        // Slice 20's review, findings 4, 7 and 14.
        let look = json!({"avatar": 0, "colour": 0});
        let dir = tempfile::tempdir().unwrap();
        let app = crate::http::tests::app(dir.path()).layer(MockConnectInfo(SocketAddr::from(([10, 0, 0, 9], 5000))));
        let sink = crate::test_logs::LogSink::default();
        let _logging = sink.capture();
        // One name's five tries, spent by log-ins: its check is refused at once.
        for _ in 0..5 {
            let s = status_of(&app, "/api/login", json!({"name": "fern", "password": "wrong horse"})).await;
            assert_eq!(s, StatusCode::UNAUTHORIZED);
        }
        assert_eq!(
            status_of(&app, "/api/check-name", json!({"name": "fern"})).await,
            StatusCode::TOO_MANY_REQUESTS,
            "the check spends the log-in's per-name bucket"
        );
        // And the reverse: five checks of a name leave its sign-up nothing.
        for _ in 0..5 {
            assert_eq!(
                status_of(&app, "/api/check-name", json!({"name": "reed"})).await,
                StatusCode::NO_CONTENT
            );
        }
        let signup = json!({"name": "reed", "password": "correct horse", "look": look});
        assert_eq!(
            status_of(&app, "/api/signup", signup.clone()).await,
            StatusCode::OK,
            "a sign-up straight after a check that found its name free spends nothing more"
        );
        // A check, then its sign-up, costs one try of the address: ten
        // newcomers on one network spend ten, not twenty.
        let dir = tempfile::tempdir().unwrap();
        let tight = crate::http::tests::app_with(dir.path(), |t| t.auth_per_ip_per_min = 10.0)
            .layer(MockConnectInfo(SocketAddr::from(([10, 0, 0, 9], 5000))));
        for i in 0..10 {
            let name = format!("pal{i}");
            assert_eq!(
                status_of(&tight, "/api/check-name", json!({ "name": name })).await,
                StatusCode::NO_CONTENT,
                "{name}"
            );
            let res = status_of(
                &tight,
                "/api/signup",
                json!({"name": name, "password": "correct horse", "look": look}),
            )
            .await;
            assert_eq!(res, StatusCode::OK, "{name}");
        }
        // The address's budget, shared across names: the eleventh name is refused.
        assert_eq!(
            status_of(&tight, "/api/check-name", json!({"name": "pal10"})).await,
            StatusCode::TOO_MANY_REQUESTS,
            "the check spends the per-address bucket"
        );
        // A sign-up with no check before it still spends, and still decides.
        let dir = tempfile::tempdir().unwrap();
        let fresh = crate::http::tests::app_with(dir.path(), |t| t.auth_per_ip_per_min = 2.0)
            .layer(MockConnectInfo(SocketAddr::from(([10, 0, 0, 9], 5000))));
        assert_eq!(
            status_of(&fresh, "/api/check-name", json!({"name": "moth"})).await,
            StatusCode::NO_CONTENT
        );
        let other = json!({"name": "wasp", "password": "correct horse", "look": look});
        assert_eq!(
            status_of(&fresh, "/api/signup", other).await,
            StatusCode::OK,
            "unchecked, it spends the second"
        );
        let checked = json!({"name": "moth", "password": "correct horse", "look": look});
        assert_eq!(
            status_of(&fresh, "/api/signup", checked.clone()).await,
            StatusCode::OK,
            "checked, it spends nothing"
        );
        assert_eq!(
            status_of(&fresh, "/api/signup", checked).await,
            StatusCode::TOO_MANY_REQUESTS,
            "only once"
        );
        // No address in any line.
        assert!(!sink.text().contains("10.0.0.9"), "{}", sink.text());
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
