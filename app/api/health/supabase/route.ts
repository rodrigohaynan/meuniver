import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    const { url } = getSupabasePublicConfig();
    const hostname = new URL(url).hostname;

    let dns:
      | { ok: true; address: string; family: number }
      | { ok: false; error: string };

    try {
      const result = await lookup(hostname);
      dns = { ok: true, address: result.address, family: result.family };
    } catch (error) {
      dns = {
        ok: false,
        error: error instanceof Error ? error.message : "DNS lookup failed",
      };
    }

    let auth:
      | { ok: boolean; status: number }
      | { ok: boolean; error: string; cause?: string };

    try {
      const response = await fetch(`${url}/auth/v1/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      auth = { ok: response.ok, status: response.status };
    } catch (error) {
      const cause =
        error instanceof Error && "cause" in error && error.cause instanceof Error
          ? error.cause.message
          : undefined;
      auth = {
        ok: false,
        error: error instanceof Error ? error.message : "Fetch failed",
        ...(cause ? { cause } : {}),
      };
    }

    return NextResponse.json(
      {
        ok: dns.ok && auth.ok,
        hostname,
        dns,
        auth,
        elapsedMs: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configError: error instanceof Error ? error.message : "Config error",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
