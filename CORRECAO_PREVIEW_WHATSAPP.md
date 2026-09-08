# Correção da prévia do WhatsApp

Esta versão corrige os dois pontos mais frágeis da prévia social do convite:

1. A URL absoluta da imagem social agora usa primeiro o host real da requisição. Assim, `og:image` não fica dependente de `NEXT_PUBLIC_APP_URL` estar perfeitamente configurada no Netlify.
2. A imagem social passou a ser gerada como JPEG 1200x630 otimizado, mirando até aproximadamente 300 KB. A imagem utiliza a foto principal do convite; se a foto não puder ser lida, é gerado um fallback visual com o título.
3. A URL da imagem recebe uma versão calculada a partir da foto, título e enquadramento. Isso reduz o risco de o WhatsApp reutilizar uma imagem social antiga.

## Arquivos alterados

- `app/c/[slug]/page.tsx`
- `app/c/[slug]/og-image.jpg/route.ts`
- `package.json` (adição do `sharp`)

A rota antiga `app/c/[slug]/og-image/route.tsx` foi mantida por compatibilidade, mas os novos metadados usam `/og-image.jpg`.

## Depois de enviar ao GitHub

1. Aguarde o Netlify concluir um novo deploy.
2. Em Netlify > Environment variables, mantenha `NEXT_PUBLIC_APP_URL` como a URL pública atual do site (por exemplo, `https://convniver.netlify.app`). A correção não depende mais exclusivamente dela, mas vale deixá-la correta.
3. Teste diretamente no navegador:
   - `https://convniver.netlify.app/c/theo-rhaian/og-image.jpg`
   Deve abrir uma imagem JPEG.
4. Depois teste o convite:
   - `https://convniver.netlify.app/c/theo-rhaian?v=4`
   O parâmetro é apenas para forçar uma nova tentativa de prévia enquanto o WhatsApp ainda pode ter cache da URL anterior.

Se a rota `/og-image.jpg` abrir a imagem normalmente após o deploy, o HTML da página passará a apontar para essa imagem social otimizada.
