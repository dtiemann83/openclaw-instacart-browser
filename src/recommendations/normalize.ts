export const NORMALIZER_VERSION = "1";

const SIZE_RE = /\b\d+(\.\d+)?\s*[-]?\s*(oz|lb|lbs|g|kg|ml|l|gal|gallon|ct|pack|pk)\b/i;
const PUNCT_RE = /[^\w\s-]+/g;
const WS_RE = /\s+/g;

export function normalizeItemKey(name: string, opts?: { brand?: string }): string {
  let s = name;
  if (opts?.brand) {
    const b = opts.brand.toLowerCase();
    if (s.toLowerCase().startsWith(b)) s = s.slice(opts.brand.length);
  }
  s = s.toLowerCase();
  s = s.replace(SIZE_RE, " ");
  s = s.replace(PUNCT_RE, " ");
  s = s.replace(WS_RE, " ").trim();
  return s;
}
