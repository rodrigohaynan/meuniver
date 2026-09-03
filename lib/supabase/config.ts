function normalizeSupabaseProjectUrl(rawValue: string) {
  const raw = rawValue.trim();

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL inválida. Use somente a URL do projeto, por exemplo: https://seu-projeto.supabase.co",
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL precisa começar com http:// ou https://.");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Erro comum: copiar a URL do painel em vez da URL pública do projeto.
  if (hostname === "supabase.com" || hostname === "www.supabase.com") {
    throw new Error(
      "Você informou a URL do painel do Supabase. Em NEXT_PUBLIC_SUPABASE_URL use a Project URL, por exemplo: https://seu-projeto.supabase.co",
    );
  }

  // A Project URL do Supabase é sempre a origem. Se o usuário colar por engano
  // /auth/v1/callback, /rest/v1, /storage/v1 etc., removemos o caminho.
  return parsed.origin;
}

export function getSupabasePublicConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rawUrl || !key) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return {
    url: normalizeSupabaseProjectUrl(rawUrl),
    key: key.trim(),
  };
}
