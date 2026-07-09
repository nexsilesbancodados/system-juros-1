import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldOff, Loader2, KeyRound, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Factor = { id: string; friendly_name?: string | null; status: string; factor_type: string };

/**
 * Ativação de 2FA (TOTP) via Supabase Auth MFA.
 * O usuário escaneia o QR num app autenticador (Google Authenticator, Authy, 1Password)
 * e digita o código de 6 dígitos para confirmar.
 */
export default function MFACard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error) setFactors(data?.totp || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Autenticador (${new Date().toLocaleDateString("pt-BR")})`,
    });
    setEnrolling(false);
    if (error) {
      toast({ title: "Erro ao iniciar 2FA", description: error.message, variant: "destructive" });
      return;
    }
    setQr({
      factorId: data.id,
      qrCode: (data.totp as any)?.qr_code || "",
      secret: (data.totp as any)?.secret || "",
    });
    setCode("");
  };

  const verify = async () => {
    if (!qr || code.length < 6) return;
    setVerifying(true);
    const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId: qr.factorId });
    if (cErr || !chal) {
      setVerifying(false);
      toast({ title: "Erro", description: cErr?.message || "Falha ao gerar desafio", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: qr.factorId, challengeId: chal.id, code,
    });
    setVerifying(false);
    if (error) {
      toast({ title: "Código inválido", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ 2FA ativado", description: "Autenticação em dois fatores está ativa nesta conta." });
    setQr(null); setCode("");
    load();
  };

  const cancel = async () => {
    if (!qr) return;
    await supabase.auth.mfa.unenroll({ factorId: qr.factorId });
    setQr(null); setCode("");
  };

  const disable = async (id: string) => {
    if (!confirm("Desativar 2FA? Sua conta ficará protegida apenas pela senha.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "2FA desativado" }); load(); }
  };

  const copySecret = async () => {
    if (!qr) return;
    await navigator.clipboard.writeText(qr.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const active = factors.filter(f => f.status === "verified");

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4 card-shine">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
          <ShieldCheck size={16} className="text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Autenticação em 2 fatores</h2>
          <p className="text-[11px] text-muted-foreground">Camada extra de segurança no login</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      ) : qr ? (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Escaneie o QR code no <strong>Google Authenticator</strong>, <strong>Authy</strong> ou <strong>1Password</strong> e digite o código de 6 dígitos.
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {qr.qrCode ? (
              <img src={qr.qrCode} alt="QR 2FA" className="w-40 h-40 bg-white p-2 rounded-xl border border-border" />
            ) : (
              <div className="w-40 h-40 rounded-xl bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                Sem QR
              </div>
            )}
            <div className="flex-1 w-full space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Chave secreta (backup)</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-[11px] font-mono px-2 py-1.5 rounded bg-muted/40 border border-border break-all">{qr.secret}</code>
                  <button onClick={copySecret} className="p-2 rounded-lg hover:bg-accent" title="Copiar">
                    {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Código de 6 dígitos</label>
                <input
                  inputMode="numeric" maxLength={6} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-card border border-border text-center font-mono text-lg tracking-widest"
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={verify} disabled={verifying || code.length < 6}
                  className="btn-premium flex-1 disabled:opacity-50">
                  {verifying ? <><Loader2 size={14} className="animate-spin" /> Verificando…</> : <>Ativar 2FA</>}
                </button>
                <button onClick={cancel} className="px-4 py-2.5 rounded-xl text-sm border border-border hover:bg-accent">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : active.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-success">
            <ShieldCheck size={16} /> 2FA está ativo nesta conta.
          </div>
          {active.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
              <div className="flex items-center gap-2 text-sm">
                <KeyRound size={14} className="text-primary" />
                <span>{f.friendly_name || "Autenticador TOTP"}</span>
              </div>
              <button onClick={() => disable(f.id)} className="flex items-center gap-1.5 text-xs text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg">
                <ShieldOff size={12} /> Desativar
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Ative o 2FA para exigir um código do seu app autenticador toda vez que fizer login — mesmo que roubem sua senha, ninguém entra sem o segundo fator.
          </p>
          <button onClick={startEnroll} disabled={enrolling} className="btn-premium">
            {enrolling ? <><Loader2 size={14} className="animate-spin" /> Preparando…</> : <><ShieldCheck size={14} /> Ativar 2FA</>}
          </button>
        </div>
      )}
    </div>
  );
}
