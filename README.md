# Meu Convite — Plataforma multiusuário de convites

MVP baseado nos conceitos do convite da Liene, transformado em uma plataforma para vários usuários.

## O que já está incluído

- Splash/landing page.
- Cadastro e login por e-mail e senha.
- Login com Google e Facebook via Supabase Auth.
- Painel "Meus convites".
- Criação de vários convites por usuário.
- Modelos adulto e infantil.
- Paletas de cores prontas.
- Layouts Elegante, Moderno e Infantil.
- Editor de título, aniversariante, idade, data, horário, local, endereço, texto e observação de RSVP.
- Upload da foto principal.
- Publicar/despublicar convite.
- URL pública individual `/c/seu-slug`.
- Lista de presentes por convite.
- Link de sugestão por presente.
- Foto manual do presente com prioridade sobre imagem do link.
- Imagem automática do link usando uma rota isolada por presente.
- Reserva de presente sem expor ao público quem reservou.
- RSVP com adulto/criança.
- Área de respostas no editor.
- RLS do Supabase para separar os dados de cada usuário.

## 1. Criar o projeto Supabase

1. Crie um projeto em https://supabase.com.
2. Abra `SQL Editor`.
3. Execute o arquivo `supabase/schema.sql`.
4. Em Authentication > URL Configuration:
   - Site URL: URL do seu site.
   - Redirect URLs: adicione `https://SEU-SITE/auth/callback` e `http://localhost:3000/auth/callback`.
5. Em Authentication > Providers, habilite Google e Facebook e informe as credenciais de cada provedor.

## 2. Variáveis no Netlify

Copie os valores de `env.example` e configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`

## 3. Instalar localmente

```bash
npm install
npm run dev
```

## 4. Deploy

No Netlify, conecte o repositório e faça o deploy normalmente. O projeto usa Next.js 16 e Node 22.

## Observação importante sobre login social

O código dos botões Google/Facebook já está pronto. Eles só funcionarão depois que os provedores forem habilitados no painel do Supabase e as credenciais OAuth forem cadastradas.

## Nome

"Meu Convite" é um nome provisório no MVP. Ele pode ser substituído por uma marca definitiva depois.
