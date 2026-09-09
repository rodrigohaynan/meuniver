import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function destinationFor(request: Request, slug: string) {
  const incoming = new URL(request.url);
  const destination = new URL(
    `/c/${encodeURIComponent(slug)}/og-image`,
    incoming.origin,
  );
  destination.search = incoming.search;
  return destination;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return NextResponse.redirect(destinationFor(request, slug), 302);
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return NextResponse.redirect(destinationFor(request, slug), 302);
}
