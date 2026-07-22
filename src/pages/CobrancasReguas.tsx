import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Trash2, Save, Send, Sparkles, Clock, AlertTriangle,
  CalendarClock, Loader2, MessageSquare, Eye, GripVertical
} from "lucide-react";

interface Rule {
  days: number; // <=0 = D-N (antes), >0 = D+N (atraso)
  template: string;
  active?: boolean;
}

const PRESET: Rule[] = [
  { days: -3, template: "Olá {{cliente}}! Sua parcela de {{valor}} vence em 3 dias ({{vencimento}}). PIX: {{pix}}", active: true },
  { days:  0, template: "Oi {{cliente}}, hoje é o vencimento da sua parcela de {{valor}}. PIX: {{pix}}. Qualquer dúvida, chame aqui.", active: true },
  { days:  1, template: "{{cliente}}, sua parcela venceu ontem. Consegue quitar hoje? Valor atualizado: {{valor_total}}. PIX: {{pix}}", active: true },
  { days:  7, template: "{{cliente}}, já são 7 dias de atraso. Vamos regularizar? Valor atualizado: {{valor_total}}. Falar comigo: {{whatsapp}}", active: true },
  { days: 15, template: "{{cliente}}, sua parcela está com 15 dias de atraso. Posso te oferecer um acordo. Chame aqui!", active: true },
  { days: 30, template: "{{cliente}}, sua situação está grave: 30 dias de atraso. Quero te ajudar a resolver hoje. Vamos conversar?", active: true },
];

const VARS = [
  { k: "{{cliente}}", d: "Nome do cliente" },
  { k: "{{valor}}", d: "Valor da parcela" },
  { k: "{{valor_total}}", d: "Valor + multa + juros" },
  { k: "{{vencimento}}", d: "Data de vencimento" },
  { k: "{{parcela}}", d: "Nº da parcela" },
  { k: "{{empresa}}", d: "Nome da empresa" },
  { k: "{{pix}}", d: "Chave PIX" },
  { k: "{{whatsapp}}", d: "Seu WhatsApp" },
];

const labelFor = (r: Rule) =>
  r.days === 0 ? "D0 · No dia" : r.days < 0 ? `D${r.days} · ${Math.abs(r.days)}d antes` : `D+${r.days} · ${r.days}d de atraso`;

const CobrancasReguas = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [meta, setMeta] = useState({ company: "", pix: "", whatsapp: "" });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("settings")
        .select("bot_escalation_rules, bot_enabled, company_name, whatsapp_contact")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: profile } = await supabase
        .from("profiles").select("pix_key").eq("id", user.id).maybeSingle();
      const raw = (data?.bot_escalation_rules as any[]) || [];
      setRules(raw.length ? raw.map((r) => ({ days: Number(r.days), template: r.template || "", active: r.active !== false })) : []);
      setEnabled(!!data?.bot_enabled);
      setMeta({
        company: data?.company_name || "sua empresa",
        pix: (profile as any)?.pix_key || "chave-pix",
        whatsapp: (data as any)?.whatsapp_contact || "(11) 90000-0000",
      });
      setLoading(false);
    })();
  }, [user]);

  const sorted = useMemo(() => rules.slice().sort((a, b) => a.days - b.days), [rules]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .update({ bot_escalation_rules: rules as any, bot_enabled: enabled })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: "Réguas salvas", description: `${rules.length} regras ativas.` });
  };

  const addRule = () => setRules((r) => [...r, { days: 0, template: "", active: true }]);
  const loadPreset = () => setRules(PRESET);
  const remove = (i: number) => setRules((r) => r.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<Rule>) =>
    setRules((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const insertVar = (i: number, v: string) => {
    setRules((r) => r.map((row, idx) => (idx === i ? { ...row, template: (row.template || "") + " " + v } : row)));
  };

  const renderPreview = (tpl: string) => {
    const now = new Date();
    return tpl
      .replaceAll("{{cliente}}", "João Silva")
      .replaceAll("{{valor}}", "R$ 480,00")
      .replaceAll("{{valor_total}}", "R$ 528,50")
      .replaceAll("{{vencimento}}", now.toLocaleDateString("pt-BR"))
      .replaceAll("{{parcela}}", "3")
      .replaceAll("{{empresa}}", meta.company)
      .replaceAll("{{pix}}", meta.pix)
      .replaceAll("{{whatsapp}}", meta.whatsapp);
  };

  const dispatchNow = async () => {
    setDispatching(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-collection", { body: { manual: true } });
      if (error) throw error;
      toast({ title: "Disparo realizado", description: `${(data as any)?.sent ?? "?"} mensagem(ns) processadas.` });
    } catch (e: any) {
      toast({ title: "Erro no disparo", description: e.message, variant: "destructive" });
    } finally {
      setDispatching(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Carregando réguas...</div>;

  return (
    <div className="space-y-5">
      {/* Header + master toggle */}
      <Card className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card border-primary/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <CalendarClock size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Réguas de Cobrança</h2>
              <p className="text-sm text-muted-foreground max-w-xl">Configure quando e o que o bot envia por WhatsApp em cada estágio: antes do vencimento (D-3, D-1), no dia (D0) e no atraso (D+1, D+7...).</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <span className="text-xs font-semibold">{enabled ? "Cron ativo" : "Pausado"}</span>
            </div>
            <Button variant="outline" onClick={loadPreset} className="gap-2 rounded-xl border-primary/30">
              <Sparkles size={14} /> Modelo sugerido
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2 rounded-xl">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
            </Button>
          </div>
        </div>
      </Card>

      {/* Ruler visualization */}
      <Card className="p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Clock size={16} className="text-primary" /><span className="font-semibold text-sm">Linha do tempo</span></div>
          <Badge variant="secondary" className="text-[10px]">{sorted.filter(r => r.active !== false).length} ativas / {sorted.length} totais</Badge>
        </div>
        <div className="relative">
          <div className="h-1 bg-gradient-to-r from-emerald-500/40 via-amber-500/40 to-destructive/50 rounded-full" />
          <div className="absolute inset-x-0 -top-1 flex justify-between">
            {sorted.length === 0 ? (
              <span className="text-xs text-muted-foreground py-2">Nenhuma régua configurada. Comece pelo modelo sugerido.</span>
            ) : sorted.map((r, i) => (
              <div key={i} className="flex flex-col items-center" style={{ maxWidth: 80 }}>
                <div className={`w-3 h-3 rounded-full border-2 border-background ${r.days <= 0 ? "bg-emerald-500" : r.days < 7 ? "bg-amber-500" : "bg-destructive"} ${r.active === false ? "opacity-30" : ""}`} />
                <span className="mt-1 text-[10px] font-bold whitespace-nowrap">{r.days === 0 ? "D0" : r.days < 0 ? `D${r.days}` : `D+${r.days}`}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Rules list */}
      <div className="space-y-3">
        {sorted.map((r, i) => {
          // find original index for update
          const origIdx = rules.findIndex((x) => x === r);
          const kind = r.days <= 0 ? "pre" : "over";
          return (
            <Card key={i} className={`p-4 rounded-2xl border-l-4 ${kind === "pre" ? "border-l-emerald-500" : r.days < 7 ? "border-l-amber-500" : "border-l-destructive"}`}>
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="lg:w-56 flex lg:flex-col gap-3 items-start">
                  <div className="flex items-center gap-2">
                    <GripVertical size={14} className="text-muted-foreground" />
                    <Badge variant={kind === "pre" ? "secondary" : "destructive"} className="uppercase tracking-wider text-[10px]">
                      {kind === "pre" ? "Preventiva" : "Atraso"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground font-semibold uppercase">Dias</label>
                    <Input
                      type="number"
                      value={r.days}
                      onChange={(e) => update(origIdx, { days: parseInt(e.target.value) || 0 })}
                      className="h-9 w-20 text-center font-bold"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{labelFor(r)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Switch checked={r.active !== false} onCheckedChange={(v) => update(origIdx, { active: v })} />
                    <span className="text-xs">{r.active !== false ? "Ativa" : "Pausada"}</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <Textarea
                    value={r.template}
                    onChange={(e) => update(origIdx, { template: e.target.value })}
                    placeholder="Mensagem a enviar. Use variáveis como {{cliente}}, {{valor}}, {{pix}}"
                    rows={3}
                    maxLength={800}
                    className="rounded-xl text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {VARS.map((v) => (
                      <button
                        key={v.k}
                        type="button"
                        onClick={() => insertVar(origIdx, v.k)}
                        className="text-[10px] px-2 py-1 rounded-lg bg-accent hover:bg-primary/10 hover:text-primary transition font-mono"
                        title={v.d}
                      >
                        {v.k}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:w-56 flex lg:flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewIdx(previewIdx === origIdx ? null : origIdx)} className="gap-2 rounded-xl w-full">
                    <Eye size={14} /> {previewIdx === origIdx ? "Ocultar" : "Pré-visualizar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => remove(origIdx)} className="gap-2 rounded-xl w-full text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 size={14} /> Remover
                  </Button>
                </div>
              </div>

              {previewIdx === origIdx && (
                <div className="mt-3 pt-3 border-t border-dashed border-border">
                  <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    <MessageSquare size={12} /> Pré-visualização
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-sm whitespace-pre-wrap font-medium">
                    {renderPreview(r.template) || <span className="text-muted-foreground italic">Escreva a mensagem acima…</span>}
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={addRule} className="gap-2 rounded-xl border-dashed border-2 py-6 flex-1 min-w-[200px]">
            <Plus size={16} /> Adicionar régua
          </Button>
          <Button onClick={dispatchNow} disabled={dispatching || !enabled} className="gap-2 rounded-xl py-6 flex-1 min-w-[200px] bg-gradient-to-r from-primary to-emerald-500">
            {dispatching ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Disparar agora (em lote)
          </Button>
        </div>

        {!enabled && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span>O cron diário está pausado. Ative acima para o bot enviar automaticamente todos os dias, ou use "Disparar agora" para testar manualmente.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CobrancasReguas;
