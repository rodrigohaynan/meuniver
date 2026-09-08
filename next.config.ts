import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // O CONVNIVER usa metadados dinâmicos em /c/[slug].
  // Desativa o streaming de metadata para que crawlers de compartilhamento
  // (WhatsApp, Facebook, Telegram etc.) recebam title/description/og:image
  // diretamente dentro do <head> da primeira resposta HTML.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
