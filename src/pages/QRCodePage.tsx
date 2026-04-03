import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { QrCode, Copy, Check } from "lucide-react";

const QRCodePage = () => {
  const { user } = useAuth();
  const [inputUrl, setInputUrl] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin;

  const presets = [
    { label: "Portal do Cliente", url: `${baseUrl}/portal-cliente` },
    { label: "Cobrador Externo", url: `${baseUrl}/cobrador-externo` },
  ];

  const generateQR = (url: string) => {
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`);
    setInputUrl(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inputUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputCls = "w-full px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">QR Code</h1>
        <p className="text-sm text-muted-foreground">Gere QR Codes para compartilhar links</p>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase">Links Rápidos</p>
        <div className="grid grid-cols-2 gap-3">
          {presets.map((p) => (
            <button key={p.label} onClick={() => generateQR(p.url)} className="rounded-2xl border border-border bg-card p-4 text-left hover:bg-accent/50 transition-colors">
              <p className="text-sm font-medium text-foreground">{p.label}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{p.url}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom URL */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase">URL Personalizada</p>
        <div className="flex gap-2">
          <input value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} placeholder="https://..." className={inputCls} />
          <button onClick={() => generateQR(inputUrl)} disabled={!inputUrl} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground shrink-0 disabled:opacity-50" style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
            Gerar
          </button>
        </div>
      </div>

      {/* QR Result */}
      {qrUrl && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4">
          <img src={qrUrl} alt="QR Code" className="mx-auto rounded-lg" width={250} height={250} />
          <div className="flex items-center gap-2 justify-center">
            <p className="text-xs text-muted-foreground truncate max-w-[250px]">{inputUrl}</p>
            <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>
          <a href={qrUrl} download="qrcode.png" className="inline-block px-4 py-2 rounded-lg text-sm font-medium bg-accent text-foreground hover:bg-accent/70">
            Baixar QR Code
          </a>
        </div>
      )}
    </div>
  );
};

export default QRCodePage;
