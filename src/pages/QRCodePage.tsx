import { useState } from "react";
import { QrCode, Copy, Check, Download, Link2, ExternalLink } from "lucide-react";

const QRCodePage = () => {
  const [inputUrl, setInputUrl] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [activeUrl, setActiveUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin;

  const presets = [
    { label: "Portal do Cliente", desc: "Acesso do cliente às parcelas", icon: ExternalLink, url: `${baseUrl}/portal-cliente` },
    { label: "Cobrador Externo", desc: "Painel do cobrador externo", icon: Link2, url: `${baseUrl}/cobrador-externo` },
  ];

  const generateQR = (url: string) => {
    if (!url) return;
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&bgcolor=1a1a1a&color=ffffff`);
    setActiveUrl(url);
    setInputUrl(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
          <QrCode size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">QR Code</h1>
          <p className="text-xs text-muted-foreground">Gere e compartilhe QR Codes facilmente</p>
        </div>
      </div>

      {/* Presets */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Links Rápidos</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {presets.map((p) => {
            const Icon = p.icon;
            const isActive = activeUrl === p.url;
            return (
              <button
                key={p.label}
                onClick={() => generateQR(p.url)}
                className={`group rounded-2xl border p-4 text-left transition-colors duration-200 ${
                  isActive
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-card hover:border-primary/20 hover:bg-card/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive ? "bg-primary/20" : "bg-muted/50"
                  }`}>
                    <Icon size={16} className={isActive ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{p.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom URL */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">URL Personalizada</p>
        <div className="flex gap-2">
          <input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generateQR(inputUrl)}
            placeholder="https://exemplo.com"
            className="flex-1 px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-colors"
          />
          <button
            onClick={() => generateQR(inputUrl)}
            disabled={!inputUrl}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground shrink-0 disabled:opacity-40 transition-opacity"
            style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}
          >
            Gerar
          </button>
        </div>
      </div>

      {/* QR Result */}
      {qrUrl && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* QR Image */}
          <div className="flex justify-center p-8 bg-muted/20">
            <div className="rounded-2xl overflow-hidden border-2 border-border/50 shadow-lg">
              <img src={qrUrl} alt="QR Code" width={220} height={220} className="block" />
            </div>
          </div>

          {/* Info footer */}
          <div className="p-4 border-t border-border/50 space-y-3">
            {/* URL display with copy */}
            <div className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2">
              <Link2 size={14} className="text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground truncate flex-1">{activeUrl}</p>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors shrink-0"
                title="Copiar URL"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Download */}
            <a
              href={qrUrl}
              download="qrcode.png"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}
            >
              <Download size={16} />
              Baixar QR Code
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCodePage;
