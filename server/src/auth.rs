//! Accounts (ADR 0007): what makes a valid name and password, hashing
//! passwords and recovery codes with argon2id, session tokens and the cookie
//! that carries them. Secrets are never logged.
use argon2::{Algorithm, Argon2, Params, PasswordHash, PasswordHasher, PasswordVerifier, Version};
use base64::Engine;
use rand::{Rng, RngExt};
use sha2::{Digest, Sha256};

pub const SESSION_COOKIE: &str = "session";

/// Crockford's base32: no I, L, O or U to misread.
pub const CODE_ALPHABET: &[u8] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

pub fn valid_username(name: &str) -> bool {
    (3..=20).contains(&name.chars().count()) && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub fn valid_password(password: &str) -> bool {
    (8..=128).contains(&password.chars().count())
}

/// argon2id at OWASP's minimum: 19 MiB, 2 iterations, parallelism 1.
fn argon() -> Argon2<'static> {
    let params = Params::new(19_456, 2, 1, None).expect("valid argon2 parameters");
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
}

/// Slow on purpose: call it from `spawn_blocking`, behind the hashing semaphore.
pub fn hash_secret(secret: &str) -> String {
    argon().hash_password(secret.as_bytes()).expect("argon2 hashing").to_string()
}

pub fn verify_secret(secret: &str, hash: &str) -> bool {
    PasswordHash::new(hash).is_ok_and(|h| argon().verify_password(secret.as_bytes(), &h).is_ok())
}

/// Sixteen characters in four groups, like `K7QF-2M9D-XR4T-8HWC`: about 80 bits.
pub fn new_recovery_code() -> String {
    let mut rng = rand::rng();
    let chars: Vec<char> = (0..16)
        .map(|_| CODE_ALPHABET[rng.random_range(0..CODE_ALPHABET.len())] as char)
        .collect();
    chars
        .chunks(4)
        .map(|group| group.iter().collect::<String>())
        .collect::<Vec<_>>()
        .join("-")
}

/// What someone types, folded back to the code: case, dashes and spaces
/// don't matter, and O, I and L read as 0, 1 and 1.
pub fn normalise_code(input: &str) -> String {
    input
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| match c.to_ascii_uppercase() {
            'O' => '0',
            'I' | 'L' => '1',
            upper => upper,
        })
        .collect()
}

pub fn new_session_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// Sessions are stored only as this hash, so the database can't be used to log in.
pub fn token_hash(token: &str) -> String {
    Sha256::digest(token.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

pub fn session_cookie(token: &str, max_age_secs: u64) -> String {
    format!("{SESSION_COOKIE}={token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age={max_age_secs}")
}

pub fn cookie_value<'a>(cookie_header: &'a str, name: &str) -> Option<&'a str> {
    cookie_header
        .split(';')
        .map(str::trim)
        .find_map(|kv| kv.strip_prefix(name)?.strip_prefix('='))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_three_to_twenty_safe_characters() {
        for ok in ["sam", "Sam_99", "a-b-c", "abcdefghijklmnopqrst"] {
            assert!(valid_username(ok), "{ok}");
        }
        for bad in ["sa", "abcdefghijklmnopqrstu", "sam smith", "sam!", "émile", ""] {
            assert!(!valid_username(bad), "{bad}");
        }
    }

    #[test]
    fn passwords_are_eight_to_128_characters() {
        assert!(!valid_password("1234567"));
        assert!(valid_password("12345678"));
        assert!(valid_password(&"x".repeat(128)));
        assert!(!valid_password(&"x".repeat(129)));
        assert!(valid_password("éééééééé"), "counted in characters, not bytes");
    }

    #[test]
    fn a_hashed_secret_verifies_only_itself() {
        let hash = hash_secret("correct horse");
        assert!(hash.starts_with("$argon2id$v=19$m=19456,t=2,p=1$"));
        assert!(verify_secret("correct horse", &hash));
        assert!(!verify_secret("wrong horse", &hash));
        assert!(!verify_secret("correct horse", "not a hash"));
    }

    #[test]
    fn recovery_codes_are_four_groups_of_four_unambiguous_characters() {
        let code = new_recovery_code();
        let groups: Vec<&str> = code.split('-').collect();
        assert_eq!(groups.len(), 4);
        assert!(groups.iter().all(|g| g.len() == 4 && g.bytes().all(|b| CODE_ALPHABET.contains(&b))));
        assert_ne!(code, new_recovery_code());
    }

    #[test]
    fn typed_codes_fold_back_to_the_canonical_form() {
        assert_eq!(normalise_code("k7qf-2m9d xr4t-8hwc"), "K7QF2M9DXR4T8HWC");
        assert_eq!(normalise_code("O0Il"), "0011");
    }

    #[test]
    fn session_tokens_are_long_and_kept_only_as_hashes() {
        let token = new_session_token();
        assert_eq!(token.len(), 43);
        let hash = token_hash(&token);
        assert_eq!(hash.len(), 64);
        assert!(hash.bytes().all(|b| b.is_ascii_hexdigit()));
        assert_eq!(hash, token_hash(&token));
    }

    #[test]
    fn the_session_cookie_is_http_only_secure_and_lax() {
        let c = session_cookie("abc", 60);
        for part in ["session=abc", "HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=60"] {
            assert!(c.contains(part), "{c} lacks {part}");
        }
    }

    #[test]
    fn cookies_are_found_by_exact_name() {
        assert_eq!(cookie_value("a=1; session=xyz; b=2", "session"), Some("xyz"));
        assert_eq!(cookie_value("sessionx=1", "session"), None);
        assert_eq!(cookie_value("", "session"), None);
    }
}
