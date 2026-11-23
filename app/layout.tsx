import type { Metadata } from "next";
import "./globals.css";

const appName = "Convidata";
const shareTitle = "Convidata — Convites digitais para momentos especiais";
const shareDescription = "Crie convites digitais personalizados, acompanhe as confirmações de presença e organize sua lista de presentes em um só lugar.";
const siteUrl = "https://convidata.com.br";
const shareImage = `${siteUrl}/brand-preview.png?v=3`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: shareTitle,
  description: shareDescription,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: appName,
    title: shareTitle,
    description: shareDescription,
    url: `${siteUrl}/`,
    images: [{ url: shareImage, width: 1200, height: 630, type: "image/png", alt: "Convidata — convites digitais personalizados e lista de presentes" }],
  },
  twitter: { card: "summary_large_image", title: shareTitle, description: shareDescription, images: [shareImage] },
  icons: {
    icon: "/brand/convidata-icon.svg",
    apple: "/brand/convidata-icon.svg",
    shortcut: "/brand/convidata-icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
