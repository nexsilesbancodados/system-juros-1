## Plano: Melhorar as Ferramentas

O escopo é amplo (4 áreas × 4 tipos de melhoria). Para entregar valor real sem virar refactor infinito, priorizo o que mais incomoda hoje e empilho em 4 lotes independentes.

### Lote 1 — Hub de Ações do Cliente (ClienteDetalhe)

Hoje as 17+ ferramentas estão espalhadas: 3 botões no topo (Editar / "...") + 3 botões no meio (Novo / Quitar / Cobrar) + ações dentro de cada parcela + ações dentro de cada contrato. Custa achar.

**O que muda:**
- Substituir o menu "..." por um **painel lateral "Ferramentas"** (Sheet) agrupado por categoria:
  - **Contrato** — Novo Empréstimo, Quitar Todas, Editar Cliente, Excluir
  - **Cobrança** — Cobrar Todas Atrasadas, Enviar Portal, Lembrete WhatsApp, Renegociar
  - **Documentos** — Gerar PDF, Exportar Resumo, Copiar Dados, Imprimir
  - **Score & Status** — Score +50/-50, IA Score, Inativar/Reativar
- Cada ação com ícone + label + descrição curta (1 linha) — fica óbvio o que faz.
- Botão flutuante "Ações" no header (sempre visível) abre o painel.
- Mantém atalhos primários no hero: Novo Empréstimo, Quitar Todas, Cobrar.
- **Novas ações úteis** que faltam hoje:
  - "Duplicar último empréstimo" (renovação rápida)
  - "Marcar contato realizado" (registra interação manual)
  - "Adicionar anotação rápida" (sem sair da tela)

### Lote 2 — Paleta de Comando Global (Cmd+K)

`GlobalSearch.tsx` já existe mas só busca clientes. Expandir para command palette real:
- **Ações** ("Criar cliente", "Novo empréstimo", "Ir para Inadimplência", "Backup agora")
- **Navegação** (todas as 30+ páginas)
- **Clientes** (busca atual)
- **Contratos** por número/valor
- Atalho `Cmd/Ctrl + K` global + dica visual na TopBar.

### Lote 3 — Limpeza de Duplicações

Auditar e remover/fundir:
- `Automacoes.tsx` (vazia, redireciona) → deletar arquivo
- `Notificacoes.tsx` vs `NotificationsBell.tsx` → manter só o sino
- `Suporte.tsx` + `Sobre.tsx` → fundir em "Ajuda"
- `Hoje.tsx` vs `Dashboard.tsx` → avaliar se "Hoje" agrega
- `BuscarClientes.tsx` → remove (Cmd+K substitui)
- Sidebar: reordenar por frequência de uso real (Hoje → Clientes → Cobranças → Financeiro → resto colapsado)

### Lote 4 — Ferramentas de Cobrança e Financeiro

- **Cobranças**: adicionar ação em lote "Enviar para todos selecionados" (checkbox + bulk action bar fixa no rodapé).
- **Inadimplência**: botão "Renegociar em massa" abrindo wizard.
- **Financeiro**: exportar CSV/Excel dos KPIs visíveis, filtro de período salvável como preset.
- **TopBar KPIs**: tornar clicáveis (clicar em "Em Atraso" leva a Inadimplência filtrada).

### Ordem de execução

Implemento na ordem 1 → 2 → 3 → 4, cada lote testável de forma independente. Posso parar entre lotes para você revisar.

### Detalhes técnicos

- Sheet do shadcn para o painel de ações (já instalado).
- Command (cmdk via shadcn) para paleta — instalar se faltar.
- Sem migrações de banco neste plano (só UI/rotas/components).
- Nenhuma mudança em RLS, Edge Functions, ou lógica de cálculo de empréstimo.

### Pergunta antes de começar

Quer que eu execute **todos os 4 lotes em sequência**, ou prefere ir **um lote por vez** com sua aprovação entre cada um?
