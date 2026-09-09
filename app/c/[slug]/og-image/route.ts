import { ImageResponse } from "next/og";
import { createElement } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Invitation } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

async function imageAsDataUrl(url: string) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*",
        "user-agent": "CONVNIVER-OG/1.0",
      },
    });

    if (!response.ok) return null;

    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      "image/jpeg";

    if (!contentType.startsWith("image/")) return null;

    const bytes = Buffer.from(await response.arrayBuffer());

    // Proteção contra arquivos exageradamente grandes.
    if (bytes.byteLength > 9 * 1024 * 1024) return null;

    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("invitations")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const invitation = (data as Invitation | null) ?? null;

  const heroDataUrl =
    invitation?.hero_image_url?.trim()
      ? await imageAsDataUrl(invitation.hero_image_url.trim())
      : null;

  const x = Math.max(0, Math.min(100, invitation?.hero_image_x ?? 50));
  const y = Math.max(0, Math.min(100, invitation?.hero_image_y ?? 50));

  /*
   * IMPORTANTE:
   * Este arquivo é route.ts (não route.tsx).
   * Route Handlers do App Router são reconhecidos pelo Next como route.ts/js.
   *
   * Usamos createElement para não precisar de JSX dentro de um arquivo .ts.
   */
  const element = createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#f7eee9",
      },
    },
    heroDataUrl
      ? createElement("img", {
          src: heroDataUrl,
          alt: "",
          width: WIDTH,
          height: HEIGHT,
          style: {
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${x}% ${y}%`,
          },
        })
      : createElement("div", {
          style: {
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background:
              "linear-gradient(135deg, #f7eee9 0%, #f1d9d9 48%, #ead0b0 100%)",
          },
        }),
  );

  return new ImageResponse(element, {
    width: WIDTH,
    height: HEIGHT,
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
