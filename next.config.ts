import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // O Convidata usa metadados dinâmicos em /c/[slug].
  // Desativa o streaming de metadata para que crawlers de compartilhamento
  // (WhatsApp, Facebook, Telegram etc.) recebam title/description/og:image
  // diretamente dentro do <head> da primeira resposta HTML.
  htmlLimitedBots: /.*/,

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Painel, administração e APIs autenticadas não devem ser indexados.
      {
        source: "/:area(painel|admin|api|auth|redefinir-senha)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
