const PLACEHOLDER_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function detectPlaceholders(text: string): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text))) names.add(m[1].trim());
  return Array.from(names);
}
