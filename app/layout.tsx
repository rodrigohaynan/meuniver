import type { Metadata } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Convidata";

export const metadata: Metadata = {
  title: `${appName} — Convites digitais para momentos especiais`,
  description: "Crie e personalize convites digitais, organize confirmações de presença e compartilhe os momentos que importam.",
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
