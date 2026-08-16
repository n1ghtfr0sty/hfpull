use std::env;
use std::fs;

pub fn resolve_token(cli_token: Option<String>) -> Option<String> {
    if let Some(t) = cli_token {
        if !t.trim().is_empty() {
            return Some(t.trim().to_string());
        }
    }

    if let Ok(t) = env::var("HF_TOKEN") {
        if !t.trim().is_empty() {
            return Some(t.trim().to_string());
        }
    }

    if let Ok(t) = env::var("HUGGING_FACE_HUB_TOKEN") {
        if !t.trim().is_empty() {
            return Some(t.trim().to_string());
        }
    }

    None
}
