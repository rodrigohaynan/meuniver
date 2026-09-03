import { randomUUID } from "node:crypto";
import { captureProductImage } from "@/lib/product-image";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeSuggestionUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const raw = value.trim().slice(0, 1200);
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("O link de sugestão precisa usar http ou https.");
  }
  if (url.username || url.password) throw new Error("O link de sugestão informado não é permitido.");
  return url.toString();
}

function extensionFor(contentType: string) {
  switch (contentType.toLowerCase()) {
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    case "image/avif": return "avif";
    default: return "jpg";
  }
}

function storagePathFromPublicUrl(value: string | null | undefined) {
  if (!value) return "";
  const marker = "/storage/v1/object/public/invite-media/";
  const index = value.indexOf(marker);
  if (index < 0) return "";
  try {
    return decodeURIComponent(value.slice(index + marker.length));
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  }

  let body: { giftId?: unknown; suggestionUrl?: unknown };
  try {
    body = (await request.json()) as { giftId?: unknown; suggestionUrl?: unknown };
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const giftId = typeof body.giftId === "string" ? body.giftId.trim() : "";
  if (!/^[0-9a-f-]{30,40}$/i.test(giftId)) {
    return Response.json({ error: "Presente inválido." }, { status: 400 });
  }

  const { data: gift, error: giftError } = await supabase
    .from("gifts")
    .select("id, invitation_id, suggestion_url, suggestion_image_url")
    .eq("id", giftId)
    .single();

  if (giftError || !gift) {
    return Response.json({ error: "Presente não encontrado ou sem permissão." }, { status: 404 });
  }

  let suggestionUrl: string;
  try {
    suggestionUrl = normalizeSuggestionUrl(body.suggestionUrl ?? gift.suggestion_url);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Link inválido." }, { status: 400 });
  }

  if (!suggestionUrl) {
    return Response.json({ error: "Informe o link de sugestão antes de capturar a imagem." }, { status: 400 });
  }

  try {
    // Mesmo princípio usado no convite da Liene: captura uma vez no servidor,
    // armazena uma cópia própria e associa a imagem exclusivamente a este presente.
    const captured = await captureProductImage(suggestionUrl);
    const extension = extensionFor(captured.contentType);
    const path = `${user.id}/${gift.invitation_id}/gift-${gift.id}/suggestion-${randomUUID()}.${extension}`;

    const capturedBlob = new Blob([captured.bytes], { type: captured.contentType });
    const { error: uploadError } = await supabase.storage
      .from("invite-media")
      .upload(path, capturedBlob, {
        upsert: false,
        contentType: captured.contentType,
        cacheControl: "31536000",
      });

    if (uploadError) {
      return Response.json({ error: `A imagem foi encontrada, mas não pôde ser armazenada: ${uploadError.message}` }, { status: 502 });
    }

    const { data: publicData } = supabase.storage.from("invite-media").getPublicUrl(path);
    const imageUrl = publicData.publicUrl;

    const { error: updateError } = await supabase
      .from("gifts")
      .update({ suggestion_url: suggestionUrl, suggestion_image_url: imageUrl })
      .eq("id", gift.id);

    if (updateError) {
      await supabase.storage.from("invite-media").remove([path]).catch(() => undefined);
      return Response.json({ error: `A imagem foi capturada, mas não pôde ser vinculada ao presente: ${updateError.message}` }, { status: 502 });
    }

    const previousPath = storagePathFromPublicUrl(gift.suggestion_image_url);
    if (previousPath && previousPath !== path) {
      await supabase.storage.from("invite-media").remove([previousPath]).catch(() => undefined);
    }

    return Response.json({ imageUrl, suggestionUrl });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível capturar automaticamente a imagem do anúncio." },
      { status: 422 },
    );
  }
}
