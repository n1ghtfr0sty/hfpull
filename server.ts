import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "hf-pull-rust-service" });
  });

  // API Route: Fetch Hugging Face Model metadata & file tree
  app.get("/api/hf/model", async (req, res) => {
    const model = req.query.model as string;
    const token = (req.query.token as string) || process.env.HF_TOKEN || "";
    const revision = (req.query.revision as string) || "main";

    if (!model || !model.includes("/")) {
      return res.status(400).json({
        error: "Invalid model format. Expected 'owner/repo' (e.g. unsloth/Qwen3.8-27B-NVFP4)",
      });
    }

    try {
      const headers: Record<string, string> = {
        "User-Agent": "hf-pull-rust/1.0",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Fetch model info
      const infoUrl = `https://huggingface.co/api/models/${encodeURIComponent(model)}`;
      const infoResp = await fetch(infoUrl, { headers });

      if (!infoResp.ok) {
        const errorText = await infoResp.text();
        return res.status(infoResp.status).json({
          error: `Hugging Face API returned ${infoResp.status}: ${infoResp.statusText}`,
          details: errorText,
        });
      }

      const modelInfo = await infoResp.json();

      // Fetch file tree
      const treeUrl = `https://huggingface.co/api/models/${encodeURIComponent(model)}/tree/${encodeURIComponent(revision)}?recursive=true`;
      const treeResp = await fetch(treeUrl, { headers });

      let files: any[] = [];
      if (treeResp.ok) {
        files = await treeResp.json();
      } else if (modelInfo.siblings) {
        // Fallback to siblings from model info
        files = modelInfo.siblings.map((s: any) => ({
          path: s.rfilename,
          type: "file",
          size: s.size || 0,
          lfs: s.lfs || null,
        }));
      }

      // Format files with raw direct download links
      const formattedFiles = files
        .filter((f: any) => f.type === "file" || f.rfilename)
        .map((f: any) => {
          const filePath = f.path || f.rfilename;
          const directUrl = `https://huggingface.co/${model}/resolve/${revision}/${filePath}`;
          return {
            path: filePath,
            size: f.size || (f.lfs ? f.lfs.size : 0),
            lfs: !!f.lfs,
            sha256: f.lfs ? f.lfs.sha256 : (f.oid || null),
            directUrl,
          };
        });

      const totalSizeBytes = formattedFiles.reduce((acc, f) => acc + (f.size || 0), 0);

      return res.json({
        modelId: model,
        author: modelInfo.author || model.split("/")[0],
        id: modelInfo.id || model,
        private: modelInfo.private || false,
        gated: modelInfo.gated || false,
        downloads: modelInfo.downloads || 0,
        likes: modelInfo.likes || 0,
        pipeline_tag: modelInfo.pipeline_tag || "unknown",
        lastModified: modelInfo.lastModified,
        sha: modelInfo.sha,
        revision,
        totalFiles: formattedFiles.length,
        totalSizeBytes,
        files: formattedFiles,
      });
    } catch (err: any) {
      console.error("HF Proxy Error:", err);
      return res.status(500).json({
        error: "Failed to query Hugging Face API",
        message: err.message,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
