import path from "node:path";
import { readTextFile } from "../utils/fs.js";
import { normalizeSlashes } from "../utils/paths.js";
import { discoverProjectFiles } from "./discoverFiles.js";

export interface IndexedProjectFile {
  absolutePath: string;
  relativePath: string;
  text: string;
  generated: boolean;
}

export interface ProjectIndex {
  root: string;
  files: IndexedProjectFile[];
  byRelativePath: Map<string, IndexedProjectFile>;
}

export function buildProjectIndex(root: string, maxFiles: number): ProjectIndex {
  const absolutePaths = discoverProjectFiles(root, maxFiles);
  absolutePaths.sort((a, b) => a.localeCompare(b));

  const files: IndexedProjectFile[] = [];
  const byRelativePath = new Map<string, IndexedProjectFile>();

  for (const absolutePath of absolutePaths) {
    const text = readTextFile(absolutePath) ?? "";
    const relativePath = normalizeSlashes(path.relative(root, absolutePath));
    const generated =
      /(^|\/)(dist|build)\//.test(relativePath) || relativePath.endsWith(".min.js");

    const entry: IndexedProjectFile = { absolutePath, relativePath, text, generated };
    files.push(entry);
    byRelativePath.set(relativePath, entry);
  }

  return { root, files, byRelativePath };
}
