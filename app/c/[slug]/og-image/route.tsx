import { ImageResponse } from "next/og";
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
      },
    });

    if (!response.ok) return null;

    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      "image/jpeg";

    if (!contentType.startsWith("image/")) return null;

    const bytes = Buffer.from(await response.arrayBuffer());

    // Evita prévias muito pesadas para crawlers.
    if (bytes.byteLength > 9 * 1024 * 1024) return null;

    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function fallbackTitle(invitation: Invitation | null) {
  if (!invitation) return "Você está convidado";
  return (
    invitation.event_title.trim() ||
    (invitation.host_name.trim()
      ? `Aniversário de ${invitation.host_name.trim()}`
      : "Você está convidado")
  );
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
  const title = fallbackTitle(invitation);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#f7eee9",
          color: "#351820",
        }}
      >
        {heroDataUrl ? (
          <img
            src={heroDataUrl}
            alt=""
            width={WIDTH}
            height={HEIGHT}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `${x}% ${y}%`,
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background:
                "linear-gradient(135deg, #f7eee9 0%, #f1d9d9 48%, #ead0b0 100%)",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.02) 35%, rgba(36,13,21,0.70) 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 54,
            right: 54,
            bottom: 44,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              color: "#f1c775",
              marginBottom: 14,
            }}
          >
            CONVNIVER
          </div>

          <div
            style={{
              display: "flex",
              maxWidth: 1020,
              fontSize: 54,
              lineHeight: 1.08,
              fontWeight: 800,
              color: "#ffffff",
              textShadow: "0 2px 12px rgba(0,0,0,.28)",
            }}
          >
            {title}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
