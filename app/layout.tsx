import type { Metadata } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "CONVNIVER";

export const metadata: Metadata = {
  title: `${appName} — Convites de aniversário personalizados`,
  description: "Crie, personalize e compartilhe seu convite de aniversário online.",
  icons: {
    icon: "/brand/convniver-icon.png",
    apple: "/brand/convniver-icon.png",
    shortcut: "/brand/convniver-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
