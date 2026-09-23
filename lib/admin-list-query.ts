export const ADMIN_LIST_PAGE_SIZE = 20;

export function listPage(raw: string | undefined) {
  const parsed = Number(raw ?? "1");
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100000) : 1;
}

// PostgREST .or(...) accepts filter expressions, not arbitrary user input.
// Exclude filter delimiters and SQL LIKE wildcards before constructing them.
export function listSearch(raw: string | undefined) {
  return String(raw ?? "").trim().replace(/[^\p{L}\p{N}\s@.+-]/gu, " ").replace(/\s+/g, " ").slice(0, 80).trim();
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function adminListUrl(path: string, params: Record<string, string | number | undefined>) {
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== "todos" && value !== 1) {
      urlParams.set(key, String(value));
    }
  }
  const query = urlParams.toString();
  return query ? `${path}?${query}` : path;
}
