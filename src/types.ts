export interface HfFile {
  path: string;
  size: number;
  lfs: boolean;
  sha256?: string | null;
  directUrl: string;
}

export interface HfModelInfo {
  modelId: string;
  author: string;
  id: string;
  private: boolean;
  gated: boolean;
  downloads: number;
  likes: number;
  pipeline_tag: string;
  lastModified?: string;
  sha?: string;
  revision: string;
  totalFiles: number;
  totalSizeBytes: number;
  files: HfFile[];
}

export interface CliOptions {
  model: string;
  outputDir: string;
  token: string;
  revision: string;
  threads: number;
  filter: string;
  exclude: string;
  verify: boolean;
  resume: boolean;
  skipExisting: boolean;
  flat: boolean;
}

export interface TerminalLogEntry {
  id: string;
  type: "input" | "stdout" | "stderr" | "info" | "success" | "warning" | "progress" | "table";
  text?: string;
  timestamp: string;
  progressData?: {
    totalBytes: number;
    downloadedBytes: number;
    speedBytesPerSec: number;
    files: {
      path: string;
      downloaded: number;
      total: number;
      status: "pending" | "downloading" | "verifying" | "completed" | "failed";
      workerId: number;
      speed: string;
    }[];
  };
  tableData?: {
    headers: string[];
    rows: string[][];
  };
}

export interface RustSourceFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}
