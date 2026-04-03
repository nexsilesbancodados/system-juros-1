import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Building, Percent, MessageSquare, Webhook, Bell, Save, Plus, Trash2, Check, AlertTriangle } from "lucide-react";

const Configuracoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
      company_name: form.company_name || null, company_cnpj: form.company_cnpj || null,
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
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      toast({ title: "✓ Configurações salvas!" });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    }
  };

  const [newTemplate, setNewTemplate] = useState({ name: "", content: "", trigger_days: "" });
  const handleAddTemplate = async () => {
    if (!user || !newTemplate.name || !newTemplate.content) return;
    const { error } = await supabase.from("message_templates").insert({
      user_id: user.id, name: newTemplate.name, content: newTemplate.content,
      trigger_days: newTemplate.trigger_days ? parseInt(newTemplate.trigger_days) : null,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "✓ Template adicionado!" });
      setNewTemplate({ name: "", content: "", trigger_days: "" });
      queryClient.invalidateQueries({ queryKey: ["message-templates"] });
    }
  };
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    await supabase.from("message_templates").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["message-templates"] });
  };

  const inputCls = "w-full px-4 py-2.5 rounded-2xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground input-enhanced";

  const tabs = [
    { id: "empresa", label: "Empresa", icon: Building },
    { id: "padroes", label: "Padrões", icon: Percent },
    { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
    { id: "templates", label: "Templates", icon: MessageSquare },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "notificacoes", label: "Notificações", icon: Bell },
  ];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings size={22} className="text-primary" /> Configurações
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Personalize o sistema</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 focus-ring ${
            saved ? "bg-success text-success-foreground" : "text-primary-foreground"
          }`}
          style={saved ? {} : { background: "var(--gradient-button)" }}>
          {saved ? <><Check size={16} /> Salvo!</> : saving ? "Salvando..." : <><Save size={16} /> Salvar</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="pill-tabs animate-fade-in overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`pill-tab gap-1.5 whitespace-nowrap ${tab === t.id ? "pill-tab-active" : "pill-tab-inactive"}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 animate-fade-in card-shine">
        {tab === "empresa" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><Building size={16} className="text-primary" /></div>
              <h2 className="font-semibold text-foreground">Dados da Empresa</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="text-label mb-1.5 block">Nome da Empresa</label><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Minha Empresa" className={inputCls} /></div>
              <div><label className="text-label mb-1.5 block">CNPJ</label><input value={form.company_cnpj} onChange={(e) => setForm({ ...form, company_cnpj: e.target.value })} placeholder="00.000.000/0001-00" className={inputCls} /></div>
            </div>
          </>
        )}

        {tab === "padroes" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><Percent size={16} className="text-primary" /></div>
              <h2 className="font-semibold text-foreground">Valores Padrão para Novos Contratos</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-label mb-1.5 block">Multa Diária (%)</label><input type="number" step="0.01" value={form.default_daily_interest} onChange={(e) => setForm({ ...form, default_daily_interest: e.target.value })} className={inputCls} /></div>
              <div><label className="text-label mb-1.5 block">Multa Mensal (%)</label><input type="number" value={form.default_late_fee} onChange={(e) => setForm({ ...form, default_late_fee: e.target.value })} className={inputCls} /></div>
              <div className="col-span-2">
                <label className="text-label mb-1.5 block">Frequência Padrão</label>
                <select value={form.default_frequency} onChange={(e) => setForm({ ...form, default_frequency: e.target.value })} className={inputCls}>
                  <option value="daily">Diário</option><option value="weekly">Semanal</option><option value="biweekly">Quinzenal</option><option value="monthly">Mensal</option>
                </select>
              </div>
            </div>
          </>
        )}

        {tab === "whatsapp" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-success/8 flex items-center justify-center"><MessageSquare size={16} className="text-success" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Integração WhatsApp</h2>
                <p className="text-xs text-muted-foreground">Evolution API para envio automático</p>
              </div>
            </div>
            <div className="space-y-4">
              <div><label className="text-label mb-1.5 block">URL da API</label><input value={form.whatsapp_api_url} onChange={(e) => setForm({ ...form, whatsapp_api_url: e.target.value })} placeholder="https://api.exemplo.com" className={inputCls} /></div>
              <div><label className="text-label mb-1.5 block">API Key</label><input type="password" value={form.whatsapp_api_key} onChange={(e) => setForm({ ...form, whatsapp_api_key: e.target.value })} placeholder="••••••••" className={inputCls} /></div>
              <div><label className="text-label mb-1.5 block">Nome da Instância</label><input value={form.whatsapp_instance} onChange={(e) => setForm({ ...form, whatsapp_instance: e.target.value })} placeholder="minha-instancia" className={inputCls} /></div>
            </div>
          </>
        )}

        {tab === "templates" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><MessageSquare size={16} className="text-primary" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Templates de Mensagem</h2>
                <p className="text-xs text-muted-foreground">Use [Nome], [Valor], [Dias] como variáveis.</p>
              </div>
            </div>
            <div className="space-y-3">
              {templates.map((t: any) => (
                <div key={t.id} className="flex items-start gap-3 p-4 rounded-2xl bg-muted/20 border border-border group">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.content}</p>
                    {t.trigger_days && (
                      <div className="flex items-center gap-1 mt-2">
                        <AlertTriangle size={10} className="text-warning" />
                        <span className="text-[10px] text-warning font-medium">Dispara após {t.trigger_days} dia(s) de atraso</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleDeleteTemplate(t.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">Novo Template</p>
              <input value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} placeholder="Nome do template" className={inputCls} />
              <textarea value={newTemplate.content} onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })} placeholder="Olá [Nome], sua parcela de R$ [Valor] está atrasada há [Dias] dias..." className={`${inputCls} min-h-[80px] resize-none`} />
              <input type="number" value={newTemplate.trigger_days} onChange={(e) => setNewTemplate({ ...newTemplate, trigger_days: e.target.value })} placeholder="Dias de atraso para disparar (opcional)" className={inputCls} />
              <button onClick={handleAddTemplate} disabled={!newTemplate.name || !newTemplate.content}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-ring"
                style={{ background: "var(--gradient-button)" }}>
                <Plus size={14} /> Adicionar Template
              </button>
            </div>
          </>
        )}

        {tab === "webhooks" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-info/8 flex items-center justify-center"><Webhook size={16} className="text-info" /></div>
              <div>
                <h2 className="font-semibold text-foreground">N8N / Webhooks</h2>
                <p className="text-xs text-muted-foreground">Integre com automações externas.</p>
              </div>
            </div>
            <div><label className="text-label mb-1.5 block">URL do Webhook N8N</label><input value={form.n8n_webhook_url} onChange={(e) => setForm({ ...form, n8n_webhook_url: e.target.value })} placeholder="https://n8n.exemplo.com/webhook/..." className={inputCls} /></div>
          </>
        )}

        {tab === "notificacoes" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-warning/8 flex items-center justify-center"><Bell size={16} className="text-warning" /></div>
              <h2 className="font-semibold text-foreground">Notificações Push</h2>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/20 border border-border">
              <button
                onClick={() => setForm({ ...form, push_notifications_enabled: !form.push_notifications_enabled })}
                className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${form.push_notifications_enabled ? "bg-success" : "bg-muted"}`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${form.push_notifications_enabled ? "left-[26px]" : "left-1"}`} />
              </button>
              <div>
                <span className="text-sm font-medium text-foreground">{form.push_notifications_enabled ? "Ativadas" : "Desativadas"}</span>
                <p className="text-[10px] text-muted-foreground">Receba alertas sobre parcelas e cobranças</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Configuracoes;
