import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Building, Percent, MessageSquare, Webhook, Bell, Save, Plus, Trash2, Check, AlertTriangle, Palette, Upload, Image, Key, CreditCard, Bot, Clock, Shield, Zap, ToggleLeft, Send, Volume2, Sun, Moon, Monitor, Eye, LayoutDashboard, Users, Receipt, Info } from "lucide-react";

const COLOR_PRESETS = [
  { label: "Azul Steel", primary: "#4a86c8", accent: "#6ba3d6", emoji: "🔷" },
  { label: "Âmbar", primary: "#d97706", accent: "#f59e0b", emoji: "🟡" },
  { label: "Azul Royal", primary: "#2563eb", accent: "#3b82f6", emoji: "💎" },
  { label: "Esmeralda", primary: "#059669", accent: "#10b981", emoji: "💚" },
  { label: "Roxo", primary: "#7c3aed", accent: "#8b5cf6", emoji: "💜" },
  { label: "Rosa", primary: "#db2777", accent: "#ec4899", emoji: "💖" },
  { label: "Vermelho", primary: "#dc2626", accent: "#ef4444", emoji: "❤️" },
  { label: "Ciano", primary: "#0891b2", accent: "#06b6d4", emoji: "🩵" },
  { label: "Laranja", primary: "#ea580c", accent: "#f97316", emoji: "🟠" },
  { label: "Índigo", primary: "#4f46e5", accent: "#6366f1", emoji: "🔮" },
  { label: "Teal", primary: "#0d9488", accent: "#14b8a6", emoji: "🌊" },
  { label: "Dourado", primary: "#b45309", accent: "#d97706", emoji: "👑" },
];

const Configuracoes = () => {
  const { user, profile } = useAuth();
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
    primary_color: "#4a86c8", accent_color: "#6ba3d6", theme_mode: "dark",
    sidebar_style: "default", login_title: "", login_subtitle: "",
    footer_text: "", border_radius: "16", font_family: "default",
    default_interest_rate: "10", default_late_fee: "2", default_daily_interest: "0.33", default_frequency: "monthly",
    whatsapp_api_url: "", whatsapp_api_key: "", whatsapp_instance: "",
    n8n_webhook_url: "", push_notifications_enabled: false,
    pix_key: "", pix_key_type: "cpf", billing_message: "",
    // Bot de cobranças
    bot_enabled: false, bot_auto_send: false,
    bot_send_hour: 9, bot_send_minute: 0,
    bot_max_messages_per_day: 50,
    bot_work_days: ["mon", "tue", "wed", "thu", "fri"] as string[],
    bot_escalation_rules: [
      { days: 0, template: "lembrete", channel: "whatsapp" },
      { days: 1, template: "cobranca_1d", channel: "whatsapp" },
      { days: 3, template: "cobranca_3d", channel: "whatsapp" },
      { days: 7, template: "cobranca_7d", channel: "whatsapp" },
      { days: 15, template: "cobranca_15d", channel: "whatsapp" },
      { days: 30, template: "cobranca_30d", channel: "whatsapp" },
    ] as { days: number; template: string; channel: string }[],
    bot_retry_interval_hours: 24,
    bot_stop_on_payment: true, bot_notify_owner: true,
    bot_greeting_message: "Olá {nome}, aqui é do {empresa}.",
    bot_closing_message: "Qualquer dúvida, entre em contato. Obrigado!",
    bot_send_pix: true, bot_send_receipt: false,
    bot_tone: "formal",
    bot_use_ai: false,
    bot_negotiation_enabled: false,
    bot_send_audio: false,
  });

  useEffect(() => {
    if (settings) {
      const s = settings as any;
      setForm(prev => ({
        ...prev,
        company_name: s.company_name || "",
        company_cnpj: s.company_cnpj || "",
        company_logo_url: s.company_logo_url || "",
        primary_color: s.primary_color || "#4a86c8",
        accent_color: s.accent_color || "#6ba3d6",
        theme_mode: s.theme_mode || "dark",
        sidebar_style: s.sidebar_style || "default",
        login_title: s.login_title || "",
        login_subtitle: s.login_subtitle || "",
        footer_text: s.footer_text || "",
        border_radius: s.border_radius || "16",
        font_family: s.font_family || "default",
        default_interest_rate: String(s.default_interest_rate || 10),
        default_late_fee: String(s.default_late_fee || 2),
        default_daily_interest: String(s.default_daily_interest || 0.33),
        default_frequency: s.default_frequency || "monthly",
        whatsapp_api_url: s.whatsapp_api_url || "",
        whatsapp_api_key: s.whatsapp_api_key || "",
        whatsapp_instance: s.whatsapp_instance || "",
        n8n_webhook_url: s.n8n_webhook_url || "",
        push_notifications_enabled: s.push_notifications_enabled || false,
        // Bot
        bot_enabled: s.bot_enabled || false,
        bot_auto_send: s.bot_auto_send || false,
        bot_send_hour: s.bot_send_hour ?? 9,
        bot_send_minute: s.bot_send_minute ?? 0,
        bot_max_messages_per_day: s.bot_max_messages_per_day ?? 50,
        bot_work_days: s.bot_work_days || ["mon", "tue", "wed", "thu", "fri"],
        bot_escalation_rules: s.bot_escalation_rules || prev.bot_escalation_rules,
        bot_retry_interval_hours: s.bot_retry_interval_hours ?? 24,
        bot_stop_on_payment: s.bot_stop_on_payment ?? true,
        bot_notify_owner: s.bot_notify_owner ?? true,
        bot_greeting_message: s.bot_greeting_message || "Olá {nome}, aqui é do {empresa}.",
        bot_closing_message: s.bot_closing_message || "Qualquer dúvida, entre em contato. Obrigado!",
        bot_send_pix: s.bot_send_pix ?? true,
        bot_send_receipt: s.bot_send_receipt ?? false,
        bot_tone: s.bot_tone || "formal",
        bot_use_ai: s.bot_use_ai || false,
        bot_negotiation_enabled: s.bot_negotiation_enabled || false,
        bot_send_audio: s.bot_send_audio || false,
      }));
    }
  }, [settings]);

  useEffect(() => {
    if (profile) {
      setForm(prev => ({
        ...prev,
        pix_key: profile.pix_key || "",
        pix_key_type: profile.pix_key_type || "cpf",
        billing_message: profile.billing_message || "",
      }));
    }
  }, [profile]);

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
      sidebar_style: form.sidebar_style,
      login_title: form.login_title || null,
      login_subtitle: form.login_subtitle || null,
      footer_text: form.footer_text || null,
      border_radius: form.border_radius,
      font_family: form.font_family,
      default_interest_rate: parseFloat(form.default_interest_rate),
      default_late_fee: parseFloat(form.default_late_fee),
      default_daily_interest: parseFloat(form.default_daily_interest),
      default_frequency: form.default_frequency,
      whatsapp_api_url: form.whatsapp_api_url || null,
      whatsapp_api_key: form.whatsapp_api_key || null,
      whatsapp_instance: form.whatsapp_instance || null,
      n8n_webhook_url: form.n8n_webhook_url || null,
      push_notifications_enabled: form.push_notifications_enabled,
      // Bot settings
      bot_enabled: form.bot_enabled,
      bot_auto_send: form.bot_auto_send,
      bot_send_hour: form.bot_send_hour,
      bot_send_minute: form.bot_send_minute,
      bot_max_messages_per_day: form.bot_max_messages_per_day,
      bot_work_days: form.bot_work_days,
      bot_escalation_rules: form.bot_escalation_rules,
      bot_retry_interval_hours: form.bot_retry_interval_hours,
      bot_stop_on_payment: form.bot_stop_on_payment,
      bot_notify_owner: form.bot_notify_owner,
      bot_greeting_message: form.bot_greeting_message || null,
      bot_closing_message: form.bot_closing_message || null,
      bot_send_pix: form.bot_send_pix,
      bot_send_receipt: form.bot_send_receipt,
      bot_tone: form.bot_tone,
      bot_use_ai: form.bot_use_ai,
      bot_negotiation_enabled: form.bot_negotiation_enabled,
      bot_send_audio: form.bot_send_audio,
    };
    const { error } = settings
      ? await supabase.from("settings").update(payload).eq("user_id", user.id)
      : await supabase.from("settings").insert(payload);

    // Save PIX and billing message to profile
    await supabase.from("profiles").update({
      pix_key: form.pix_key.trim() || null,
      pix_key_type: form.pix_key_type,
      billing_message: form.billing_message.trim() || null,
    }).eq("id", user.id);

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
    { id: "pix", label: "PIX", icon: CreditCard },
    { id: "bot", label: "Bot Cobranças", icon: Bot },
    { id: "cobranca", label: "Cobrança", icon: MessageSquare },
    { id: "padroes", label: "Padrões", icon: Percent },
    { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
    { id: "templates", label: "Templates", icon: MessageSquare },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "notificacoes", label: "Notificações", icon: Bell },
  ];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="page-hero animate-fade-in">
        <div className="page-hero-content flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="page-hero-icon">
              <Settings size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-shimmer">Configurações</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Personalize a identidade, automações e preferências do sistema</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className={saved ? "btn-premium bg-success !shadow-none" : "btn-premium"}>
            {saved ? <><Check size={16} /> Salvo!</> : saving ? "Salvando..." : <><Save size={16} /> Salvar</>}
          </button>
        </div>
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
                <h2 className="font-semibold text-foreground">White Label Completo</h2>
                <p className="text-xs text-muted-foreground">Personalize toda a identidade visual do sistema</p>
              </div>
            </div>

            {/* Identity Section */}
            <div className="space-y-4 p-4 rounded-2xl border border-border bg-accent/5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building size={12} className="text-primary" /> Identidade
              </p>

              {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-muted/30 border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0 hover:border-primary/30 transition-colors">
                  {form.company_logo_url ? (
                    <img src={form.company_logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <Image size={24} className="text-muted-foreground/30 mx-auto" />
                      <p className="text-[8px] text-muted-foreground mt-1">Logo</p>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" />
                  <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-accent/30 transition-colors disabled:opacity-50 w-full justify-center">
                    <Upload size={14} /> {uploadingLogo ? "Enviando..." : "Enviar Logo"}
                  </button>
                  {form.company_logo_url && (
                    <button onClick={() => setForm({ ...form, company_logo_url: "" })}
                      className="text-xs text-destructive hover:underline block mx-auto">Remover logo</button>
                  )}
                  <p className="text-[10px] text-muted-foreground text-center">PNG ou JPG, máx 2MB</p>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome do Sistema</label>
                <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="SYSTEM JUROS" className={inputCls} />
                <p className="text-[10px] text-muted-foreground mt-1">Aparece no menu lateral, topbar e login</p>
              </div>
            </div>

            {/* Theme Mode */}
            <div className="space-y-3 p-4 rounded-2xl border border-border bg-accent/5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sun size={12} className="text-warning" /> Modo do Tema
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "dark", label: "Escuro", icon: Moon, desc: "Interface dark" },
                  { value: "light", label: "Claro", icon: Sun, desc: "Interface light" },
                  { value: "system", label: "Sistema", icon: Monitor, desc: "Automático" },
                ].map(mode => (
                  <button
                    key={mode.value}
                    onClick={() => setForm({ ...form, theme_mode: mode.value })}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      form.theme_mode === mode.value
                        ? "border-primary/40 bg-primary/10 shadow-sm"
                        : "border-border hover:border-primary/20 hover:bg-accent/20"
                    }`}
                  >
                    <mode.icon size={20} className={`mx-auto mb-1.5 ${form.theme_mode === mode.value ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-xs font-semibold text-foreground">{mode.label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{mode.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Palette */}
            <div className="space-y-4 p-4 rounded-2xl border border-border bg-accent/5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Palette size={12} className="text-primary" /> Paleta de Cores
              </p>

              {/* Presets Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setForm({ ...form, primary_color: preset.primary, accent_color: preset.accent })}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                      form.primary_color === preset.primary
                        ? "border-primary bg-primary/10 shadow-sm scale-[1.02]"
                        : "border-border hover:border-primary/30 hover:bg-accent/20"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg shadow-sm shrink-0" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }} />
                    <div className="text-left min-w-0">
                      <p className="text-[10px] font-semibold text-foreground truncate">{preset.label}</p>
                      <p className="text-[8px] text-muted-foreground font-mono">{preset.primary}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Color Pickers */}
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2.5 flex-1">
                  <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="w-10 h-10 rounded-xl border border-border cursor-pointer shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Principal</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{form.primary_color}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-1">
                  <input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                    className="w-10 h-10 rounded-xl border border-border cursor-pointer shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Destaque</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{form.accent_color}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-3 p-4 rounded-2xl border border-border bg-accent/5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Eye size={12} className="text-primary" /> Pré-visualização ao Vivo
              </p>

              {/* Mockup: Sidebar + Header */}
              <div className="rounded-xl border border-border overflow-hidden bg-background">
                {/* Fake sidebar + main area */}
                <div className="flex">
                  {/* Mini sidebar */}
                  <div className="w-[140px] border-r border-border p-3 space-y-2 bg-card shrink-0 hidden sm:block">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.accent_color})` }}>
                        {form.company_logo_url && <img src={form.company_logo_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <p className="text-[9px] font-bold truncate" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.accent_color})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        {form.company_name || "SYSTEM JUROS"}
                      </p>
                    </div>
                    {[
                      { icon: LayoutDashboard, label: "Dashboard", active: true },
                      { icon: Users, label: "Clientes", active: false },
                      { icon: Receipt, label: "Contratos", active: false },
                      { icon: Settings, label: "Config", active: false },
                    ].map(item => (
                      <div key={item.label} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] ${
                        item.active ? "text-white font-semibold" : "text-muted-foreground"
                      }`} style={item.active ? { background: `linear-gradient(135deg, ${form.primary_color}, ${form.accent_color})` } : {}}>
                        <item.icon size={10} /> {item.label}
                      </div>
                    ))}
                  </div>

                  {/* Main content mockup */}
                  <div className="flex-1 p-3 space-y-2">
                    {/* Topbar */}
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-foreground">Dashboard</p>
                      <div className="flex gap-1">
                        <div className="w-5 h-5 rounded-md" style={{ background: `${form.primary_color}20` }} />
                        <div className="w-5 h-5 rounded-full bg-muted" />
                      </div>
                    </div>
                    {/* Stat cards */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {["R$ 15.000", "R$ 3.200", "12"].map((val, i) => (
                        <div key={i} className="rounded-lg border border-border p-2 bg-card">
                          <div className="w-4 h-4 rounded-md mb-1" style={{ background: `${form.primary_color}15` }}>
                            <div className="w-2 h-2 m-1 rounded-sm" style={{ background: form.primary_color }} />
                          </div>
                          <p className="text-[9px] font-bold text-foreground">{val}</p>
                          <p className="text-[7px] text-muted-foreground">{["Capital", "Lucro", "Clientes"][i]}</p>
                        </div>
                      ))}
                    </div>
                    {/* Button preview */}
                    <div className="flex gap-1.5 pt-1">
                      <div className="px-3 py-1.5 rounded-lg text-[9px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.accent_color})` }}>
                        Novo Cliente
                      </div>
                      <div className="px-3 py-1.5 rounded-lg text-[9px] font-medium border border-border text-foreground">
                        Exportar
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Style */}
            <div className="space-y-3 p-4 rounded-2xl border border-border bg-accent/5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <LayoutDashboard size={12} className="text-primary" /> Estilo da Sidebar
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "default", label: "Padrão", desc: "Clássico, limpo" },
                  { value: "minimal", label: "Minimalista", desc: "Ícones + texto fino" },
                  { value: "gradient", label: "Gradiente", desc: "Fundo com gradiente" },
                ].map(style => (
                  <button
                    key={style.value}
                    onClick={() => setForm({ ...form, sidebar_style: style.value })}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      form.sidebar_style === style.value
                        ? "border-primary/40 bg-primary/10 shadow-sm"
                        : "border-border hover:border-primary/20 hover:bg-accent/20"
                    }`}
                  >
                    <div className="w-8 h-14 mx-auto mb-2 rounded-lg border border-border/50 overflow-hidden">
                      <div className={`w-full h-full ${
                        style.value === "gradient" 
                          ? "" 
                          : style.value === "minimal" 
                            ? "bg-transparent" 
                            : "bg-card"
                      }`} style={style.value === "gradient" ? { background: `linear-gradient(180deg, ${form.primary_color}15, ${form.primary_color}05)` } : {}}>
                        <div className="space-y-1 p-1 pt-2">
                          <div className="w-3 h-0.5 rounded-full" style={{ background: form.primary_color }} />
                          <div className="w-full h-0.5 rounded-full bg-muted-foreground/10" />
                          <div className="w-full h-0.5 rounded-full bg-muted-foreground/10" />
                          <div className="w-full h-0.5 rounded-full bg-muted-foreground/10" />
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] font-semibold text-foreground">{style.label}</p>
                    <p className="text-[8px] text-muted-foreground">{style.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family */}
            <div className="space-y-3 p-4 rounded-2xl border border-border bg-accent/5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Settings size={12} className="text-primary" /> Tipografia
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { value: "default", label: "Space Grotesk", sample: "Aa 123" },
                  { value: "inter", label: "Inter", sample: "Aa 123" },
                  { value: "roboto", label: "Roboto", sample: "Aa 123" },
                  { value: "poppins", label: "Poppins", sample: "Aa 123" },
                  { value: "montserrat", label: "Montserrat", sample: "Aa 123" },
                  { value: "nunito", label: "Nunito", sample: "Aa 123" },
                ].map(font => (
                  <button
                    key={font.value}
                    onClick={() => setForm({ ...form, font_family: font.value })}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      form.font_family === font.value
                        ? "border-primary/40 bg-primary/10 shadow-sm"
                        : "border-border hover:border-primary/20 hover:bg-accent/20"
                    }`}
                  >
                    <p className="text-lg font-bold text-foreground mb-0.5">{font.sample}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">{font.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Border Radius */}
            <div className="space-y-3 p-4 rounded-2xl border border-border bg-accent/5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Settings size={12} className="text-primary" /> Arredondamento
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="2"
                  value={form.border_radius}
                  onChange={(e) => setForm({ ...form, border_radius: e.target.value })}
                  className="flex-1 accent-primary"
                />
                <div className="flex items-center gap-2">
                  <div
                    className="w-12 h-12 border-2 border-primary/40 bg-primary/10"
                    style={{ borderRadius: `${form.border_radius}px` }}
                  />
                  <span className="text-xs font-mono text-muted-foreground">{form.border_radius}px</span>
                </div>
              </div>
            </div>

            {/* Login Page Branding */}
            <div className="space-y-3 p-4 rounded-2xl border border-border bg-accent/5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Shield size={12} className="text-primary" /> Tela de Login
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Título Principal</label>
                  <input value={form.login_title} onChange={(e) => setForm({ ...form, login_title: e.target.value })} placeholder="SYSTEM JUROS" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subtítulo</label>
                  <input value={form.login_subtitle} onChange={(e) => setForm({ ...form, login_subtitle: e.target.value })} placeholder="SISTEMA DE GESTÃO DE EMPRÉSTIMOS" className={inputCls} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="space-y-3 p-4 rounded-2xl border border-border bg-accent/5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Info size={12} className="text-primary" /> Rodapé
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Texto do Rodapé</label>
                <input value={form.footer_text} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} placeholder="© 2025 SYSTEM JUROS · TODOS OS DIREITOS RESERVADOS" className={inputCls} />
                <p className="text-[10px] text-muted-foreground mt-1">Aparece no login e no portal do cliente</p>
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

        {tab === "pix" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-success/8 flex items-center justify-center"><CreditCard size={16} className="text-success" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Chave PIX</h2>
                <p className="text-xs text-muted-foreground">Configurar chave PIX para recebimentos</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-label mb-1.5 block">Tipo da Chave</label>
                <select value={form.pix_key_type} onChange={(e) => setForm({ ...form, pix_key_type: e.target.value })} className={inputCls}>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">Email</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave Aleatória</option>
                </select>
              </div>
              <div>
                <label className="text-label mb-1.5 block">Chave PIX</label>
                <input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="Sua chave PIX" className={inputCls} />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-info/5 border border-info/20">
              <p className="text-[11px] text-info">💡 A chave PIX será exibida no portal do cliente para facilitar o pagamento.</p>
            </div>
          </>
        )}

        {tab === "bot" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><Bot size={16} className="text-primary" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Bot de Cobranças Automático</h2>
                <p className="text-xs text-muted-foreground">Configure o envio automático de cobranças via WhatsApp</p>
              </div>
            </div>

            {/* Toggle principal */}
            <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${form.bot_enabled ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"}`}>
              <button
                onClick={() => setForm({ ...form, bot_enabled: !form.bot_enabled })}
                className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${form.bot_enabled ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${form.bot_enabled ? "left-[26px]" : "left-1"}`} />
              </button>
              <div>
                <span className="text-sm font-medium text-foreground">{form.bot_enabled ? "Bot Ativado" : "Bot Desativado"}</span>
                <p className="text-[10px] text-muted-foreground">O bot enviará cobranças automaticamente conforme as regras abaixo</p>
              </div>
            </div>

            {form.bot_enabled && (
              <div className="space-y-5">
                {/* Modo de envio */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-warning" />
                    <p className="text-label">Modo de Envio</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { value: false, label: "Aprovação Manual", desc: "Revise cada mensagem antes de enviar", icon: Shield },
                      { value: true, label: "Envio Automático", desc: "Mensagens enviadas sem intervenção", icon: Zap },
                    ].map((opt) => (
                      <button
                        key={String(opt.value)}
                        onClick={() => setForm({ ...form, bot_auto_send: opt.value })}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          form.bot_auto_send === opt.value ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <opt.icon size={14} className={form.bot_auto_send === opt.value ? "text-primary" : "text-muted-foreground"} />
                          <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tom da mensagem */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Volume2 size={14} className="text-info" />
                    <p className="text-label">Tom da Mensagem</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "formal", label: "Formal", emoji: "👔" },
                      { value: "amigavel", label: "Amigável", emoji: "😊" },
                      { value: "urgente", label: "Urgente", emoji: "⚠️" },
                    ].map((tone) => (
                      <button
                        key={tone.value}
                        onClick={() => setForm({ ...form, bot_tone: tone.value })}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          form.bot_tone === tone.value ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
                        }`}
                      >
                        <span className="text-lg">{tone.emoji}</span>
                        <p className="text-xs font-medium text-foreground mt-1">{tone.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Horário de envio */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-primary" />
                    <p className="text-label">Horário de Envio</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Hora</label>
                      <select value={form.bot_send_hour} onChange={(e) => setForm({ ...form, bot_send_hour: parseInt(e.target.value) })} className={inputCls}>
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, "0")}h</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Minuto</label>
                      <select value={form.bot_send_minute} onChange={(e) => setForm({ ...form, bot_send_minute: parseInt(e.target.value) })} className={inputCls}>
                        {[0, 15, 30, 45].map(m => (
                          <option key={m} value={m}>{String(m).padStart(2, "0")}min</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Mensagens serão enviadas às {String(form.bot_send_hour).padStart(2, "0")}:{String(form.bot_send_minute).padStart(2, "0")}</p>
                </div>

                {/* Dias de funcionamento */}
                <div className="space-y-3">
                  <p className="text-label">Dias de Funcionamento</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "mon", label: "Seg" }, { key: "tue", label: "Ter" }, { key: "wed", label: "Qua" },
                      { key: "thu", label: "Qui" }, { key: "fri", label: "Sex" }, { key: "sat", label: "Sáb" }, { key: "sun", label: "Dom" },
                    ].map((day) => {
                      const active = form.bot_work_days.includes(day.key);
                      return (
                        <button
                          key={day.key}
                          onClick={() => {
                            const days = active
                              ? form.bot_work_days.filter(d => d !== day.key)
                              : [...form.bot_work_days, day.key];
                            setForm({ ...form, bot_work_days: days });
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                            active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/20"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Limites */}
                <div className="space-y-3">
                  <p className="text-label">Limites e Intervalos</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Máx. mensagens/dia</label>
                      <input type="number" value={form.bot_max_messages_per_day} onChange={(e) => setForm({ ...form, bot_max_messages_per_day: parseInt(e.target.value) || 50 })} className={inputCls} min={1} max={500} />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Intervalo entre cobranças (h)</label>
                      <input type="number" value={form.bot_retry_interval_hours} onChange={(e) => setForm({ ...form, bot_retry_interval_hours: parseInt(e.target.value) || 24 })} className={inputCls} min={1} max={168} />
                    </div>
                  </div>
                </div>

                {/* Fluxo de escalação */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-label">Fluxo de Escalação</p>
                    <button
                      onClick={() => {
                        const rules = [...form.bot_escalation_rules, { days: 0, template: "", channel: "whatsapp" }];
                        setForm({ ...form, bot_escalation_rules: rules });
                      }}
                      className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
                    >
                      <Plus size={12} /> Adicionar etapa
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Defina em quantos dias de atraso cada mensagem será enviada</p>
                  <div className="space-y-2">
                    {form.bot_escalation_rules.map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/10">
                        <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-warning">{idx + 1}</span>
                        </div>
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[9px] text-muted-foreground">Dias atraso</label>
                            <input
                              type="number" min={0} value={rule.days}
                              onChange={(e) => {
                                const rules = [...form.bot_escalation_rules];
                                rules[idx] = { ...rules[idx], days: parseInt(e.target.value) || 0 };
                                setForm({ ...form, bot_escalation_rules: rules });
                              }}
                              className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-muted-foreground">Template</label>
                            <select
                              value={rule.template}
                              onChange={(e) => {
                                const rules = [...form.bot_escalation_rules];
                                rules[idx] = { ...rules[idx], template: e.target.value };
                                setForm({ ...form, bot_escalation_rules: rules });
                              }}
                              className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground"
                            >
                              <option value="">Selecionar...</option>
                              {templates.map((t: any) => (
                                <option key={t.id} value={t.name}>{t.name}</option>
                              ))}
                              <option value="lembrete">Lembrete</option>
                              <option value="cobranca_1d">Cobrança 1d</option>
                              <option value="cobranca_3d">Cobrança 3d</option>
                              <option value="cobranca_7d">Cobrança 7d</option>
                              <option value="cobranca_15d">Cobrança 15d</option>
                              <option value="cobranca_30d">Cobrança 30d</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-muted-foreground">Canal</label>
                            <select
                              value={rule.channel}
                              onChange={(e) => {
                                const rules = [...form.bot_escalation_rules];
                                rules[idx] = { ...rules[idx], channel: e.target.value };
                                setForm({ ...form, bot_escalation_rules: rules });
                              }}
                              className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground"
                            >
                              <option value="whatsapp">WhatsApp</option>
                              <option value="sms">SMS</option>
                              <option value="email">E-mail</option>
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const rules = form.bot_escalation_rules.filter((_, i) => i !== idx);
                            setForm({ ...form, bot_escalation_rules: rules });
                          }}
                          className="text-muted-foreground hover:text-destructive p-1 shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mensagens do bot */}
                <div className="space-y-3">
                  <p className="text-label">Mensagens Personalizadas</p>
                  <p className="text-[10px] text-muted-foreground">Variáveis: <code className="text-primary font-mono bg-primary/5 px-1 rounded">{"{nome}"}</code> <code className="text-primary font-mono bg-primary/5 px-1 rounded">{"{empresa}"}</code> <code className="text-primary font-mono bg-primary/5 px-1 rounded">{"{valor}"}</code> <code className="text-primary font-mono bg-primary/5 px-1 rounded">{"{data}"}</code></p>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">Saudação Inicial</label>
                    <input value={form.bot_greeting_message} onChange={(e) => setForm({ ...form, bot_greeting_message: e.target.value })} className={inputCls} placeholder="Olá {nome}, aqui é do {empresa}." />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">Mensagem de Encerramento</label>
                    <input value={form.bot_closing_message} onChange={(e) => setForm({ ...form, bot_closing_message: e.target.value })} className={inputCls} placeholder="Qualquer dúvida, entre em contato. Obrigado!" />
                  </div>
                </div>

                {/* Opções extras */}
                <div className="space-y-3">
                  <p className="text-label">Opções Adicionais</p>
                  <div className="space-y-2">
                    {[
                      { key: "bot_stop_on_payment" as const, label: "Parar ao detectar pagamento", desc: "Interrompe a sequência se a parcela for paga" },
                      { key: "bot_notify_owner" as const, label: "Notificar proprietário", desc: "Receba um alerta cada vez que o bot enviar uma cobrança" },
                      { key: "bot_send_pix" as const, label: "Incluir chave PIX", desc: "Anexar chave PIX na mensagem para pagamento rápido" },
                      { key: "bot_send_receipt" as const, label: "Enviar comprovante ao pagar", desc: "Envia confirmação automática quando o pagamento é registrado" },
                    ].map((opt) => (
                      <div key={opt.key} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/10">
                        <button
                          onClick={() => setForm({ ...form, [opt.key]: !form[opt.key] })}
                          className={`relative w-10 h-6 rounded-full transition-colors duration-300 shrink-0 ${(form[opt.key] as boolean) ? "bg-primary" : "bg-muted"}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${(form[opt.key] as boolean) ? "left-[18px]" : "left-0.5"}`} />
                        </button>
                        <div>
                          <span className="text-xs font-medium text-foreground">{opt.label}</span>
                          <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status info */}
                <div className="p-4 rounded-xl bg-info/5 border border-info/20 space-y-2">
                  <p className="text-xs font-semibold text-info flex items-center gap-2"><Bot size={14} /> Como funciona</p>
                  <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc list-inside">
                    <li>O bot verifica parcelas em atraso diariamente no horário configurado</li>
                    <li>Envia a mensagem correspondente ao nível de atraso (fluxo de escalação)</li>
                    <li>Respeita os limites de mensagens/dia e dias de funcionamento</li>
                    <li>Requer integração com WhatsApp (Evolution API) configurada na aba "WhatsApp"</li>
                    <li>Templates devem ser criados na aba "Templates" para uso no fluxo</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "mensagem" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-warning/8 flex items-center justify-center"><MessageSquare size={16} className="text-warning" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Mensagem Padrão de Cobrança</h2>
                <p className="text-xs text-muted-foreground">Mensagem enviada automaticamente nas cobranças</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Variáveis: <code className="text-primary font-mono bg-primary/5 px-1 rounded">[Nome da Empresa]</code> <code className="text-primary font-mono bg-primary/5 px-1 rounded">[Nome do Cliente]</code> <code className="text-primary font-mono bg-primary/5 px-1 rounded">[Valor da Parcela]</code>
              </p>
              <textarea
                value={form.billing_message}
                onChange={(e) => setForm({ ...form, billing_message: e.target.value })}
                rows={5}
                className={`${inputCls} resize-none`}
                placeholder="[Nome da Empresa]: Sr(a) [Nome do Cliente], identificamos um atraso em sua parcela..."
              />
            </div>
            <div className="space-y-2">
              <p className="text-label">Mensagens Prontas</p>
              {[
                { label: "Formal", text: "[Nome da Empresa]: Sr(a) [Nome do Cliente], identificamos um atraso em sua parcela de empréstimo. O valor pendente é de R$ [Valor da Parcela]. Por favor, entre em contato para regularizar." },
                { label: "Amigável", text: "Olá [Nome do Cliente]! 😊 Aqui é da [Nome da Empresa]. Notamos que sua parcela de R$ [Valor da Parcela] ainda não foi paga. Podemos ajudar? Entre em contato conosco!" },
                { label: "Urgente", text: "⚠️ [Nome da Empresa] informa: [Nome do Cliente], sua parcela de R$ [Valor da Parcela] está em atraso. Regularize imediatamente para evitar juros adicionais e restrições no seu CPF." },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setForm({ ...form, billing_message: preset.text })}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    form.billing_message === preset.text
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:border-primary/20 hover:bg-primary/5"
                  }`}
                >
                  <p className="text-xs font-semibold text-foreground">{preset.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{preset.text}</p>
                </button>
              ))}
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

            {/* Templates prontos para usar */}
            <div className="space-y-2">
              <p className="text-label">Templates Prontos</p>
              <p className="text-[11px] text-muted-foreground mb-2">Clique para adicionar ao seu sistema</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { name: "Lembrete Amigável", content: "Olá [Nome], tudo bem? 😊 Passando para lembrar que sua parcela de R$ [Valor] vence hoje. Qualquer dúvida, estamos à disposição!", trigger_days: 0 },
                  { name: "Cobrança 1 Dia", content: "Olá [Nome], notamos que sua parcela de R$ [Valor] venceu ontem. Por favor, realize o pagamento o quanto antes para evitar juros adicionais. Obrigado!", trigger_days: 1 },
                  { name: "Cobrança 3 Dias", content: "Prezado(a) [Nome], sua parcela de R$ [Valor] está com [Dias] dias de atraso. Entre em contato para negociarmos. Evite a negativação do seu nome.", trigger_days: 3 },
                  { name: "Cobrança 7 Dias", content: "⚠️ [Nome], sua parcela de R$ [Valor] está com [Dias] dias de atraso. Caso o pagamento não seja regularizado, medidas adicionais poderão ser tomadas. Entre em contato urgente.", trigger_days: 7 },
                  { name: "Cobrança 15 Dias", content: "🚨 [Nome], informamos que sua dívida de R$ [Valor] com [Dias] dias de atraso será encaminhada para negativação. Regularize imediatamente para evitar restrições no seu CPF.", trigger_days: 15 },
                  { name: "Cobrança 30 Dias", content: "[Nome], sua dívida de R$ [Valor] está com [Dias] dias de atraso. Seu nome será incluído nos órgãos de proteção ao crédito. Entre em contato HOJE para negociar e evitar maiores consequências.", trigger_days: 30 },
                  { name: "Confirmação de Pagamento", content: "✅ [Nome], confirmamos o recebimento do pagamento de R$ [Valor]. Obrigado pela pontualidade! Qualquer dúvida, estamos à disposição.", trigger_days: null },
                  { name: "Acordo / Negociação", content: "Olá [Nome], gostaríamos de oferecer uma condição especial para regularizar sua parcela de R$ [Valor] em atraso há [Dias] dias. Entre em contato para negociarmos. 🤝", trigger_days: null },
                ].map((preset, idx) => {
                  const alreadyAdded = templates.some((t: any) => t.name === preset.name);
                  return (
                    <button
                      key={idx}
                      disabled={alreadyAdded}
                      onClick={async () => {
                        if (!user) return;
                        const { error } = await supabase.from("message_templates").insert({
                          user_id: user.id, name: preset.name, content: preset.content,
                          trigger_days: preset.trigger_days,
                        });
                        if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
                        else {
                          toast({ title: `✓ "${preset.name}" adicionado!` });
                          queryClient.invalidateQueries({ queryKey: ["message-templates"] });
                        }
                      }}
                      className={`text-left p-3 rounded-xl border transition-colors ${
                        alreadyAdded
                          ? "border-success/30 bg-success/5 opacity-60 cursor-default"
                          : "border-border hover:border-primary/30 hover:bg-primary/5 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">{preset.name}</p>
                        {alreadyAdded ? (
                          <Check size={12} className="text-success shrink-0" />
                        ) : (
                          <Plus size={12} className="text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{preset.content}</p>
                      {preset.trigger_days !== null && (
                        <span className="inline-block mt-1.5 text-[9px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded-md">
                          {preset.trigger_days === 0 ? "No vencimento" : `${preset.trigger_days}d de atraso`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Templates existentes do usuário */}
            {templates.length > 0 && (
              <div className="space-y-3 border-t border-border pt-5">
                <p className="text-label">Seus Templates</p>
                {templates.map((t: any) => (
                  <div key={t.id} className="flex items-start gap-3 p-4 rounded-2xl bg-muted/20 border border-border group">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.content}</p>
                      {t.trigger_days !== null && (
                        <div className="flex items-center gap-1 mt-2">
                          <AlertTriangle size={10} className="text-warning" />
                          <span className="text-[10px] text-warning font-medium">
                            {t.trigger_days === 0 ? "No dia do vencimento" : `Dispara após ${t.trigger_days} dia(s) de atraso`}
                          </span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleDeleteTemplate(t.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Criar template personalizado */}
            <div className="border-t border-border pt-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">Template Personalizado</p>
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
