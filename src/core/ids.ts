import type { DiagnosticSource } from "./types.js";

export function tinyHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function makeDiagnosticId(
  source: DiagnosticSource,
  index: number,
  seed: string,
): string {
  return `${source}-${index}-${tinyHash(seed)}`;
}

export function makeClusterId(key: string): string {
  return `cluster-${tinyHash(key)}`;
}
