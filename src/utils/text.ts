export function stripAnsi(input: string): string {
  return input.replace(/\u001B\[[0-9;]*m/g, "");
}

export function compactText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}
