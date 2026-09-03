import type { Metadata } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Meu Convite";

export const metadata: Metadata = {
  title: `${appName} — Convites de aniversário personalizados`,
  description: "Crie, personalize e compartilhe seu convite de aniversário online.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
