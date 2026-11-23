import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // As imagens vêm do Supabase Storage, de anúncios externos e das rotas de
      // prévia social; <img> evita custos de transformação do Image CDN.
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([".next/**", ".netlify/**", "out/**", "build/**", "next-env.d.ts"]),
]);
