# Arquitetura e próximos passos

## Estrutura atual do MVP

**Autenticação**
- Supabase Auth.
- E-mail e senha ativados.
- Google OAuth desativado nesta fase.
- Facebook OAuth desativado nesta fase.
- Telefone/SMS e demais provedores externos desativados.
- Sessão protegida por cookies SSR.

**Dados**
- `invitations`: um usuário pode criar vários convites.
- `gifts`: presentes vinculados ao convite.
- `rsvps`: confirmações vinculadas ao convite.
- `gift_reservations`: identidade de quem escolheu presente, visível somente ao dono.

**Segurança**
- Row Level Security (RLS).
- Cada usuário autenticado só edita seus próprios convites.
- Convidados só enxergam convites publicados.
- Convidados não conseguem consultar nomes de quem reservou presentes.

**Mídia**
- Supabase Storage em `invite-media`.
- Foto principal do convite.
- Foto manual por presente.
- Imagem automática de link isolada por ID do presente.

## Próximas evoluções recomendadas

1. **Modelos premium**
   - Mais layouts.
   - Fontes por tema.
   - Fundos com ilustrações.
   - Temas de personagens sem infringir direitos autorais.

2. **Editor avançado**
   - Ordenar seções por arrastar.
   - Ativar/desativar blocos.
   - Alterar título de cada seção.
   - Fontes e tamanhos.
   - Galeria de fotos.

3. **Admin da plataforma**
   - Usuários.
   - Convites ativos.
   - Assinaturas.
   - Templates.
   - Relatórios.

4. **Monetização**
   - Plano gratuito.
   - Plano por convite.
   - Plano mensal.
   - Domínio/slug premium.
   - Convite sem marca d'água.

5. **Recursos de festa**
   - Lista de mesas.
   - Check-in por QR Code.
   - Lembrete automático.
   - Mensagens no WhatsApp, apenas quando houver integração com custo/consentimento definidos.
   - Lista de presentes com PIX opcional.
   - Álbum colaborativo após a festa.

6. **Provedores de login futuros**
   - Google.
   - Facebook.
   - Apple.
   - Telefone/SMS.
   - Habilitar somente quando houver necessidade real, configuração concluída e custo conhecido.

7. **Outros eventos**
   - Casamento.
   - Chá revelação.
   - Chá de bebê.
   - 15 anos.
   - Formatura.
   - Bodas.
