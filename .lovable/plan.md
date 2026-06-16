# Plano: Simplificar e organizar o app

Objetivo: deixar o app mais fácil de usar e mais limpo, **mantendo 100% das funções**. Abordagem: agrupar melhor (não esconder), reduzir cliques e ruído visual, padronizar cabeçalhos e ações.

## 1. Navegação — Sidebar (desktop) e Bottom Nav (mobile)

**Sidebar (`src/components/Sidebar.tsx`)**
- Consolidar 6 seções → 4: **Visão Geral** (Hoje, Painel, Análises, Relatórios), **Operação** (Clientes, Cobranças, Inadimplência, Cobradores, Portais), **Financeiro** (Carteira, Lucros, Gastos), **Mais** (Comunicação, Ferramentas, Sistema agrupadas, sempre colapsáveis).
- Reduzir tamanhos: ícones 16, padding vertical menor, espaçamento mais compacto → mais itens visíveis sem rolar.
- Remover o mapa de cores por rota (mais simples visualmente) — manter só um tom neutro + accent no ativo.
- Mover busca para `Ctrl/⌘ K` global (já existe `GlobalSearch`) — tirar input do menu para ganhar espaço.
- Botão "Ações rápidas" fixo no topo: Novo cliente, Cobrar agora, Nova nota.

**Bottom Nav mobile (`src/components/MobileBottomNav.tsx`)**
- Manter 5 abas: Hoje, Clientes, Cobranças, Painel, Mais.
- No painel "Mais": reorganizar em 3 grupos consistentes com a sidebar (Visão, Comunicação, Ferramentas, Sistema).
- Adicionar **FAB** (botão flutuante "+") acima da bottom nav para "Novo cliente / Cobrar agora / Anotação".

## 2. Tela "Hoje" (`src/pages/Hoje.tsx`)
- Hero limpo: saudação + KPI principal do dia (a receber hoje, atrasos, recebido) em 3 cards grandes.
- Lista única "O que fazer agora" combinando cobranças do dia + atrasos + tarefas — cada item com 1 ação primária (Cobrar / Marcar pago / WhatsApp).
- Mover atalhos secundários para um rodapé discreto.

## 3. Cadastro de cliente (`src/pages/NovoCliente.tsx`, 1729 linhas)
- Manter wizard de 3 passos, porém:
  - Cabeçalho fixo com stepper visual + botões Voltar/Avançar sempre visíveis.
  - Passo 1 (Cliente): apenas Nome + CPF + Telefone obrigatórios; restante em accordion "Dados complementares".
  - Passo 2 (Empréstimo): presets de modalidade ("Parcelado mensal", "Diário 22 dias", "Só juros mensal") que pré-preenchem campos.
  - Passo 3 (Revisão): card-resumo com edição inline; CTA único "Criar contrato".
- Extrair seções pesadas em sub-componentes em `src/components/onboarding/` (não criar arquivos novos se já existem; preencher os existentes).

## 4. Cobranças (`src/pages/Cobrancas.tsx`, 760 linhas)
- Cabeçalho com chips de filtro rápido: **Hoje · Atrasadas · Próximos 7 dias · Pagas · Todas**.
- Tabela → cards em mobile, tabela densa em desktop.
- Ação primária por linha = botão único "Cobrar" que abre `CobrarAgoraModal`; ações secundárias num menu `⋯`.
- Toolbar: busca + botão "Receber pagamento" como ação primária do topo.

## 5. Padronização global
- `TopBar`: reduzir altura, agrupar KPIs num único pill expansível.
- Componente reutilizável `PageHeader` (título + descrição + ações) aplicado nas 4 páginas acima.
- Espaçamentos: padronizar `py-6 px-4 md:px-6` em todas as páginas.

## 6. Segurança (correções obrigatórias detectadas no scan)
- **profiles**: bloquear escalonamento de privilégio — UPDATE pelo dono não pode alterar `is_admin`, `is_blocked`, `is_chat_blocked` (policy com `WITH CHECK` comparando colunas via trigger ou policy separada).
- **settings**: remover default hardcoded da `whatsapp_api_key`; criar view pública sem colunas sensíveis e revogar SELECT direto dessas colunas (ou mover para tabela `settings_secrets` só acessível por service_role/edge functions).
- **storage uploads**: remover policy de UPDATE anônima em `comprovantes/*` (manter só INSERT) ou exigir validação de token no path.

## Técnico
- Edições focadas; não duplicar componentes existentes.
- Mantém todas as rotas e features — apenas reagrupa/UX.
- Sem mudanças de stack; Tailwind + shadcn + tokens semânticos existentes.
- Migrations SQL apenas para o item 6.

## Fora de escopo
- Redesign visual completo (tema, paleta, fontes) — manter identidade atual.
- Remover páginas ou funções.
