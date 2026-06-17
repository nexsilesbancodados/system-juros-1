Vou aplicar por etapas, cada uma com migration/código e aprovação. Aqui está o escopo completo organizado em 4 etapas independentes.

## Estado atual relevante

- **Bot WhatsApp** (`whatsapp-webhook`) já é robusto: usa **Claude Sonnet 4.5** (não DeepSeek), tem memória JSON por cliente (`clients.bot_memory`), debounce, lock, rate-limit, validação de comprovante com hash anti-reuso, validação de PIX, horário comercial e handoff por palavra-chave. Faltam: **function calling real** (hoje tudo é JSON livre), **busca semântica do histórico longo** e **handoff visível** (status na conversa + notificação clara).
- **Chat IA admin** (`agent-chat`, 155 linhas) é minimalista. Faltam ferramentas e contexto agregado.
- **Portal cliente** (`PortalCliente.tsx`) hoje só lista contratos. Sem autoatendimento via IA.
- **Suporte** (`Suporte.tsx`, tickets) sem IA de triagem.
- **Sidebar** tem ~30 itens em 6 seções, vários só fazem sentido para admin/poder.

---

## Etapa 1 — Bot WhatsApp: function calling + handoff visível + memória robusta

**Migration**
- `whatsapp_conversations`: adicionar `human_takeover_at timestamptz`, `human_takeover_reason text`, `bot_status text default 'active'` (active/paused/handoff).
- Tabela nova `bot_actions_log` (auditoria de tool calls do bot): `id, user_id, client_id, conversation_id, tool_name, tool_input jsonb, tool_output jsonb, success bool, created_at`. RLS + GRANTs.
- Índice em `whatsapp_messages(conversation_id, created_at desc)` para histórico longo (se ainda não existir).

**Código (`whatsapp-webhook/index.ts`)**
- Migrar para **tool use nativo da Anthropic** com 6 ferramentas server-side executadas com `supabase` (service role):
  1. `consultar_parcelas_pendentes(client_id)` — devolve parcelas vencidas/de hoje formatadas.
  2. `gerar_link_pix(client_id, valor, descricao)` — usa `profile.pix_key`.
  3. `registrar_promessa_pagamento(client_id, data, valor, contexto)` — grava em `audit_logs` + `bot_memory.promessas`.
  4. `marcar_comprovante_recebido(installment_ids[], valor, data)` — só com `trustedReceipt`.
  5. `oferecer_renovacao(contract_id)` — devolve cálculo de rolagem.
  6. `escalar_para_humano(motivo)` — seta `bot_status='handoff'`, `human_takeover_at=now()`, cria notificação dedicada e pausa o bot.
- Manter o JSON de saída final como `final_reply` (compatibilidade com sanitização/validação atual).
- Adicionar `getRelevantHistory()`: além das últimas 20 msgs, busca por similaridade simples (ilike de palavras-chave) nas últimas 200 msgs do cliente.

**UI**
- `WhatsAppInbox.tsx`: badge "🚨 Aguardando humano" quando `bot_status='handoff'`, botão "Reassumir bot" que limpa o handoff.
- Botão "Ver ações do bot" → modal lendo `bot_actions_log`.

## Etapa 2 — Limpeza do app (menu, módulos, configurações)

**Sidebar (`src/components/Sidebar.tsx`)**
Novo menu enxuto por padrão (usuário comum):
- **Visão Geral**: Hoje, Painel, Análises
- **Operação**: Clientes, Cobranças, Inadimplência
- **Financeiro**: Carteira, Lucros, Gastos
- **Comunicação**: Comunicação & IA, Inbox WhatsApp
- **Mais** (collapsible default fechado): Cobradores, Portais, Relatórios, Simulador, Metas, Tarefas, Anotações, Planilha, Chat interno
- **Sistema** (só is_admin OU is_super_admin): Configurações, Suporte, Histórico, Auditoria, Admin, Automações

Itens removidos do menu padrão (continuam existindo via rota direta): Puxada de Dados, TV Mode, QR Code page (acessível pelo card de Portais).

**Configurações (`Configuracoes.tsx`)**
- Agrupar em tabs: **Essencial** (empresa, PIX, logo) | **WhatsApp & Bot** | **Cobrança** (multa, juros, automações) | **Avançado** (webhooks, secrets, API URLs, branding técnico, portal externo).
- "Avançado" fica colapsado atrás de um disclosure.

**Módulos opcionais** (`settings.modules_enabled jsonb`)
- Migration: adicionar coluna `modules_enabled jsonb default '{"pledges":false,"rentals":false,"vehicles":false,"stock":false}'`.
- Rotas `Penhores/Aluguéis/Veículos/Estoque` (se existirem) só aparecem se ligadas em Configurações → Módulos.

## Etapa 3 — Portal do cliente: autoatendimento com IA

**Edge function `portal-assistant`**
- Recebe `{client_id, question, session_token}` validado contra `client_tokens`.
- Carrega contratos/parcelas + memória + PIX do dono.
- Chama Claude com tools restritas: `consultar_minhas_parcelas`, `gerar_pix_de_parcela`, `solicitar_renegociacao` (cria notificação para o admin, não negocia sozinho).
- Resposta sempre em PT-BR, tom institucional.

**UI** (`PortalCliente.tsx`)
- Novo card "Assistente" com chat enxuto (AI Elements-like, mas sem deps novas — usar `MessageBubble` existente).
- Limite de mensagens por sessão (20).

## Etapa 4 — Suporte: triagem automática de tickets

**Edge function `support-triage`**
- Trigger: novo `support_tickets` criado por user.
- Classifica: categoria (`bug|duvida|financeiro|whatsapp|outro`), severidade (`low|med|high`), sugere resposta inicial.
- Grava em `support_tickets.ai_category`, `ai_severity`, `ai_suggested_reply`.
- Migration adiciona essas colunas.

**UI `Suporte.tsx`** (admin)
- Mostra etiquetas IA, botão "Usar sugestão" preenche o textarea.

---

## Ordem proposta
**1 → 2 → 3 → 4**, com aprovação de migration em cada etapa.

Vou começar pela **Etapa 1**. Confirme para eu seguir, ou diga se quer reordenar / remover alguma etapa.