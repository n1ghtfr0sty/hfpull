use anyhow::{bail, Context, Result};
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::fs::File;
use tokio::io::AsyncReadExt;

pub async fn verify_sha256(path: &Path, expected_hex: &str) -> Result<()> {
    let mut file = File::open(path)
        .await
        .with_context(|| format!("Failed to open {} for integrity verification", path.display()))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 1024 * 1024];

    loop {
        let n = file.read(&mut buffer).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    let result = hasher.finalize();
    let calculated_hex = hex::encode(result);

    if !calculated_hex.eq_ignore_ascii_case(expected_hex.trim()) {
        bail!(
            "SHA-256 checksum mismatch for '{}':\n  Expected:   {}\n  Calculated: {}",
            path.display(),
            expected_hex,
            calculated_hex
        );
    }

    Ok(())
}
