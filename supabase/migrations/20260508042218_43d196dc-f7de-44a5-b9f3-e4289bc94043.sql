CREATE TABLE public.system_automations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'billing', 'support', 'receipt_processing'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'error'
    last_run TIMESTAMP WITH TIME ZONE,
    total_executions INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 100.00,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.automation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    automation_id UUID REFERENCES public.system_automations(id) ON DELETE CASCADE,
    level TEXT NOT NULL, -- 'info', 'warning', 'error'
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Admins only)
CREATE POLICY "Admins can view system_automations" 
ON public.system_automations FOR SELECT 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view automation_logs" 
ON public.automation_logs FOR SELECT 
USING (public.is_admin(auth.uid()));

-- Insert default automation entries
INSERT INTO public.system_automations (name, type, status) VALUES 
('Bot de Cobrança Diária', 'billing', 'active'),
('Agente de Atendimento IA', 'support', 'active'),
('Processador de Comprovantes', 'receipt_processing', 'active');