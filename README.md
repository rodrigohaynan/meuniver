# Meu Convite — Plataforma multiusuário de convites

MVP baseado nos conceitos do convite da Liene, transformado em uma plataforma para vários usuários.

## O que já está incluído

- Splash/landing page.
- Cadastro e login por e-mail e senha via Supabase Auth.
- Google, Facebook, telefone/SMS e demais provedores externos desativados nesta fase de testes.
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

1. Crie um projeto no Supabase.
2. Abra `SQL Editor`.
3. Execute o arquivo `supabase/schema.sql`.
4. Em Authentication > URL Configuration:
   - Site URL: URL do seu site.
   - Redirect URLs: adicione `https://SEU-SITE/auth/callback` e `http://localhost:3000/auth/callback`.
5. Em Authentication > Providers, deixe somente **Email** ativado para o MVP.
6. Deixe Google, Facebook, Phone/SMS e demais provedores externos desativados.

### Testes sem serviço de e-mail externo

Durante os primeiros testes, é possível desativar temporariamente a exigência de confirmação de e-mail no Supabase. Isso permite criar contas e entrar imediatamente apenas com e-mail e senha. Para uso público, a recomendação é reativar a confirmação e configurar um serviço de envio de e-mail apropriado.

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

## Login social

A plataforma foi estruturada para permitir provedores sociais no futuro, mas eles ficam desativados na fase de testes para manter o MVP sem custos e sem dependências externas desnecessárias.

## Nome

"Meu Convite" é um nome provisório no MVP. Ele pode ser substituído por uma marca definitiva depois.
