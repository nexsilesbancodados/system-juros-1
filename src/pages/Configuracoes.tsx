import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Building, Percent, MessageSquare, Webhook, Bell, Save, Plus, Trash2, Check, AlertTriangle, Palette, Upload, Image, Key, CreditCard, Bot, Clock, Shield, Zap, ToggleLeft, Send, Volume2, Sun, Moon, Monitor, Eye, LayoutDashboard, Users, Receipt, Info, Copy, ExternalLink, FileText, RotateCcw, Sparkles, Package } from "lucide-react";
import { CONTRACT_PLACEHOLDERS, DEFAULT_CONTRACT_TEMPLATE } from "@/utils/contractTemplate";
import { useConfirm } from "@/components/ConfirmProvider";
import { getSignedUploadUrl } from "@/lib/storage";
import { DEFAULT_MODULES, type ModuleKey } from "@/contexts/WhiteLabelContext";

const COLOR_PRESETS = [
  { label: "Azul Steel", primary: "#4a86c8", accent: "#6ba3d6", emoji: "🔷" },
  { label: "Azul Royal", primary: "#2563eb", accent: "#3b82f6", emoji: "💎" },
  { label: "Esmeralda", primary: "#059669", accent: "#10b981", emoji: "💚" },
  { label: "Roxo", primary: "#7c3aed", accent: "#8b5cf6", emoji: "💜" },
  { label: "Âmbar", primary: "#d97706", accent: "#f59e0b", emoji: "🟡" },
  { label: "Vermelho", primary: "#dc2626", accent: "#ef4444", emoji: "❤️" },
];

const Configuracoes = () => {
  const confirm = useConfirm();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { refresh: refreshWhiteLabel } = useWhiteLabel();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("marca");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const portalLogoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingPortalLogo, setUploadingPortalLogo] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["settings", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("settings_safe").select("*").eq("user_id", user!.id).maybeSingle();
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
    company_name: "", company_cnpj: "", company_logo_url: "", favicon_url: "",
    primary_color: "#4a86c8", accent_color: "#6ba3d6", theme_mode: "dark",
    sidebar_style: "default", login_title: "", login_subtitle: "",
    footer_text: "", border_radius: "16", font_family: "default",
    default_interest_rate: "10", default_late_fee: "2", default_daily_interest: "0.33", default_frequency: "monthly",
    whatsapp_api_url: "", whatsapp_api_key: "",
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
    bot_process_audio: true,
    bot_process_receipts: true,
    bot_auto_confirm_payment: false,
    portal_title: "Portal do Cliente",
    portal_subtitle: "Acompanhe seus contratos e pagamentos",
    portal_welcome_message: "",
    portal_primary_color: "",
    portal_logo_url: "",
    portal_contact_phone: "",
    portal_contact_email: "",
    custom_contract_template: "",
    hubla_checkout_url: "",
    hubla_webhook_token: "",
    modules_enabled: { ...DEFAULT_MODULES } as Record<ModuleKey, boolean>,
  });

  useEffect(() => {
    if (settings) {
      const s = settings as any;
      setForm(prev => ({
        ...prev,
        company_name: s.company_name || "",
        company_cnpj: s.company_cnpj || "",
        company_logo_url: s.company_logo_url || "",
        favicon_url: s.favicon_url || "",
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
        whatsapp_api_key: "", // never loaded from server; type new value to replace
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
        bot_process_audio: s.bot_process_audio ?? true,
        bot_process_receipts: s.bot_process_receipts ?? true,
        bot_auto_confirm_payment: s.bot_auto_confirm_payment ?? false,
        portal_title: s.portal_title || "Portal do Cliente",
        portal_subtitle: s.portal_subtitle || "Acompanhe seus contratos e pagamentos",
        portal_welcome_message: s.portal_welcome_message || "",
        portal_primary_color: s.portal_primary_color || "",
        portal_logo_url: s.portal_logo_url || "",
        portal_contact_phone: s.portal_contact_phone || "",
        portal_contact_email: s.portal_contact_email || "",
        custom_contract_template: s.custom_contract_template || "",
        hubla_checkout_url: s.hubla_checkout_url || "",
        hubla_webhook_token: "", // never loaded from server; type new value to replace
        modules_enabled: { ...DEFAULT_MODULES, ...(s.modules_enabled || {}) },
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

  const uploadImage = async (
    file: File,
    folder: string,
    field: "company_logo_url" | "favicon_url" | "portal_logo_url",
    setBusy: (b: boolean) => void,
    label: string
  ) => {
    if (!user) return;
    setBusy(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${user.id}/${folder}/${field}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } else {
      const url = await getSignedUploadUrl(path);
      if (url) {
        setForm((f) => ({ ...f, [field]: url }));
        toast({ title: `✓ ${label} enviado!` });
      }
    }
    setBusy(false);
  };

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file, "logos", "company_logo_url", setUploadingLogo, "Logo");
  };
  const handleUploadFavicon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file, "favicons", "favicon_url", setUploadingFavicon, "Favicon");
  };
  const handleUploadPortalLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file, "logos", "portal_logo_url", setUploadingPortalLogo, "Logo do Portal");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = {
      user_id: user.id,
      company_name: form.company_name || null, company_cnpj: form.company_cnpj || null,
      company_logo_url: form.company_logo_url || null,
      favicon_url: form.favicon_url || null,
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
      // whatsapp_api_key intentionally omitted — saved via edge function settings-set-secret
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
      bot_process_audio: form.bot_process_audio,
      bot_process_receipts: form.bot_process_receipts,
      bot_auto_confirm_payment: form.bot_auto_confirm_payment,
      portal_title: form.portal_title,
      portal_subtitle: form.portal_subtitle,
      portal_welcome_message: form.portal_welcome_message,
      portal_primary_color: form.portal_primary_color,
      portal_logo_url: form.portal_logo_url,
      portal_contact_phone: form.portal_contact_phone,
      portal_contact_email: form.portal_contact_email,
      custom_contract_template: form.custom_contract_template?.trim() || null,
      hubla_checkout_url: form.hubla_checkout_url ? form.hubla_checkout_url.trim() : null,
      // hubla_webhook_token intentionally omitted — saved via edge function settings-set-secret
      modules_enabled: form.modules_enabled,
    };
    const { error } = settings
      ? await supabase.from("settings").update(payload).eq("user_id", user.id)
      : await supabase.from("settings").insert(payload);

    // Persist sensitive secrets via dedicated edge function (cols revoked from authenticated)
    const secretsPayload: Record<string, string> = {};
    if (form.whatsapp_api_key && form.whatsapp_api_key.trim().length > 0) {
      secretsPayload.whatsapp_api_key = form.whatsapp_api_key.trim();
    }
    if (form.hubla_webhook_token && form.hubla_webhook_token.trim().length > 0) {
      secretsPayload.hubla_webhook_token = form.hubla_webhook_token.trim();
    }
    if (Object.keys(secretsPayload).length > 0) {
      const { error: secErr } = await supabase.functions.invoke("settings-set-secret", { body: secretsPayload });
      if (secErr) toast({ title: "Erro ao salvar segredos", description: secErr.message, variant: "destructive" });
      else {
        // Clear from local form so the masked placeholder reappears
        setForm(prev => ({ ...prev, whatsapp_api_key: "", hubla_webhook_token: "" }));
      }
    }

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
    if (!(await confirm("Excluir este template?"))) return;
    await supabase.from("message_templates").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["message-templates"] });
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl bg-background/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all outline-none";

  // === NOVA NAVEGAÇÃO POR GRUPOS (mais fácil de configurar) ===
  type Item = { id: string; label: string; icon: any; keywords?: string; adminOnly?: boolean };
  type Group = { id: string; label: string; items: Item[]; advanced?: boolean };

  const groups: Group[] = [
    {
      id: "essencial",
      label: "Essencial",
      items: [
        { id: "empresa", label: "Empresa & Dados", icon: Building, keywords: "cnpj nome empresa razão" },
        { id: "pix", label: "Chave PIX", icon: CreditCard, keywords: "pix chave pagamento recebimento" },
        { id: "padroes", label: "Padrões de Empréstimo", icon: Percent, keywords: "juros multa taxa frequência padrão" },
      ],
    },
    {
      id: "aparencia",
      label: "Aparência & Módulos",
      items: [
        { id: "marca", label: "Marca, Cores & Tema", icon: Palette, keywords: "white label logo cor tema dark light primária" },
        { id: "modulos", label: "Módulos Ativos", icon: Package, keywords: "modulos ativos ligar desligar penhores veiculos metas tarefas" },
        { id: "portal", label: "Portal do Cliente", icon: LayoutDashboard, keywords: "portal cliente cpf branding" },
        { id: "contrato", label: "Modelo de Contrato", icon: FileText, keywords: "contrato pdf template documento" },
      ],
    },
    {
      id: "cobranca",
      label: "Cobrança Automática",
      items: [
        { id: "bot", label: "Bot de Cobranças", icon: Bot, keywords: "bot ia automático mensagem cobrança horário" },
        { id: "templates", label: "Templates de Mensagem", icon: MessageSquare, keywords: "template mensagem padrão" },
        { id: "mensagem", label: "Mensagem Padrão", icon: Send, keywords: "mensagem padrão saudação assinatura" },
      ],
    },
    {
      id: "integracoes",
      label: "Integrações",
      items: [
        { id: "whatsapp", label: "WhatsApp (Evolution)", icon: MessageSquare, keywords: "whatsapp evolution instance api" },
        { id: "notificacoes", label: "Notificações Push", icon: Bell, keywords: "push notificação alerta" },
        { id: "pwa", label: "Aplicativo Mobile", icon: Zap, keywords: "pwa android ios mobile app instalar" },
        { id: "ia-voz", label: "IA de Voz", icon: Volume2, keywords: "voz áudio tts ia" },
      ],
    },
    {
      id: "avancado",
      label: "Avançado",
      advanced: true,
      items: [
        { id: "webhooks", label: "Webhooks / N8N", icon: Webhook, keywords: "webhook n8n integração http", adminOnly: true },
        { id: "pagamentos", label: "Checkout Hubla", icon: CreditCard, keywords: "hubla checkout pagamento assinatura", adminOnly: true },
        { id: "admin_global", label: "Admin Global", icon: Shield, keywords: "admin global sistema", adminOnly: true },
      ],
    },
  ];

  const [search, setSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const visibleGroups = groups
    .map(g => ({
      ...g,
      items: g.items.filter(i => {
        if (i.adminOnly && !profile?.is_admin) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return i.label.toLowerCase().includes(q) || (i.keywords || "").toLowerCase().includes(q);
      }),
    }))
    .filter(g => g.items.length > 0 && (!g.advanced || showAdvanced || search.trim()));

  // Garante que a aba ativa exista; se busca esconder, vai para a primeira disponível
  useEffect(() => {
    const allIds = visibleGroups.flatMap(g => g.items.map(i => i.id));
    if (allIds.length && !allIds.includes(tab)) setTab(allIds[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, showAdvanced, profile?.is_admin]);

  const configSteps = [
    { label: "Marca e Logo", done: !!form.company_logo_url, tab: "marca" },
    { label: "Dados da Empresa", done: !!form.company_name, tab: "empresa" },
    { label: "Chave PIX", done: !!form.pix_key, tab: "pix" },
    { label: "WhatsApp", done: !!form.whatsapp_api_url, tab: "whatsapp" },
  ];
  const completedSteps = configSteps.filter(s => s.done).length;
  const progressPercent = (completedSteps / configSteps.length) * 100;

  const activeItem = groups.flatMap(g => g.items).find(i => i.id === tab);

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* Header sticky */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 mb-4 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Settings size={18} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-foreground truncate">Configurações</h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {activeItem ? activeItem.label : "Personalize o sistema"}
              {progressPercent < 100 && ` • ${completedSteps}/${configSteps.length} configurações essenciais`}
            </p>
          </div>
          <div className="hidden md:block relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar configuração..."
              className="w-64 pl-8 pr-3 py-2 rounded-lg bg-card border border-border/50 text-sm placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
            />
            <Settings size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
          </div>
          <button onClick={handleSave} disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition shrink-0 ${
              saved ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            }`}>
            {saved ? <><Check size={15} /> Salvo</> : saving ? "Salvando..." : <><Save size={15} /> Salvar</>}
          </button>
        </div>

        {/* Mobile search */}
        <div className="md:hidden relative mt-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar configuração..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-card border border-border/50 text-sm placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
          />
          <Settings size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
        </div>

        {/* Progress bar fina */}
        {progressPercent < 100 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-700" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-primary tabular-nums">{Math.round(progressPercent)}%</span>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-[240px_1fr] gap-5">
        {/* Sidebar nav */}
        <aside className="md:sticky md:top-32 md:self-start space-y-4 md:max-h-[calc(100vh-9rem)] md:overflow-y-auto pr-1">
          {visibleGroups.map(group => (
            <div key={group.id}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60 px-3 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = tab === item.id;
                  const done = configSteps.find(s => s.tab === item.id)?.done;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setTab(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition group ${
                        active
                          ? "bg-primary/12 text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                      }`}
                    >
                      <Icon size={15} className={active ? "text-primary" : ""} />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {done && <Check size={12} className="text-success shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!search.trim() && (
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition rounded-lg hover:bg-accent/20"
            >
              <Shield size={12} />
              {showAdvanced ? "Ocultar avançado" : "Mostrar avançado"}
            </button>
          )}
        </aside>

        {/* Conteúdo */}
        <div className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-md p-6 md:p-8 space-y-8 animate-fade-in shadow-xl min-w-0">

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
            <div className="space-y-6 p-6 rounded-2xl border border-border/20 bg-background/20 backdrop-blur-sm">
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
                <p className="text-[10px] text-muted-foreground mt-1">Aparece no menu lateral, topbar, login e título do navegador</p>
              </div>

              {/* Favicon */}
              <div className="flex items-center gap-4 pt-2 border-t border-border/20">
                <div className="w-14 h-14 rounded-xl bg-muted/30 border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
                  {form.favicon_url ? (
                    <img src={form.favicon_url} alt="Favicon" className="w-full h-full object-cover" />
                  ) : (
                    <Image size={18} className="text-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <p className="text-xs font-medium text-foreground">Favicon (ícone da aba)</p>
                  <input ref={faviconInputRef} type="file" accept="image/*" onChange={handleUploadFavicon} className="hidden" />
                  <div className="flex gap-2">
                    <button onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-accent/30 transition-colors disabled:opacity-50">
                      <Upload size={12} /> {uploadingFavicon ? "Enviando..." : "Enviar favicon"}
                    </button>
                    {form.favicon_url && (
                      <button onClick={() => setForm({ ...form, favicon_url: "" })}
                        className="text-[10px] text-destructive hover:underline">Remover</button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Recomendado: PNG quadrado 64×64 ou 128×128</p>
                </div>
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

            <details className="group rounded-2xl border border-border/30 bg-background/20 backdrop-blur-sm overflow-hidden">
              <summary className="cursor-pointer select-none px-5 py-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                <span className="flex items-center gap-2"><Settings size={12} className="text-primary" /> Personalização Avançada</span>
                <span className="text-[10px] opacity-60 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="p-4 space-y-6 border-t border-border/20">

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
              </div>
            </details>
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

                {/* AI and Negotiation */}
                <div className="space-y-4 p-4 rounded-2xl border border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-primary" />
                    <p className="text-sm font-semibold text-foreground">Inteligência Artificial</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">Gerar Mensagens com IA</p>
                        <p className="text-[10px] text-muted-foreground">Usa o Lovable AI para criar mensagens personalizadas e persuasivas</p>
                      </div>
                      <button 
                        onClick={() => setForm({ ...form, bot_use_ai: !form.bot_use_ai })}
                        className={`w-10 h-6 rounded-full transition-colors relative ${form.bot_use_ai ? "bg-primary" : "bg-muted"}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.bot_use_ai ? "left-5" : "left-1"}`} />
                      </button>
                    </div>


                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">Enviar Áudio (Beta)</p>
                        <p className="text-[10px] text-muted-foreground">O bot envia áudios curtos personalizados (TTS)</p>
                      </div>
                      <button 
                        onClick={() => setForm({ ...form, bot_send_audio: !form.bot_send_audio })}
                        className={`w-10 h-6 rounded-full transition-colors relative ${form.bot_send_audio ? "bg-primary" : "bg-muted"}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.bot_send_audio ? "left-5" : "left-1"}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">Entender Áudios</p>
                        <p className="text-[10px] text-muted-foreground">O bot transcreve e entende o que o cliente fala em áudio</p>
                      </div>
                      <button 
                        onClick={() => setForm({ ...form, bot_process_audio: !form.bot_process_audio })}
                        className={`w-10 h-6 rounded-full transition-colors relative ${form.bot_process_audio ? "bg-primary" : "bg-muted"}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.bot_process_audio ? "left-5" : "left-1"}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">Reconhecer Comprovantes</p>
                        <p className="text-[10px] text-muted-foreground">O bot analisa imagens para identificar comprovantes de pagamento</p>
                      </div>
                      <button 
                        onClick={() => setForm({ ...form, bot_process_receipts: !form.bot_process_receipts })}
                        className={`w-10 h-6 rounded-full transition-colors relative ${form.bot_process_receipts ? "bg-primary" : "bg-muted"}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.bot_process_receipts ? "left-5" : "left-1"}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">Baixa Automática (Smart Pay)</p>
                        <p className="text-[10px] text-muted-foreground">Dá baixa na parcela automaticamente após validar o comprovante</p>
                      </div>
                      <button 
                        onClick={() => setForm({ ...form, bot_auto_confirm_payment: !form.bot_auto_confirm_payment })}
                        className={`w-10 h-6 rounded-full transition-colors relative ${form.bot_auto_confirm_payment ? "bg-primary" : "bg-muted"}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.bot_auto_confirm_payment ? "left-5" : "left-1"}`} />
                      </button>
                    </div>
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
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground mb-1">Como as multas funcionam</p>
              <p>
                <span className="text-foreground font-medium">Multa de atraso</span>: aplicada <span className="text-foreground">uma única vez</span> sobre o valor da parcela assim que ela fica atrasada.<br/>
                <span className="text-foreground font-medium">Juros diário</span>: somado <span className="text-foreground">a cada dia</span> de atraso sobre o valor da parcela.
              </p>
              <p className="mt-1.5 italic">Ex.: parcela R$ 100 com multa 10% → R$ 110 no 1º dia. Com juros 0,33%/dia, no 5º dia: 110 + (100 × 0,33% × 5) = R$ 111,65.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-label mb-1.5 block">Multa de atraso (% sobre a parcela)</label>
                <input type="number" step="0.01" value={form.default_late_fee} onChange={(e) => setForm({ ...form, default_late_fee: e.target.value })} className={inputCls} />
                <p className="text-[10px] text-muted-foreground mt-1">Aplicada 1x quando a parcela vence sem pagamento.</p>
              </div>
              <div>
                <label className="text-label mb-1.5 block">Juros diário (% por dia atrasado)</label>
                <input type="number" step="0.01" value={form.default_daily_interest} onChange={(e) => setForm({ ...form, default_daily_interest: e.target.value })} className={inputCls} />
                <p className="text-[10px] text-muted-foreground mt-1">Acumulativo: % × dias × valor da parcela.</p>
              </div>
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
              <div>
                <label className="text-label mb-1.5 block">
                  API Key {(settings as any)?.whatsapp_api_key_configured && <span className="ml-2 text-[10px] text-success font-bold">✓ Configurada</span>}
                </label>
                <input type="password" value={form.whatsapp_api_key} onChange={(e) => setForm({ ...form, whatsapp_api_key: e.target.value })} placeholder={(settings as any)?.whatsapp_api_key_configured ? "••••••••  (deixe vazio para manter)" : "Cole a chave da Evolution API"} className={inputCls} />
                <p className="text-[10px] text-muted-foreground mt-1">Por segurança, a chave nunca é exibida. Digite uma nova para substituir.</p>
              </div>
            </div>
          </>
        )}

        {tab === "templates" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><MessageSquare size={16} className="text-primary" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Templates de Mensagem</h2>
                <p className="text-xs text-muted-foreground">Use [Nome], [Valor], [Dias], [Portal] como variáveis.</p>
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

        {tab === "webhooks" && profile?.is_admin && (
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

        {tab === "contrato" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><FileText size={16} className="text-primary" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Modelo de Contrato Personalizado</h2>
                <p className="text-xs text-muted-foreground">Cole seu próprio contrato. Ao fechar um empréstimo, os campos são preenchidos automaticamente.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-foreground/90">
              <p className="font-semibold mb-1.5 flex items-center gap-1.5"><Info size={12} /> Como funciona</p>
              <p>Use as variáveis abaixo entre <code className="bg-muted px-1 rounded">{"{{ }}"}</code> no texto. Quando o contrato for gerado, elas serão trocadas pelos dados reais do cliente e do empréstimo.</p>
              <p className="mt-1.5">Para repetir cada parcela, envolva uma linha em <code className="bg-muted px-1 rounded">{"{{#parcelas}}...{{/parcelas}}"}</code> usando <code className="bg-muted px-1 rounded">{"{{numero}}"}</code>, <code className="bg-muted px-1 rounded">{"{{vencimento}}"}</code> e <code className="bg-muted px-1 rounded">{"{{valor}}"}</code>.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Variáveis disponíveis (clique para copiar)</label>
              <div className="flex flex-wrap gap-1.5">
                {CONTRACT_PLACEHOLDERS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(`{{${p.key}}}`);
                      toast({ title: `✓ {{${p.key}}} copiado` });
                    }}
                    title={p.desc}
                    className="px-2 py-1 rounded-md bg-muted/40 hover:bg-primary/15 text-[11px] font-mono text-foreground border border-border transition-colors"
                  >
                    {`{{${p.key}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">Texto do contrato</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, custom_contract_template: DEFAULT_CONTRACT_TEMPLATE })}
                    className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-accent/30"
                  >
                    <RotateCcw size={11} /> Carregar modelo padrão
                  </button>
                  {form.custom_contract_template && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, custom_contract_template: "" })}
                      className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={11} /> Limpar (usar layout do sistema)
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={form.custom_contract_template}
                onChange={(e) => setForm({ ...form, custom_contract_template: e.target.value })}
                rows={20}
                placeholder="Cole aqui o texto do seu contrato. Ex: Contrato firmado entre {{empresa_nome}} e {{cliente_nome}} no valor de {{capital}}..."
                className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground font-mono leading-relaxed input-enhanced"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {form.custom_contract_template?.trim()
                  ? "✓ Modelo personalizado ativo — será usado em todos os novos contratos."
                  : "Sem modelo personalizado — o sistema usará o layout padrão."}
              </p>
            </div>
          </div>
        )}

        {tab === "modulos" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><Package size={16} className="text-primary" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Módulos Ativos</h2>
                <p className="text-xs text-muted-foreground">Ligue ou desligue módulos para simplificar o menu lateral</p>
              </div>
            </div>

            {([
              { group: "Visão Geral & Relatórios", items: [
                ["analises", "Análises", "Gráficos e indicadores avançados"],
                ["relatorios", "Relatórios", "Relatórios em PDF e Excel"],
              ]},
              { group: "Operação", items: [
                ["inadimplencia", "Inadimplência", "Painel de clientes em atraso"],
                ["cobradores", "Cobradores", "Gestão de cobradores externos"],
                ["portais", "Portais (QR Code)", "Portal do cliente e do cobrador"],
              ]},
              { group: "Financeiro", items: [
                ["lucros", "Lucros", "Painel de lucros gerados"],
                ["gastos", "Gastos", "Controle de despesas"],
              ]},
              { group: "Comunicação", items: [
                ["comunicacao_inbox", "Inbox WhatsApp", "Conversas do WhatsApp dentro do app"],
                ["chat_interno", "Chat interno", "Chat entre operadores"],
              ]},
              { group: "Ferramentas", items: [
                ["simulador", "Simulador", "Simulador de empréstimos"],
                ["metas", "Metas", "Definição e acompanhamento de metas"],
                ["tarefas", "Tarefas", "Lista de tarefas pessoais"],
                ["anotacoes", "Anotações", "Bloco de notas"],
                ["planilha", "Planilha", "Planilha estilo Excel"],
                ["puxada_dados", "Puxada de Dados", "Consulta CPF/CNPJ"],
              ]},
              { group: "Módulos extras (off por padrão)", items: [
                ["penhores", "Penhores", "Gestão de itens em penhor"],
                ["veiculos", "Veículos", "Gestão de veículos financiados"],
                ["alugueis", "Aluguéis", "Gestão de aluguéis"],
                ["estoque", "Estoque", "Controle de estoque"],
              ]},
            ] as { group: string; items: [ModuleKey, string, string][] }[]).map(section => (
              <div key={section.group} className="rounded-2xl border border-border/30 bg-background/20 p-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">{section.group}</p>
                <div className="space-y-1.5">
                  {section.items.map(([key, label, desc]) => {
                    const enabled = form.modules_enabled[key] ?? false;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, modules_enabled: { ...f.modules_enabled, [key]: !enabled } }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${enabled ? "border-primary/40 bg-primary/8" : "border-border/40 hover:bg-accent/20"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          <p className="text-[11px] text-muted-foreground">{desc}</p>
                        </div>
                        <div className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${enabled ? "bg-primary" : "bg-muted"}`}>
                          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex gap-2">
              <Info size={14} className="text-primary shrink-0 mt-0.5" />
              <span>As alterações aparecem no menu lateral após salvar e recarregar a página. Módulos desligados continuam acessíveis pela URL direta — isso apenas limpa o menu.</span>
            </div>
          </div>
        )}

        {tab === "portal" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><LayoutDashboard size={16} className="text-primary" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Configurações do Portal do Cliente</h2>
                <p className="text-xs text-muted-foreground">Personalize a experiência do seu cliente ao acessar o portal</p>
              </div>
            </div>

            {/* Link do Portal */}
            <div className="space-y-3 p-4 rounded-2xl border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={12} /> Link de Acesso ao Portal
                </p>
                <button onClick={() => {
                  const url = `${window.location.origin}/portal-cliente`;
                  navigator.clipboard.writeText(url);
                  toast({ title: "Link copiado!" });
                }} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
                  <Copy size={10} /> Copiar Link
                </button>
              </div>
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
                <p className="text-xs text-muted-foreground truncate flex-1 font-mono">
                  {window.location.origin}/portal-cliente
                </p>
                <button onClick={() => window.open(`${window.location.origin}/portal-cliente`, "_blank")} className="p-1 rounded-lg hover:bg-accent text-muted-foreground transition-colors" title="Abrir link">
                  <ExternalLink size={14} />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Este link é único e pode ser compartilhado com todos os seus clientes. Eles acessarão os dados individuais usando o CPF e a data de nascimento cadastrados.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4 p-4 rounded-2xl border border-border bg-accent/5">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Textos e Identidade</p>
                
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Título do Portal</label>
                  <input value={form.portal_title} onChange={(e) => setForm({ ...form, portal_title: e.target.value })} placeholder="Portal do Cliente" className={inputCls} />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subtítulo do Portal</label>
                  <input value={form.portal_subtitle} onChange={(e) => setForm({ ...form, portal_subtitle: e.target.value })} placeholder="Acompanhe seus contratos e pagamentos" className={inputCls} />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mensagem de Boas-vindas</label>
                  <textarea value={form.portal_welcome_message} onChange={(e) => setForm({ ...form, portal_welcome_message: e.target.value })} placeholder="Olá, seja bem-vindo ao seu portal financeiro." className={`${inputCls} min-h-[80px] resize-none`} />
                </div>
              </div>

              <div className="space-y-4 p-4 rounded-2xl border border-border bg-accent/5">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Canais de Contato</p>
                
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Telefone de Suporte</label>
                  <input value={form.portal_contact_phone} onChange={(e) => setForm({ ...form, portal_contact_phone: e.target.value })} placeholder="(00) 00000-0000" className={inputCls} />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">E-mail de Contato</label>
                  <input value={form.portal_contact_email} onChange={(e) => setForm({ ...form, portal_contact_email: e.target.value })} placeholder="suporte@empresa.com" className={inputCls} />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cor Primária do Portal</label>
                  <div className="flex gap-2">
                    <input type="color" value={form.portal_primary_color || form.primary_color} onChange={(e) => setForm({ ...form, portal_primary_color: e.target.value })} className="h-10 w-10 rounded-lg border border-border bg-transparent cursor-pointer" />
                    <input value={form.portal_primary_color || form.primary_color} onChange={(e) => setForm({ ...form, portal_primary_color: e.target.value })} className={inputCls} />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-accent/5 space-y-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Image size={12} className="text-primary" /> Logo Exclusiva do Portal (opcional)
              </p>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-muted/30 border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
                  {form.portal_logo_url ? (
                    <img src={form.portal_logo_url} alt="Logo Portal" className="w-full h-full object-cover" />
                  ) : form.company_logo_url ? (
                    <img src={form.company_logo_url} alt="Logo padrão" className="w-full h-full object-cover opacity-50" />
                  ) : (
                    <Image size={20} className="text-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <input ref={portalLogoInputRef} type="file" accept="image/*" onChange={handleUploadPortalLogo} className="hidden" />
                  <div className="flex gap-2">
                    <button onClick={() => portalLogoInputRef.current?.click()} disabled={uploadingPortalLogo}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-accent/30 transition-colors disabled:opacity-50">
                      <Upload size={12} /> {uploadingPortalLogo ? "Enviando..." : "Enviar logo do portal"}
                    </button>
                    {form.portal_logo_url && (
                      <button onClick={() => setForm({ ...form, portal_logo_url: "" })}
                        className="text-[10px] text-destructive hover:underline self-center">Remover</button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Se vazio, o portal usará a logo definida na aba <strong>Marca</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "admin_global" && profile?.is_admin && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center"><Shield size={16} className="text-amber-500" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Configurações de Administrador</h2>
                <p className="text-xs text-muted-foreground">Parâmetros que afetam toda a infraestrutura</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 rounded-2xl border border-border bg-accent/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto-aprovação de Cobradores</p>
                    <p className="text-[10px] text-muted-foreground">Novos cobradores podem começar sem revisão manual</p>
                  </div>
                  <input type="checkbox" className="w-4 h-4 accent-primary" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Retenção de Auditoria (Dias)</p>
                    <p className="text-[10px] text-muted-foreground">Tempo que os logs de sistema são mantidos (padrão 90)</p>
                  </div>
                  <input type="number" defaultValue={90} className="w-20 bg-input border border-border rounded-lg px-2 py-1 text-xs" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Backup Diário Automático</p>
                    <p className="text-[10px] text-muted-foreground">Exportar dados críticos para storage externo</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary" />
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-accent/5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Limites da Plataforma</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Espaço em Disco</span>
                    <span className="font-mono">1.2GB / 5GB</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary w-[24%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "pwa" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Zap size={16} className="text-primary" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Transformar em Aplicativo Mobile</h2>
                <p className="text-xs text-muted-foreground">Instale o sistema no Android ou iPhone sem precisar de loja</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-[2rem] border border-border/10 bg-card/30 backdrop-blur-xl space-y-4">
                <h3 className="text-sm font-bold text-foreground">🤖 Para Android</h3>
                <div className="space-y-3 text-xs text-muted-foreground">
                  <p>1. Acesse o sistema pelo <strong>Google Chrome</strong>.</p>
                  <p>2. Toque nos <strong>três pontos (⋮)</strong> no canto superior direito.</p>
                  <p>3. Clique em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</p>
                  <p>4. O ícone aparecerá na sua lista de apps como um aplicativo nativo.</p>
                </div>
              </div>

              <div className="p-5 rounded-[2rem] border border-border/10 bg-card/30 backdrop-blur-xl space-y-4">
                <h3 className="text-sm font-bold text-foreground">🍎 Para iPhone (iOS)</h3>
                <div className="space-y-3 text-xs text-muted-foreground">
                  <p>1. Acesse o sistema pelo <strong>Safari</strong>.</p>
                  <p>2. Toque no ícone de <strong>Compartilhar (quadrado com seta)</strong>.</p>
                  <p>3. Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.</p>
                  <p>4. Confirme tocando em <strong>"Adicionar"</strong> no canto superior.</p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-[2rem] border border-primary/20 bg-primary/5 flex flex-col items-center text-center space-y-3">
               <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-xl mb-2">
                  <img src="/favicon.webp" alt="App Icon" className="w-full h-full object-contain" />
               </div>
               <h4 className="font-bold text-foreground">Sua Logo no Celular</h4>
               <p className="text-xs text-muted-foreground max-w-xs">Ao instalar o app, sua marca configurada na aba "Marca" será usada como ícone oficial na tela do cliente.</p>
            </div>
          </div>
        )}

        {tab === "ia-voz" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center"><Volume2 size={16} className="text-violet-400" /></div>
              <div>
                <h2 className="font-semibold text-foreground">IA de Voz e Áudio Personalizado</h2>
                <p className="text-xs text-muted-foreground">O Agente IA envia áudios que parecem humanos para seus devedores</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-6 rounded-[2rem] border border-border/10 bg-card/30 backdrop-blur-xl space-y-6">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-violet-500/5 border border-violet-500/20">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center animate-pulse">
                        <Bot size={18} className="text-violet-400" />
                     </div>
                     <div>
                        <p className="text-xs font-bold text-foreground">Voz Humanizada Ativa</p>
                        <p className="text-[10px] text-muted-foreground">Usando ElevenLabs AI para realismo total</p>
                     </div>
                  </div>
                  <div className="w-12 h-6 rounded-full bg-violet-500/30 relative cursor-not-allowed opacity-50">
                     <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white shadow-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Escolher Narrador</label>
                     <select className={inputCls}>
                        <option>Voz Masculina (Rodrigo - Firme)</option>
                        <option>Voz Feminina (Helena - Amigável)</option>
                        <option>Voz Masculina (Arthur - Formal)</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tom de Voz</label>
                     <select className={inputCls}>
                        <option>Persuasivo e Educado</option>
                        <option>Urgente e Sério</option>
                        <option>Conciliador (Acordos)</option>
                     </select>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-primary/5 border border-border/10 space-y-3">
                   <p className="text-xs font-medium text-foreground">Exemplo de Roteiro Gerado pela IA:</p>
                 <div className="p-3 rounded-xl bg-background/50 border border-border/5 text-[11px] italic text-muted-foreground leading-relaxed">
                   "Olá Cliente, aqui é o assistente virtual da {form.company_name || 'System Juros'}. Notei que sua parcela de R$ 450,00 está pendente há 3 dias. Quero te ajudar a não acumular juros. Podemos fechar um acordo via PIX agora?"
                 </div>
                </div>

                <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm shadow-xl shadow-violet-500/20 hover:scale-[1.02] active:scale-95 transition-all opacity-50 cursor-not-allowed">
                   Disponível em Breve para sua Conta
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "pagamentos" && (
          <div className="space-y-6 animate-fade-in">
            <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <CreditCard className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Checkout Hubla</h3>
                  <p className="text-[11px] text-muted-foreground">Configure os links de pagamento para novos usuários</p>
                </div>
              </div>
              
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-label">URL de Checkout Principal</label>
                  <input 
                    type="url" 
                    value={form.hubla_checkout_url} 
                    onChange={(e) => setForm({ ...form, hubla_checkout_url: e.target.value })}
                    placeholder="https://checkout.hubla.com/..." 
                    className={inputCls} 
                  />
                  <p className="text-[10px] text-muted-foreground">Link para o qual o sistema redireciona quando a assinatura expira.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-label">
                    Token do Webhook Hubla (Segurança)
                    {(settings as any)?.hubla_webhook_token_configured && <span className="ml-2 text-[10px] text-success font-bold">✓ Configurado</span>}
                  </label>
                  <div className="relative">
                    <Key size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      type="password" 
                      value={form.hubla_webhook_token} 
                      onChange={(e) => setForm({ ...form, hubla_webhook_token: e.target.value })}
                      placeholder={(settings as any)?.hubla_webhook_token_configured ? "••••••••  (deixe vazio para manter)" : "Token de segurança registrado na Hubla"} 
                      className={`${inputCls} pl-10`} 
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Obrigatório para validar que as notificações de pagamento vêm realmente da Hubla. Por segurança, o token nunca é exibido.</p>
                </div>
                
                <div className="bg-card/50 border border-border/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-foreground uppercase tracking-wider">
                    <Webhook size={14} className="text-primary" />
                    URL de Notificação (Webhook)
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-background/50 rounded-xl border border-border/30">
                    <code className="flex-1 text-[10px] text-primary break-all select-all">
                      https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/hubla-webhook
                    </code>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText("https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/hubla-webhook");
                        toast({ title: "Copiado!" });
                      }}
                      className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Copy size={12} className="text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Configure esta URL na sua dashboard da Hubla para ativar o processamento automático.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};


export default Configuracoes;
