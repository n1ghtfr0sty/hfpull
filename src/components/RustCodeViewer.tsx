import React, { useState } from "react";
import { RUST_PROJECT_FILES } from "../rustCodeData";
import { RustSourceFile } from "../types";
import { Code, Download, Copy, Check, Terminal, FolderTree, FileCode, Cpu, Sparkles, BookOpen, Layers } from "lucide-react";
import JSZip from "jszip";

export const RustCodeViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<RustSourceFile>(RUST_PROJECT_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const copyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Root files
      RUST_PROJECT_FILES.forEach((f) => {
        zip.file(f.path, f.content);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hf-pull-rust-cli.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("ZIP Generation error:", e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div id="rust-code-viewer-root" className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-100">Standalone Rust Project Source Code</h2>
          </div>
          <p className="text-xs text-slate-400">
            Fully typed, asynchronous, zero-symlink HuggingFace weights downloader powered by Tokio & Reqwest.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="download-zip-btn"
            onClick={downloadZip}
            disabled={isZipping}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isZipping ? "Generating ZIP..." : "Download Complete Project (.ZIP)"}</span>
          </button>
        </div>
      </div>

      {/* Code Editor Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Left File Tree Sidebar */}
        <div className="lg:col-span-1 bg-slate-900/90 border-r border-slate-800 p-3 space-y-3">
          <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-amber-400" />
              <span>Project Files</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{RUST_PROJECT_FILES.length} files</span>
          </div>

          <div className="space-y-1">
            {RUST_PROJECT_FILES.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  id={`file-btn-${file.name.replace(/[^a-zA-Z0-9]/g, "-")}`}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                      : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FileCode
                      className={`w-3.5 h-3.5 shrink-0 ${
                        file.name.endsWith(".rs")
                          ? "text-amber-400"
                          : file.name.endsWith(".toml")
                          ? "text-cyan-400"
                          : file.name.endsWith(".sh")
                          ? "text-emerald-400"
                          : "text-slate-400"
                      }`}
                    />
                    <span className="truncate">{file.path}</span>
                  </div>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Quick Build Instructions */}
          <div className="pt-3 border-t border-slate-800/80 px-2 space-y-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Local Build Command</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-md text-[11px] font-mono text-emerald-400 border border-slate-800/80 select-all">
              cargo build --release
            </div>
          </div>
        </div>

        {/* Right Code Content Pane */}
        <div className="lg:col-span-3 flex flex-col bg-slate-950 font-mono text-xs">
          {/* File Header Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-slate-300">
            <div className="flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-slate-100">{selectedFile.path}</span>
              <span className="text-[11px] text-slate-500 font-sans hidden sm:inline">
                — {selectedFile.description}
              </span>
            </div>

            <button
              id="copy-current-file-code-btn"
              onClick={copyCode}
              className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors border border-slate-700"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="flex-1 p-4 overflow-x-auto max-h-[640px] overflow-y-auto leading-relaxed">
            <pre className="text-slate-200">
              <code>
                {selectedFile.content.split("\n").map((line, idx) => (
                  <div key={idx} className="table-row hover:bg-slate-900/60">
                    <span className="table-cell pr-4 text-right select-none text-slate-600 text-[11px] w-10 font-mono">
                      {idx + 1}
                    </span>
                    <span className="table-cell whitespace-pre font-mono">
                      {colorizeRustLine(line)}
                    </span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

// Lightweight client-side syntax styling helper
function colorizeRustLine(line: string) {
  if (line.trim().startsWith("//") || line.trim().startsWith("/*") || line.trim().startsWith("*/") || line.trim().startsWith("#!")) {
    return <span className="text-slate-500 italic">{line}</span>;
  }
  if (line.trim().startsWith("#[")) {
    return <span className="text-amber-300 font-semibold">{line}</span>;
  }
  if (line.includes("fn ") || line.includes("struct ") || line.includes("impl ") || line.includes("pub ")) {
    return <span className="text-cyan-300">{line}</span>;
  }
  if (line.includes("use ") || line.includes("mod ")) {
    return <span className="text-purple-300">{line}</span>;
  }
  if (line.includes('"')) {
    return <span className="text-emerald-300">{line}</span>;
  }
  return <span>{line}</span>;
}
