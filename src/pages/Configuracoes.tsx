import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Building, Percent, MessageSquare, Webhook, Bell, Save, Plus, Trash2, Check, AlertTriangle, Palette, Upload, Image } from "lucide-react";

const COLOR_PRESETS = [
  { label: "Âmbar", primary: "#d97706", accent: "#f59e0b" },
  { label: "Azul", primary: "#2563eb", accent: "#3b82f6" },
  { label: "Verde", primary: "#059669", accent: "#10b981" },
  { label: "Roxo", primary: "#7c3aed", accent: "#8b5cf6" },
  { label: "Rosa", primary: "#db2777", accent: "#ec4899" },
  { label: "Vermelho", primary: "#dc2626", accent: "#ef4444" },
  { label: "Ciano", primary: "#0891b2", accent: "#06b6d4" },
  { label: "Laranja", primary: "#ea580c", accent: "#f97316" },
];

const Configuracoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { refresh: refreshWhiteLabel } = useWhiteLabel();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("marca");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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
    company_name: "", company_cnpj: "", company_logo_url: "",
    primary_color: "#d97706", accent_color: "#f59e0b", theme_mode: "dark",
    default_interest_rate: "10", default_late_fee: "2", default_daily_interest: "0.33", default_frequency: "monthly",
    whatsapp_api_url: "", whatsapp_api_key: "", whatsapp_instance: "",
    n8n_webhook_url: "", push_notifications_enabled: false,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name || "",
        company_cnpj: settings.company_cnpj || "",
        company_logo_url: settings.company_logo_url || "",
        primary_color: (settings as any).primary_color || "#d97706",
        accent_color: (settings as any).accent_color || "#f59e0b",
        theme_mode: (settings as any).theme_mode || "dark",
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

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    const ext = file.name.split(".").pop();
    const path = `logos/${user.id}/logo.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
      setForm({ ...form, company_logo_url: urlData.publicUrl });
      toast({ title: "✓ Logo enviado!" });
    }
    setUploadingLogo(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = {
      user_id: user.id,
      company_name: form.company_name || null, company_cnpj: form.company_cnpj || null,
      company_logo_url: form.company_logo_url || null,
      primary_color: form.primary_color,
      accent_color: form.accent_color,
      theme_mode: form.theme_mode,
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
      refreshWhiteLabel();
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
    { id: "marca", label: "Marca", icon: Palette },
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
        {tab === "marca" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><Palette size={16} className="text-primary" /></div>
              <div>
                <h2 className="font-semibold text-foreground">White Label</h2>
                <p className="text-xs text-muted-foreground">Personalize nome, logo e cores do sistema</p>
              </div>
            </div>

            {/* Logo */}
            <div className="space-y-3">
              <label className="text-label mb-1.5 block">Logo da Empresa</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-muted/30 border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {form.company_logo_url ? (
                    <img src={form.company_logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Image size={24} className="text-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" />
                  <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-accent/30 transition-colors disabled:opacity-50">
                    <Upload size={14} /> {uploadingLogo ? "Enviando..." : "Enviar Logo"}
                  </button>
                  {form.company_logo_url && (
                    <button onClick={() => setForm({ ...form, company_logo_url: "" })}
                      className="text-xs text-destructive hover:underline">Remover logo</button>
                  )}
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-label mb-1.5 block">Nome do Sistema</label>
              <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="SYSTEM JUROS" className={inputCls} />
              <p className="text-[10px] text-muted-foreground mt-1">Aparece no menu lateral e login</p>
            </div>

            {/* Color presets */}
            <div>
              <label className="text-label mb-2 block">Cor Principal</label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setForm({ ...form, primary_color: preset.primary, accent_color: preset.accent })}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                      form.primary_color === preset.primary ? "border-primary bg-primary/10 scale-105" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full shadow-sm" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }} />
                    <span className="text-[9px] font-medium text-muted-foreground">{preset.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Principal:</label>
                  <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Destaque:</label>
                  <input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 rounded-2xl border border-border bg-muted/20">
              <p className="text-label mb-2">Pré-visualização</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.accent_color})` }}>
                  {form.company_logo_url && <img src={form.company_logo_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.accent_color})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {form.company_name || "SYSTEM JUROS"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Seu sistema personalizado</p>
                </div>
                <div className="ml-auto flex gap-1.5">
                  <div className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: form.primary_color }}>Botão</div>
                  <div className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: form.accent_color }}>Ação</div>
                </div>
              </div>
            </div>
          </>
        )}

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
