import { useState, useMemo } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, Copy, Check, QrCode, Receipt, Calendar, 
  DollarSign, Download, Share2, Info, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generatePortalReceiptPdf } from "@/utils/portalPdf";
import { QRCodeSVG } from "qrcode.react";
import { generatePixPayload } from "@/utils/pixGenerator";

interface PaymentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  installment: any;
  ownerProfile: any;
  clientData: any;
}

export const PaymentModal = ({ isOpen, onOpenChange, installment, ownerProfile, clientData }: PaymentModalProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!installment) return null;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const isOverdue = installment.status === "overdue";
  const isPaid = installment.status === "paid";

  const pixPayload = useMemo(() => {
    if (!ownerProfile?.pix_key || isPaid) return "";
    try {
      return generatePixPayload(
        ownerProfile.pix_key,
        Number(installment.amount),
        "SAO PAULO",
        ownerProfile.full_name || "CREDOR",
        `PARCELA ${installment.installment_number}`
      );
    } catch (e) {
      console.error("Erro ao gerar PIX", e);
      return "";
    }
  }, [ownerProfile, installment, isPaid]);

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

  const handleDownloadReceipt = async () => {
    setIsDownloading(true);
    try {
      // Tenta gerar localmente primeiro para ser instantâneo
      const { data: { user } } = await supabase.auth.getUser(); // Apenas para contexto se houver
      
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <div className={`p-6 text-white ${isPaid ? "bg-success" : isOverdue ? "bg-destructive" : "bg-primary"}`}>
          <DialogHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-white border-white/30 bg-white/10 uppercase tracking-widest text-[9px]">
                Parcela #{installment.installment_number}
              </Badge>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                {isPaid ? <Receipt size={20} /> : <CreditCard size={20} />}
              </div>
            </div>
            <DialogTitle className="text-2xl font-bold mt-2">
              R$ {fmt(Number(isPaid ? (installment.paid_amount || installment.amount) : installment.amount))}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-sm">
              {isPaid 
                ? `Pago em ${new Date(installment.paid_at).toLocaleDateString("pt-BR")}`
                : `Vencimento em ${new Date(installment.due_date).toLocaleDateString("pt-BR")}`}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6 bg-card">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Status</p>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isPaid ? "bg-success" : isOverdue ? "bg-destructive" : "bg-amber-500"}`} />
                <span className="text-sm font-medium">{isPaid ? "Liquidado" : isOverdue ? "Em atraso" : "Aguardando"}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Data</p>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Calendar size={14} className="text-muted-foreground" />
                {new Date(installment.due_date).toLocaleDateString("pt-BR")}
              </div>
            </div>
          </div>

          {!isPaid ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-accent/30 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode size={16} className="text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wide">Pague com PIX</span>
                  </div>
                  <Badge variant="secondary" className="text-[9px] font-bold">COPIA E COLA</Badge>
                </div>
                
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="bg-white p-3 rounded-2xl border border-border shadow-sm">
                    {pixPayload ? (
                      <QRCodeSVG 
                        value={pixPayload} 
                        size={160}
                        level="M"
                        includeMargin={false}
                      />
                    ) : (
                      <div className="w-32 h-32 bg-slate-100 flex items-center justify-center relative overflow-hidden group">
                        <QrCode size={80} className="text-slate-300" />
                        <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                          <span className="text-[10px] font-bold text-slate-800">QR Code indisponível</span>
                          <span className="text-[8px] text-slate-500">Use a chave abaixo</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="w-full space-y-2">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase text-center">
                      {pixPayload ? "Código PIX Copia e Cola" : "Chave do Credor"}
                    </p>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-border p-2 rounded-xl group hover:border-primary/50 transition-colors">
                      <code className="flex-1 text-[10px] font-mono font-medium truncate px-1 text-muted-foreground">
                        {pixPayload || ownerProfile?.pix_key || "carregando..."}
                      </code>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg shrink-0" onClick={handleCopyPix}>
                        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <Info size={14} className="text-primary shrink-0" />
                <p className="text-[10px] text-primary/80 leading-snug">
                  Após realizar o pagamento, o sistema pode levar até 24h para processar a baixa automática se usar chave manual.
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
              
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="rounded-xl gap-2 h-11" onClick={handleDownloadReceipt} disabled={isDownloading}>
                  {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Recibo
                </Button>
                <Button variant="outline" className="rounded-xl gap-2 h-11">
                  <Share2 size={16} />
                  Compartilhar
                </Button>
              </div>
            </div>
          )}
        </div>

        {!isPaid && (
          <DialogFooter className="p-4 bg-accent/20 border-t border-border sm:justify-center">
            <Button className="w-full rounded-xl py-6 font-bold shadow-lg" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};