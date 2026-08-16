use anyhow::{bail, Context, Result};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfFileEntry {
    pub path: String,
    pub size: u64,
    pub lfs: bool,
    pub sha256: Option<String>,
    pub direct_url: String,
}

#[derive(Debug, Deserialize)]
struct ApiTreeItem {
    path: Option<String>,
    rfilename: Option<String>,
    #[serde(rename = "type")]
    item_type: Option<String>,
    size: Option<u64>,
    lfs: Option<ApiLfsInfo>,
    oid: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiLfsInfo {
    size: Option<u64>,
    sha256: Option<String>,
    oid: Option<String>,
}

pub struct HfClient {
    client: reqwest::Client,
    model: String,
    revision: String,
    token: Option<String>,
}

impl HfClient {
    pub fn new(model: &str, revision: &str, token: Option<String>) -> Result<Self> {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("hf-pull-rust/0.1.0 (standalone-downloader)"),
        );

        if let Some(ref t) = token {
            let auth_val = format!("Bearer {}", t.trim());
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&auth_val)
                    .context("Invalid token format for Authorization header")?,
            );
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()?;

        Ok(Self {
            client,
            model: model.to_string(),
            revision: revision.to_string(),
            token,
        })
    }

    pub async fn fetch_file_tree(&self) -> Result<Vec<HfFileEntry>> {
        let tree_url = format!(
            "https://huggingface.co/api/models/{}/tree/{}?recursive=true",
            self.model, self.revision
        );

        let resp = self.client.get(&tree_url).send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();

            if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
                bail!(
                    "Authentication failed ({}) for model '{}'. Gated or private models require an access token.\n\
                     Pass --token <HF_TOKEN> or set the HF_TOKEN environment variable.",
                    status,
                    self.model
                );
            }

            bail!(
                "Hugging Face API returned status {}: {}\nCheck if the model name '{}' is spelled correctly.",
                status,
                body,
                self.model
            );
        }

        let items: Vec<ApiTreeItem> = resp.json().await.context("Failed to parse HuggingFace tree response")?;
        let mut results = Vec::new();

        for item in items {
            if let Some(ref it) = item.item_type {
                if it != "file" {
                    continue;
                }
            }

            let file_path = item.path.or(item.rfilename).unwrap_or_default();
            if file_path.is_empty() || file_path.starts_with(".git") {
                continue;
            }

            let (size, is_lfs, sha256) = if let Some(lfs) = item.lfs {
                (
                    lfs.size.or(item.size).unwrap_or(0),
                    true,
                    lfs.sha256.or(lfs.oid),
                )
            } else {
                (item.size.unwrap_or(0), false, item.oid)
            };

            let direct_url = format!(
                "https://huggingface.co/{}/resolve/{}/{}",
                self.model, self.revision, file_path
            );

            results.push(HfFileEntry {
                path: file_path,
                size,
                lfs: is_lfs,
                sha256,
                direct_url,
            });
        }

        Ok(results)
    }

    pub fn client(&self) -> &reqwest::Client {
        &self.client
    }

    pub fn token(&self) -> Option<&str> {
        self.token.as_deref()
    }
}
