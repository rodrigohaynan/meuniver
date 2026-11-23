import type { MetadataRoute } from "next";

const siteUrl = "https://convidata.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Áreas privadas e convites individuais não devem aparecer em buscadores.
      // Os crawlers de prévia (WhatsApp, Facebook etc.) não usam robots.txt
      // para gerar o card, então o compartilhamento continua funcionando.
      disallow: ["/painel", "/admin", "/api/", "/auth/", "/redefinir-senha", "/c/", "/s/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
