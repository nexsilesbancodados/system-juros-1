# Auditoria funcional completa do System Juros

Objetivo: rodar um "smoke test" ponta a ponta em todas as áreas do app, registrar o que funciona e o que quebra, e entregar um relatório priorizado com correções aplicadas em seguida.

## Como vou testar

1. **Linter do banco** — `supabase--linter` para achar RLS aberto, policies frouxas, colunas sensíveis expostas.
2. **Playwright headless no preview local** (`http://localhost:8080`) — script único que percorre os fluxos, tira screenshots e captura erros de console / rede.
3. **Testes de edge functions** — `supabase--test_edge_functions` nas funções críticas (hubla-webhook, auto-late-fees, portal-upload-comprovante, client-negotiation, whatsapp-send).
4. **Leitura de logs** — edge function logs das funções que falharem.

## Escopo dos fluxos (o que o Playwright vai cobrir)

**Área pública / SEO**
- Landing `/` — hero, pricing, CTA, footer, meta tags, sitemap/robots.
- Login `/login` — form, validação, link recuperar senha.
- Portal cliente `/portal-cliente` — login CPF+data.
- Cobrador externo `/cobrador-externo` — login por token.

**Área autenticada (sessão Supabase injetada)**
- Dashboard — KPIs, gráficos, briefing.
- Clientes — listar, buscar, abrir detalhe, criar novo.
- Empréstimo/Contrato — simulador, criar contrato, ver parcelas.
- Cobranças — Kanban, Calendar, marcar como pago, cobrar agora.
- Inadimplência — lista, aplicar multa/juros.
- Chat interno + WhatsApp Inbox — abrir conversa.
- Configurações — Hubla, WhatsApp, Portal branding, PIX.
- Assinatura/Planos — checkout Hubla, tela "assinatura necessária".
- Admin (se aplicável) — support inbox, users.

**Edge functions críticas**
- `hubla-webhook` — assinatura de token, ativar sub, e-mail Brevo.
- `auto-late-fees` — recalcular multa/juros, gerar notificação.
- `portal-client-login` / `portal-client-notifications` — RPC.
- `client-negotiation` — proposta cliente.
- `whatsapp-send` / `whatsapp-webhook` — envio e recebimento.

## Entregável

Um relatório em `QA-REPORT.md` com:
- ✅ Passou / ⚠️ Aviso / ❌ Quebrou por fluxo.
- Screenshots dos pontos críticos em `/tmp/browser/audit/`.
- Lista de bugs encontrados, ordenada por severidade (bloqueia venda → cosmético).
- Correções aplicadas imediatamente para tudo que for **bloqueador** (ex.: tela branca, RLS aberta, webhook 500, checkout quebrado).
- Correções não-bloqueadoras ficam listadas para você aprovar antes de eu mexer.

## Suposições

- Vou usar a sessão Supabase gerenciada do preview (auth injetada) para as rotas autenticadas. Se `LOVABLE_BROWSER_AUTH_STATUS` estiver `signed_out`, peço pra você logar uma vez no preview.
- Não vou disparar cobranças reais no WhatsApp / Hubla (sandbox / mocks quando aplicável).
- `HUBLA_WEBHOOK_TOKEN` ainda não está salvo — vou testar o webhook validando que ele responde 503 corretamente sem o secret, e deixar o teste completo pra depois que você cadastrar.

## Tempo estimado

Rodada 1 (auditoria + fixes bloqueadores): ~15–25 min de execução minha.

Aprova?
