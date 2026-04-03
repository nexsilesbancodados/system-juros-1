import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Building, Percent, MessageSquare, Webhook, Bell, Save, Plus, Trash2 } from "lucide-react";

const Configuracoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("empresa");

  const { data: settings } = useQuery({
    queryKey: ["settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["message-templates", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("message_templates").select("*").eq("user_id", user!.id).order("trigger_days");
      return data || [];
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({
    company_name: "", company_cnpj: "",
    default_interest_rate: "10", default_late_fee: "2", default_daily_interest: "0.33", default_frequency: "monthly",
    whatsapp_api_url: "", whatsapp_api_key: "", whatsapp_instance: "",
    n8n_webhook_url: "", push_notifications_enabled: false,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name || "",
        company_cnpj: settings.company_cnpj || "",
        default_interest_rate: String(settings.default_interest_rate || 10),
        default_late_fee: String(settings.default_late_fee || 2),
        default_daily_interest: String(settings.default_daily_interest || 0.33),
        default_frequency: settings.default_frequency || "monthly",
        whatsapp_api_url: settings.whatsapp_api_url || "",
        whatsapp_api_key: settings.whatsapp_api_key || "",
        whatsapp_instance: settings.whatsapp_instance || "",
        n8n_webhook_url: settings.n8n_webhook_url || "",
        push_notifications_enabled: settings.push_notifications_enabled || false,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      company_name: form.company_name || null,
      company_cnpj: form.company_cnpj || null,
      default_interest_rate: parseFloat(form.default_interest_rate),
      default_late_fee: parseFloat(form.default_late_fee),
      default_daily_interest: parseFloat(form.default_daily_interest),
      default_frequency: form.default_frequency,
      whatsapp_api_url: form.whatsapp_api_url || null,
      whatsapp_api_key: form.whatsapp_api_key || null,
      whatsapp_instance: form.whatsapp_instance || null,
      n8n_webhook_url: form.n8n_webhook_url || null,
      push_notifications_enabled: form.push_notifications_enabled,
    };

    const { error } = settings
      ? await supabase.from("settings").update(payload).eq("user_id", user.id)
      : await supabase.from("settings").insert(payload);

    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Configurações salvas!" });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    }
  };

  // Template management
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "", trigger_days: "" });

  const handleAddTemplate = async () => {
    if (!user || !newTemplate.name || !newTemplate.content) return;
    const { error } = await supabase.from("message_templates").insert({
      user_id: user.id,
      name: newTemplate.name,
      content: newTemplate.content,
      trigger_days: newTemplate.trigger_days ? parseInt(newTemplate.trigger_days) : null,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Template adicionado!" });
      setNewTemplate({ name: "", content: "", trigger_days: "" });
      queryClient.invalidateQueries({ queryKey: ["message-templates"] });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    await supabase.from("message_templates").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["message-templates"] });
  };

  const inputCls = "w-full px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const tabs = [
    { id: "empresa", label: "Empresa", icon: <Building size={16} /> },
    { id: "padroes", label: "Padrões", icon: <Percent size={16} /> },
    { id: "whatsapp", label: "WhatsApp", icon: <MessageSquare size={16} /> },
    { id: "templates", label: "Templates", icon: <MessageSquare size={16} /> },
    { id: "webhooks", label: "Webhooks", icon: <Webhook size={16} /> },
    { id: "notificacoes", label: "Notificações", icon: <Bell size={16} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Personalize o sistema</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
          <Save size={16} /> {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        {tab === "empresa" && (
          <>
            <h2 className="font-semibold text-foreground">Dados da Empresa</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da Empresa</label>
                <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Minha Empresa" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ</label>
                <input value={form.company_cnpj} onChange={(e) => setForm({ ...form, company_cnpj: e.target.value })} placeholder="00.000.000/0001-00" className={inputCls} />
              </div>
            </div>
          </>
        )}

        {tab === "padroes" && (
          <>
            <h2 className="font-semibold text-foreground">Valores Padrão para Novos Contratos</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Taxa de Juros (%)</label>
                <input type="number" value={form.default_interest_rate} onChange={(e) => setForm({ ...form, default_interest_rate: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Multa por Atraso (%)</label>
                <input type="number" value={form.default_late_fee} onChange={(e) => setForm({ ...form, default_late_fee: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Juros Diário Atraso (%)</label>
                <input type="number" step="0.01" value={form.default_daily_interest} onChange={(e) => setForm({ ...form, default_daily_interest: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Frequência Padrão</label>
                <select value={form.default_frequency} onChange={(e) => setForm({ ...form, default_frequency: e.target.value })} className={inputCls}>
                  <option value="daily">Diário</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </div>
            </div>
          </>
        )}

        {tab === "whatsapp" && (
          <>
            <h2 className="font-semibold text-foreground">Integração WhatsApp (Evolution API)</h2>
            <p className="text-xs text-muted-foreground">Configure a API para envio automático de mensagens.</p>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">URL da API</label>
                <input value={form.whatsapp_api_url} onChange={(e) => setForm({ ...form, whatsapp_api_url: e.target.value })} placeholder="https://api.exemplo.com" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">API Key</label>
                <input type="password" value={form.whatsapp_api_key} onChange={(e) => setForm({ ...form, whatsapp_api_key: e.target.value })} placeholder="••••••••" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da Instância</label>
                <input value={form.whatsapp_instance} onChange={(e) => setForm({ ...form, whatsapp_instance: e.target.value })} placeholder="minha-instancia" className={inputCls} />
              </div>
            </div>
          </>
        )}

        {tab === "templates" && (
          <>
            <h2 className="font-semibold text-foreground">Templates de Mensagem</h2>
            <p className="text-xs text-muted-foreground mb-4">Modelos de cobrança automática. Use [Nome], [Valor], [Dias] como variáveis.</p>
            <div className="space-y-3">
              {templates.map((t: any) => (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.content}</p>
                    {t.trigger_days && <p className="text-xs text-primary mt-1">Dispara após {t.trigger_days} dia(s) de atraso</p>}
                  </div>
                  <button onClick={() => handleDeleteTemplate(t.id)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4 mt-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Novo Template</p>
              <input value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} placeholder="Nome do template" className={inputCls} />
              <textarea value={newTemplate.content} onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })} placeholder="Olá [Nome], sua parcela de R$ [Valor] está atrasada há [Dias] dias..." className={`${inputCls} min-h-[80px]`} />
              <input type="number" value={newTemplate.trigger_days} onChange={(e) => setNewTemplate({ ...newTemplate, trigger_days: e.target.value })} placeholder="Dias de atraso para disparar (opcional)" className={inputCls} />
              <button onClick={handleAddTemplate} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground"><Plus size={14} /> Adicionar</button>
            </div>
          </>
        )}

        {tab === "webhooks" && (
          <>
            <h2 className="font-semibold text-foreground">N8N / Webhooks</h2>
            <p className="text-xs text-muted-foreground">Integre com automações externas.</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">URL do Webhook N8N</label>
              <input value={form.n8n_webhook_url} onChange={(e) => setForm({ ...form, n8n_webhook_url: e.target.value })} placeholder="https://n8n.exemplo.com/webhook/..." className={inputCls} />
            </div>
          </>
        )}

        {tab === "notificacoes" && (
          <>
            <h2 className="font-semibold text-foreground">Notificações Push</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setForm({ ...form, push_notifications_enabled: !form.push_notifications_enabled })}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.push_notifications_enabled ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.push_notifications_enabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
              <span className="text-sm text-foreground">{form.push_notifications_enabled ? "Ativadas" : "Desativadas"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Configuracoes;
