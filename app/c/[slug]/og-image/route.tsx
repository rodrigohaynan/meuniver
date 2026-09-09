import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const destination = new URL(
    `/c/${encodeURIComponent(slug)}/og-image.jpg${new URL(request.url).search}`,
    request.url,
  );

  return NextResponse.redirect(destination, 307);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return GET(request, context);
}
