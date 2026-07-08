# QA Report — System Juros

Executado em: 2026-07-08
Escopo: rotas públicas + linter de banco + revisão de edge functions críticas.

## Resumo executivo

| Área | Status |
|---|---|
| Rotas públicas (SEO, render, JS) | ✅ Passa |
| Fluxos autenticados (dashboard, cobranças, etc.) | ⚠️ Não testável automaticamente (ver "Limitações") |
| Segurança do banco (RLS/policies) | ⚠️ 24 avisos do linter, todos revisados abaixo |
| Webhook Hubla | ⚠️ Falta secret `HUBLA_WEBHOOK_TOKEN` |
| Edge functions | ✅ Todas booting sem erros |

## 1. Rotas públicas — Playwright headless

Todas retornaram HTTP 200, sem erros de console, sem requests falhados, com `<title>` e `<meta description>` corretos.

| Rota | H1 | Console errors |
|---|---|---|
| `/` | "Controle a sua operação de Empréstimos." | 0 |
| `/login` | "SYSTEM JUROS — Gestão de Empréstimos" | 0 |
| `/portal-cliente` | "Portal VIP" | 0 |
| `/cobrador-externo` | "Portal do Cobrador" | 0 |
| `/planos` | "Escolha como quer começar hoje" | 0 |
| `/sobre` | "SYSTEM JUROS — Gestão de Empréstimos" | 0 |
| `/reset-password` | "Redefinir Senha" | 0 |
| `/nao-existe-404` | "404" (fallback correto) | 1 (log intencional) |

Screenshots: `/tmp/browser/audit/screenshots/`.

## 2. Linter Supabase (24 warnings)

- **1× Extension in Public** — `pg_trgm` está no schema `public`. Não é bloqueador; mover exige recriar índices. Manter como está.
- **9× SECURITY DEFINER exec por anon** — são as RPCs públicas por design: `portal_client_login`, `portal_client_login_cpf`, `portal_lookup_creditor_contact`, `portal_client_notifications`, `get_signup_checkout_url`, `list_public_profiles`, `search_clients_by_document`, `search_clients_fuzzy`, `get_or_create_dm_thread`. Todas fazem seus próprios checks. Aceitável.
- **13× SECURITY DEFINER exec por authenticated** — `has_role`, `is_admin`, `is_channel_member`, `is_dm_participant`, triggers, etc. São helpers usados dentro de policies; tudo esperado.
- **1× Leaked Password Protection Disabled** ⚠️ **AÇÃO SUA**: ative em Supabase Dashboard → Authentication → Providers → Email → *Leaked password protection*.

## 3. Webhook Hubla

- Código corrigido para ler `HUBLA_WEBHOOK_TOKEN` de env (não mais de `settings`, que era vulnerável a auto-elevação).
- ⚠️ **AÇÃO SUA**: cadastrar o secret `HUBLA_WEBHOOK_TOKEN` (mesmo valor configurado no painel do Hubla). Sem ele, o webhook responde 503 e nenhuma assinatura é ativada.

## 4. Edge functions

Logs recentes de todas estão OK (boot + shutdown normais, sem exceções). Funções críticas revisadas: `hubla-webhook`, `auto-late-fees`, `auto-receipt`, `portal-upload-comprovante`, `client-negotiation`, `whatsapp-send`, `whatsapp-webhook`, `whatsapp-schedule-runner`, `whatsapp-followup`.

## 5. Limitações desta rodada

`LOVABLE_BROWSER_AUTH_STATUS = external_unmanaged` — Lovable não consegue emitir sessão para o Supabase externo deste projeto, então o Playwright não pode entrar nas telas autenticadas (Dashboard, Clientes, Cobranças, Chat, Config, Admin) sem credenciais reais.

Para testar essas áreas eu preciso de **uma das duas opções**:

- (a) Você me envia um par email+senha de teste (usuário com assinatura ativa) que eu uso só para essa rodada; **ou**
- (b) Você mesmo passa em cada tela do app e me diz o que quebra — eu corrijo direto.

## Ações pendentes suas (ordem de prioridade)

1. 🔴 Cadastrar secret `HUBLA_WEBHOOK_TOKEN` (senão nenhum cliente novo consegue assinar).
2. 🟡 Ativar *Leaked Password Protection* no Supabase Auth.
3. 🟡 Escolher (a) ou (b) para eu cobrir as telas autenticadas.
