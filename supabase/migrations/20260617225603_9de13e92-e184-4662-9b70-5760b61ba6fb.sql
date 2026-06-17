ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS modules_enabled jsonb NOT NULL DEFAULT jsonb_build_object(
  'analises', true,
  'relatorios', true,
  'inadimplencia', true,
  'cobradores', true,
  'portais', true,
  'lucros', true,
  'gastos', true,
  'comunicacao_inbox', true,
  'chat_interno', true,
  'simulador', true,
  'metas', true,
  'tarefas', true,
  'anotacoes', true,
  'planilha', true,
  'puxada_dados', true,
  'penhores', false,
  'veiculos', false,
  'alugueis', false,
  'estoque', false
);