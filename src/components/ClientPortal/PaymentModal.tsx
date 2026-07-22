import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, Copy, Check, QrCode, Receipt, Calendar,
  Download, Info, Loader2, MessageCircle, X, Upload
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generatePortalReceiptPdf } from "@/utils/portalPdf";
import { QRCodeSVG } from "qrcode.react";
import { generatePixPayload } from "@/utils/pixGenerator";
import { formatBR } from "@/lib/dateUtils";
import { computeLateFee } from "@/lib/lateFee";

interface PaymentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  installment: any;
  ownerProfile: any;
  clientData: any;
  contactPhone?: string | null;
}


export const PaymentModal = ({ isOpen, onOpenChange, installment, ownerProfile, clientData, contactPhone }: PaymentModalProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const isOverdue = installment?.status === "overdue" ||
    (installment && installment.status !== "paid" && new Date(installment.due_date) < new Date());
  const isPaid = installment?.status === "paid";

  const liveFee = useMemo(() => {
    if (!installment) return 0;
    return computeLateFee(installment);
  }, [installment]);

  const totalDue = useMemo(() => {
    if (!installment) return 0;
    if (isPaid) return Number(installment.paid_amount || installment.amount) + Number(installment.late_fee || 0);
    return Number(installment.amount || 0) + liveFee;
  }, [installment, isPaid, liveFee]);

  const pixPayload = useMemo(() => {
    if (!installment || !ownerProfile?.pix_key || isPaid) return "";
    try {
      return generatePixPayload(
        ownerProfile.pix_key,
        totalDue,
        "SAO PAULO",
        ownerProfile.full_name || "CREDOR",
        `PARCELA ${installment.installment_number}`
      );
    } catch (e) {
      console.error("Erro ao gerar PIX", e);
      return "";
    }
  }, [ownerProfile, installment, isPaid, totalDue]);

  if (!installment) return null;


  const handleCopyPix = () => {
    const textToCopy = pixPayload || ownerProfile?.pix_key;
    if (!textToCopy) return;
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast({ 
      title: pixPayload ? "PIX Copia e Cola!" : "Chave PIX copiada!", 
      description: "Agora basta colar no seu banco para pagar." 
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNotifyPaid = () => {
    const phone = (contactPhone || "").replace(/\D/g, "");
    if (!phone) {
      toast({ title: "Sem WhatsApp do credor", description: "Entre em contato pelos canais informados.", variant: "destructive" });
      return;
    }
    const valor = Number(installment.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const venc = formatBR(installment.due_date);
    const nome = clientData?.name || "Cliente";
    const msg = `Olá! Sou *${nome}* e acabei de efetuar o pagamento da parcela #${installment.installment_number} no valor de *${valor}* (venc. ${venc}). Segue o comprovante a seguir 👇`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleDownloadReceipt = async () => {
    setIsDownloading(true);
    try {
      const client = {
        name: clientData?.name || "Cliente",
        cpf_cnpj: clientData?.cpf_cnpj || "000.000.000-00"
      };
      generatePortalReceiptPdf(client, installment, ownerProfile);
      toast({ title: "Recibo gerado!", description: "O download do PDF foi iniciado." });
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível gerar o recibo agora.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };


  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div className={`p-6 text-white ${isPaid ? "bg-success" : isOverdue ? "bg-destructive" : "bg-primary"}`}>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-white border-white/30 bg-white/10 uppercase tracking-widest text-[9px]">
              Parcela #{installment.installment_number}
            </Badge>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              {isPaid ? <Receipt size={20} /> : <CreditCard size={20} />}
            </div>
          </div>
          <h2 className="text-2xl font-bold mt-2">R$ {fmt(totalDue)}</h2>
          {!isPaid && liveFee > 0 && (
            <p className="text-white/90 text-xs">
              Parcela R$ {fmt(Number(installment.amount))} + multa/juros R$ {fmt(liveFee)}
            </p>
          )}
          <p className="text-white/80 text-sm">
            {isPaid
              ? `Pago em ${formatBR(installment.paid_at)}`
              : `Vencimento em ${formatBR(installment.due_date)}`}
          </p>
        </div>

        <div className="p-6 space-y-6 bg-card">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Status</p>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isPaid ? "bg-success" : isOverdue ? "bg-destructive" : "bg-amber-500"}`} />
                <span className="text-sm font-medium">{isPaid ? "Liquidado" : isOverdue ? "Em atraso" : "Aguardando"}</span>
              </div>
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Data</p>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Calendar size={14} className="text-muted-foreground shrink-0" />
                <span className="truncate">{formatBR(installment.due_date)}</span>
              </div>
            </div>
          </div>

          {!isPaid ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-accent/30 border border-border space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <QrCode size={16} className="text-primary shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wide truncate">Pague com PIX</span>
                  </div>
                  <Badge variant="secondary" className="text-[9px] font-bold shrink-0">COPIA E COLA</Badge>
                </div>

                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="bg-white p-3 rounded-2xl border border-border shadow-sm">
                    {pixPayload ? (
                      <QRCodeSVG value={pixPayload} size={160} level="M" includeMargin={false} />
                    ) : (
                      <div className="w-32 h-32 bg-slate-100 flex items-center justify-center">
                        <QrCode size={80} className="text-slate-300" />
                      </div>
                    )}
                  </div>

                  <div className="w-full space-y-2 min-w-0">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase text-center">
                      {pixPayload ? "Código PIX Copia e Cola" : "Chave do Credor"}
                    </p>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-border p-2 rounded-xl min-w-0">
                      <code className="flex-1 min-w-0 text-[10px] font-mono font-medium truncate px-1 text-muted-foreground">
                        {pixPayload || ownerProfile?.pix_key || "carregando..."}
                      </code>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg shrink-0" onClick={handleCopyPix}>
                        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCopyPix}
                disabled={!pixPayload && !ownerProfile?.pix_key}
                className="w-full rounded-xl py-6 text-base font-bold shadow-lg gap-2"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? "Código copiado!" : "Copiar código PIX"}
              </Button>

              {contactPhone && (
                <Button
                  onClick={handleNotifyPaid}
                  variant="outline"
                  className="w-full rounded-xl py-6 text-base font-semibold gap-2 border-success/40 text-success hover:bg-success/10 hover:text-success"
                >
                  <MessageCircle size={18} />
                  Já paguei — avisar credor no WhatsApp
                </Button>
              )}

              <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <Info size={14} className="text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-primary/80 leading-snug">
                  Após o pagamento, envie o comprovante ao credor para a baixa ser confirmada mais rápido.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-10 flex flex-col items-center justify-center text-center space-y-4 bg-success/5 rounded-3xl border border-success/10 border-dashed">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center text-success">
                  <Check size={32} />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">Pagamento Confirmado</h4>
                  <p className="text-xs text-muted-foreground">Esta parcela já foi quitada em nosso sistema.</p>
                </div>
              </div>

              <Button onClick={handleDownloadReceipt} disabled={isDownloading} className="w-full rounded-xl py-6 text-base font-bold gap-2">
                {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                Baixar recibo em PDF
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};