import type { MetadataRoute } from "next";

const siteUrl = "https://convidata.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/entrar`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
