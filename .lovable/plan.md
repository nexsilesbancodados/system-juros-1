
# Plano de Melhorias — SYSTEM JUROS

Auditoria rápida revelou os principais pontos a atacar:

- **Sidebar com 30+ itens** em 5 seções, com sobreposição (`/comunicacao`, `/comunicacao/inbox`, `/chat`, `/notificacoes`) — sobrecarga cognitiva.
- **Páginas gigantes**: `AgenteIA.tsx` (1835 linhas), `WhatsAppInbox.tsx` (861), `Clientes.tsx` (790), `Cobrancas.tsx` (760), `Dashboard.tsx` (625) — impacto direto em carregamento e manutenção.
- **Sem code-splitting por rota** — bundle inicial carrega tudo.
- **Mobile**: bottom nav existe, mas páginas pesadas não estão otimizadas para toque/scroll.
- **Refinamento visual** já está em bom nível (glassmorphism, paleta metálica), mas há ruído visual (cores de ícone por rota muito variadas, badges duplicados).

---

## Fase 1 — Navegação & Layout (alta prioridade)

**1.1 Reorganizar sidebar (5 → 4 seções, ~24 itens)**
- Mesclar **"Comunicação & IA" + "Inbox WhatsApp" + "Chat"** em um único hub `/comunicacao` com abas internas (Inbox, Chat interno, Agente IA, Configurações WA).
- Mover **Simulador, Metas, Tarefas, Anotações, Planilha, Puxada de Dados** para um único item **"Ferramentas"** com submenu expansível (já há padrão `/ferramentas/*`).
- Promover **Portais (QR Code)** para Operações.
- Remover **Notificações** do menu (já existe sino na TopBar).
- Unificar paleta de cores dos ícones em **3 tons** (primário/sucesso/alerta) em vez de 20 cores diferentes.

**1.2 TopBar mais funcional**
- Adicionar **breadcrumb compacto** à esquerda (já existe componente `Breadcrumbs.tsx`, integrar).
- Quick actions: "+ Novo Cliente", "+ Cobrança", busca global (Cmd+K já existe via `GlobalSearch`).

**1.3 Mobile**
- Bottom nav com 5 itens fixos: Hoje, Clientes, Cobranças, Comunicação, Mais.
- Botão FAB central "+" para ação rápida (novo cliente/cobrança).
- Páginas grandes (Clientes, Cobranças) ganham **filtros em sheet/drawer** no mobile em vez de barras horizontais.

---

## Fase 2 — Performance

**2.1 Code-splitting por rota**
- Converter rotas em `src/App.tsx` para `React.lazy()` + `<Suspense>`.
- Ganho estimado: bundle inicial -40 a -60%.

**2.2 Quebrar componentes grandes**
- `AgenteIA.tsx` (1835 → ~300 + módulos): separar Memória, Treinamento, Histórico, Configurações.
- `WhatsAppInbox.tsx` (861 → ~250 + subcomponentes): lista de conversas, painel de chat, painel de detalhes.
- `Clientes.tsx` / `Cobrancas.tsx`: extrair tabela, filtros e modais.

**2.3 Queries**
- Padronizar `staleTime`/`gcTime` no QueryClient para listas pesadas (clientes, cobranças) — evita refetch desnecessário ao trocar de aba.
- Virtualizar listas longas em Clientes/Cobranças/Inbox (`@tanstack/react-virtual`).
- Realtime: auditar `useRealtimeSubscription` para garantir cleanup (já está documentado, validar uso).

---

## Fase 3 — Refinamento Visual

**3.1 Consistência de tokens**
- Auditar `text-white`, `bg-[#...]` em componentes — mover para tokens semânticos.
- Padronizar 1 sistema de "card" (glass card) com 3 variantes (default, elevated, interactive).

**3.2 Estados vazios e loading**
- `EmptyState` já existe — aplicar consistentemente em Clientes/Cobranças/Inbox/Tarefas.
- Skeletons em vez de spinners nas tabelas principais.

**3.3 Densidade**
- Compactar TopBar KPIs em mobile (carrossel horizontal de 1 card visível).
- Reduzir padding excessivo em cards do Dashboard.

---

## Fase 4 — Novas Funcionalidades (curtas)

- **Command Palette estendido** (Cmd+K): ações além de busca — "criar cliente", "marcar pago", "abrir conversa de X".
- **Atalhos de teclado documentados** (`KeyboardShortcutsHelp` já existe, expandir).
- **Pin/Favoritos** de clientes para acesso rápido na sidebar.
- **Modo foco** no Inbox WhatsApp (esconde sidebar automaticamente).

---

## Ordem sugerida de execução

Faria em **passos pequenos e validáveis**, começando pelo que dá mais ganho percebido:

1. **Reorganizar sidebar** (Fase 1.1) — 1 passo, alto impacto visual e cognitivo.
2. **Code-splitting de rotas** (Fase 2.1) — 1 passo, ganho de performance imediato.
3. **Quebrar AgenteIA.tsx** (Fase 2.2 parte 1) — destrava manutenção da página mais pesada.
4. **Hub de Comunicação unificado** (Fase 1.1 parte 2) — abas internas.
5. Demais itens conforme prioridade.

---

## Pergunta antes de começar

Quer que eu **comece pelos passos 1 e 2 já** (reorganizar sidebar + code-splitting), que dão ganho imediato e são reversíveis? Ou prefere atacar uma área específica primeiro (ex.: só Inbox WhatsApp, só Dashboard)?
