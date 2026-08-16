import React, { useState, useEffect } from "react";
import { HfModelInfo, HfFile } from "../types";
import { Search, Download, ExternalLink, Copy, Check, ShieldCheck, Database, FileCode, Layers, ArrowRight, RefreshCw, Lock, Sparkles } from "lucide-react";

interface ModelExplorerProps {
  currentModel: string;
  onSelectModel: (model: string) => void;
  onSendToTerminal: (command: string) => void;
}

const PRESET_MODELS = [
  { id: "unsloth/Qwen3.8-27B-NVFP4", label: "Qwen3.8-27B (NVFP4)", tag: "4-bit quantized" },
  { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B", label: "DeepSeek-R1-Distill-1.5B", tag: "Reasoning" },
  { id: "meta-llama/Llama-3.2-1B", label: "Llama-3.2-1B", tag: "Gated / Lightweight" },
  { id: "Qwen/Qwen2.5-Coder-7B-Instruct", label: "Qwen2.5-Coder-7B", tag: "Coding" },
  { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral-7B-v0.3", tag: "General LLM" },
  { id: "BAAI/bge-large-en-v1.5", label: "BGE-Large-en", tag: "Embeddings" },
];

export const ModelExplorer: React.FC<ModelExplorerProps> = ({
  currentModel,
  onSelectModel,
  onSendToTerminal,
}) => {
  const [modelInput, setModelInput] = useState<string>(currentModel);
  const [modelData, setModelData] = useState<HfModelInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [fileFilter, setFileFilter] = useState<string>("all");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const fetchModel = async (modelToFetch: string) => {
    if (!modelToFetch.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(
        `/api/hf/model?model=${encodeURIComponent(modelToFetch.trim())}&token=${encodeURIComponent(token.trim())}`
      );

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${resp.status}: Model not found or requires authentication`);
      }

      const data: HfModelInfo = await resp.json();
      setModelData(data);
      onSelectModel(modelToFetch.trim());
    } catch (err: any) {
      setError(err.message || "Failed to load model from Hugging Face");
      setModelData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModel(currentModel);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} B`;
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const filteredFiles = (modelData?.files || []).filter((f) => {
    const matchesSearch = f.path.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (fileFilter === "safetensors") {
      return f.path.endsWith(".safetensors") || f.path.endsWith(".bin") || f.path.endsWith(".gguf");
    }
    if (fileFilter === "configs") {
      return f.path.endsWith(".json") || f.path.endsWith(".txt") || f.path.endsWith(".yaml");
    }
    if (fileFilter === "tokenizers") {
      return f.path.includes("tokenizer") || f.path.includes("vocab");
    }
    return true;
  });

  const totalFilteredSize = filteredFiles.reduce((sum, f) => sum + f.size, 0);

  return (
    <div id="model-explorer-root" className="space-y-6">
      {/* Search Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              <span>Hugging Face Live Repository Inspector</span>
            </h2>
            <p className="text-xs text-slate-400">
              Query direct weights, configs, and Git LFS tree directly from huggingface.co without symlinks
            </p>
          </div>

          {/* Preset Chips */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-slate-500 mr-1">Popular:</span>
            {PRESET_MODELS.map((preset) => (
              <button
                key={preset.id}
                id={`preset-btn-${preset.id.replace(/[^a-zA-Z0-9]/g, "-")}`}
                onClick={() => {
                  setModelInput(preset.id);
                  fetchModel(preset.id);
                }}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  modelInput === preset.id
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          id="hf-model-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            fetchModel(modelInput);
          }}
          className="mt-4 flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              id="hf-model-input"
              type="text"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              placeholder="e.g. unsloth/Qwen3.8-27B-NVFP4 or meta-llama/Llama-3.2-1B"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <input
            id="hf-token-input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="HF Token (optional for gated)"
            className="sm:w-48 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
          />

          <button
            id="hf-fetch-btn"
            type="submit"
            disabled={loading || !modelInput.trim()}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-sm transition-colors disabled:opacity-50 shadow-md"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 fill-current" />
            )}
            <span>Inspect Model</span>
          </button>
        </form>

        {error && (
          <div className="mt-3 p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-xs text-rose-300 flex items-start gap-2">
            <Lock className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-bold">Error:</span> {error}
              {error.toLowerCase().includes("auth") && (
                <p className="mt-1 text-slate-300">
                  Tip: Gated models require a HuggingFace access token with "Read" permissions from huggingface.co/settings/tokens.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Model Overview Card */}
      {modelData && (
        <div id="model-overview-card" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                  {modelData.pipeline_tag || "text-generation"}
                </span>
                {modelData.gated && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Gated Model
                  </span>
                )}
                <span className="text-xs text-slate-400 font-mono">rev: {modelData.revision}</span>
              </div>
              <h3 className="text-xl font-bold text-slate-100 mt-1 font-mono">{modelData.modelId}</h3>
            </div>

            {/* Quick Action Button for Terminal */}
            <div className="flex items-center gap-2">
              <button
                id="send-to-terminal-btn"
                onClick={() => onSendToTerminal(`hf-pull ${modelData.modelId} --output-dir ./models -j 8`)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs shadow transition-all"
              >
                <span>Run in Rust CLI Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <a
                href={`https://huggingface.co/${modelData.modelId}`}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors border border-slate-700"
                title="Open on HuggingFace Hub"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
              <span className="text-xs text-slate-500 block">Total Weights Size</span>
              <span className="text-lg font-bold text-amber-400 font-mono">
                {formatSize(modelData.totalSizeBytes)}
              </span>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
              <span className="text-xs text-slate-500 block">Total Files</span>
              <span className="text-lg font-bold text-cyan-400 font-mono">
                {modelData.totalFiles} files
              </span>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
              <span className="text-xs text-slate-500 block">Author / Org</span>
              <span className="text-lg font-bold text-slate-200 font-mono truncate block">
                {modelData.author}
              </span>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
              <span className="text-xs text-slate-500 block">Hub Downloads</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {modelData.downloads.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* File Tree & Direct Straight Weights */}
      {modelData && (
        <div id="file-tree-container" className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          {/* File Controls */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-sm text-slate-200">Repository Files</span>
              <span className="text-xs text-slate-400 font-mono">
                ({filteredFiles.length} files • {formatSize(totalFilteredSize)})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs">
                <button
                  onClick={() => setFileFilter("all")}
                  className={`px-2.5 py-1 rounded ${
                    fileFilter === "all" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-slate-400"
                  }`}
                >
                  All ({modelData.files.length})
                </button>
                <button
                  onClick={() => setFileFilter("safetensors")}
                  className={`px-2.5 py-1 rounded ${
                    fileFilter === "safetensors" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-slate-400"
                  }`}
                >
                  Weights (.safetensors)
                </button>
                <button
                  onClick={() => setFileFilter("configs")}
                  className={`px-2.5 py-1 rounded ${
                    fileFilter === "configs" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-slate-400"
                  }`}
                >
                  Configs (.json)
                </button>
                <button
                  onClick={() => setFileFilter("tokenizers")}
                  className={`px-2.5 py-1 rounded ${
                    fileFilter === "tokenizers" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-slate-400"
                  }`}
                >
                  Tokenizers
                </button>
              </div>

              {/* Search file filter */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter files..."
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Files List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-4 font-semibold">File Name</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Size</th>
                  <th className="py-2.5 px-3 font-semibold">Git LFS Checksum (SHA-256)</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Straight Download Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredFiles.map((file) => {
                  const isSafetensors = file.path.endsWith(".safetensors");
                  const isJson = file.path.endsWith(".json");
                  return (
                    <tr key={file.path} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center space-x-2">
                          <FileCode
                            className={`w-4 h-4 shrink-0 ${
                              isSafetensors ? "text-amber-400" : isJson ? "text-cyan-400" : "text-slate-400"
                            }`}
                          />
                          <span className={`truncate font-semibold ${isSafetensors ? "text-amber-200" : "text-slate-200"}`}>
                            {file.path}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300 font-bold">
                        {formatSize(file.size)}
                      </td>
                      <td className="py-2.5 px-3">
                        {file.sha256 ? (
                          <div className="flex items-center space-x-1 text-slate-400" title={file.sha256}>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate max-w-[140px] text-[11px]">{file.sha256}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px]">Git tree</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            id={`copy-url-${file.path.replace(/[^a-zA-Z0-9]/g, "-")}`}
                            onClick={() => copyText(file.directUrl, file.path)}
                            title="Copy direct raw download URL (no symlinks)"
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
                          >
                            {copiedUrl === file.path ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={file.directUrl}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="p-1.5 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-colors inline-flex items-center"
                            title="Download file directly"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
