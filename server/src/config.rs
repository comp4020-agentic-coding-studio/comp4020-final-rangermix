//! Where things are, from the environment, with defaults that work from the
//! repo root for a local run. The Dockerfile sets the container's paths.
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub data_dir: PathBuf,
    pub content_dir: PathBuf,
    pub client_dir: PathBuf,
    pub readme_path: PathBuf,
    pub docs_dir: PathBuf,
}

impl Config {
    pub fn from_env() -> Config {
        Config::from_lookup(|key| std::env::var(key).ok())
    }

    pub fn from_lookup(get: impl Fn(&str) -> Option<String>) -> Config {
        let path = |key: &str, default: &str| PathBuf::from(get(key).unwrap_or_else(|| default.to_string()));
        Config {
            port: get("PORT").and_then(|p| p.parse().ok()).unwrap_or(8080),
            data_dir: path("DATA_DIR", ".data"),
            content_dir: path("CONTENT_DIR", "content"),
            client_dir: path("CLIENT_DIR", "client/dist"),
            readme_path: path("README_PATH", "README.md"),
            docs_dir: path("DOCS_DIR", "docs"),
        }
    }

    /// The id Vite stamps on the client build, next to index.html. A tab whose
    /// client differs from the server's reloads.
    pub fn build_id(&self) -> String {
        std::fs::read_to_string(self.client_dir.join("build-id.txt"))
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|_| "dev".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn defaults_work_from_the_repo_root() {
        let c = Config::from_lookup(|_| None);
        assert_eq!(c.port, 8080);
        assert_eq!(c.data_dir, PathBuf::from(".data"));
        assert_eq!(c.content_dir, PathBuf::from("content"));
        assert_eq!(c.client_dir, PathBuf::from("client/dist"));
        assert_eq!(c.readme_path, PathBuf::from("README.md"));
    }

    #[test]
    fn the_environment_overrides_the_defaults() {
        let c = Config::from_lookup(|k| match k {
            "PORT" => Some("9000".into()),
            "DATA_DIR" => Some("/data".into()),
            _ => None,
        });
        assert_eq!(c.port, 9000);
        assert_eq!(c.data_dir, PathBuf::from("/data"));
    }

    #[test]
    fn the_build_id_is_dev_without_a_client_build() {
        let c = Config::from_lookup(|k| (k == "CLIENT_DIR").then(|| "/nowhere".into()));
        assert_eq!(c.build_id(), "dev");
    }
}
