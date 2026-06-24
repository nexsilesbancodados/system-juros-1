## Plano: 4 micro-cirurgias de UI

Executar em 4 fases curtas e independentes. Sem mexer em lógica de negócio — só presentation/UX.

### Fase 1 — Modais grandes (Cliente / Pagamento / Parcela)
Padronizar `DialogContent` dos 3 modais principais:
- `src/components/QuickPaymentModal.tsx`
- `src/components/CobrarAgoraModal.tsx`
- Dialog de parcela dentro de `src/pages/ClienteDetalhe.tsx`

Regras unificadas:
- `max-w-2xl` desktop, `w-[calc(100vw-1rem)]` mobile
- `max-h-[90vh]` com `overflow-y-auto` no corpo
- Header sticky (`sticky top-0 bg-background/95 backdrop-blur z-10`)
- Footer sticky em modais com ações
- `gap-4` consistente entre seções

### Fase 2 — MobileBottomNav polish
`src/components/MobileBottomNav.tsx`:
- `pb-[env(safe-area-inset-bottom)]`
- Ícones `size={20}` uniformes
- Estado ativo: pill `bg-primary/15` + `text-primary` + indicador superior 2px
- Labels `text-[10px] font-medium`, truncadas
- Haptic-like scale: `active:scale-95 transition-transform`

### Fase 3 — Sidebar desktop
`src/components/Sidebar.tsx`:
- Agrupar itens em seções visuais (Operação / Financeiro / Configuração) com label `text-[10px] uppercase tracking-wider text-muted-foreground/60`
- Reduzir densidade vertical: `py-2` → `py-1.5`, `gap-3` → `gap-2.5`
- Estado ativo com barra lateral 2px à esquerda
- Tooltip nos itens quando colapsada (já existe o mecanismo de collapse — só refinar)

### Fase 4 — Configurações: split por aba
`src/pages/Configuracoes.tsx` (2029 linhas) — quebrar em subcomponentes por aba dentro de `src/components/configuracoes/`:
- `EmpresaTab.tsx`
- `PortalTab.tsx`
- `WhatsAppTab.tsx`
- `IATab.tsx`
- `IntegracoesTab.tsx`
- `AssinaturaTab.tsx`

`Configuracoes.tsx` vira shell com `<Tabs>` + lazy imports. Nenhuma mudança de schema/RLS/edge.

### Detalhes técnicos
- Tokens semânticos do `index.css` apenas (sem cores hard-coded)
- Sem novas deps
- Sem migrações
- Verificação por fase: build + screenshot Playwright (mobile 390px + desktop 1440px) para Fases 1-3; render check para Fase 4

### Ordem de entrega
Fase 1 → confirmar → Fase 2 → confirmar → Fase 3 → confirmar → Fase 4 (a maior, pode demorar 2-3 turnos).