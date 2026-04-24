import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const SHORTCUTS: { keys: string[]; label: string; path?: string; action?: () => void }[] = [
  { keys: ["g", "d"], label: "Ir para Painel", path: "/dashboard" },
  { keys: ["g", "c"], label: "Ir para Clientes", path: "/clientes" },
  { keys: ["g", "b"], label: "Ir para Cobranças", path: "/cobrancas" },
  { keys: ["g", "i"], label: "Ir para Inadimplência", path: "/inadimplencia" },
  { keys: ["g", "w"], label: "Ir para Carteira", path: "/carteira" },
  { keys: ["g", "l"], label: "Ir para Lucros", path: "/lucros" },
  { keys: ["g", "g"], label: "Ir para Gastos", path: "/gastos" },
  { keys: ["g", "a"], label: "Ir para Análises", path: "/analises" },
  { keys: ["g", "m"], label: "Ir para Chat", path: "/chat" },
  { keys: ["n", "c"], label: "Novo cliente", path: "/clientes/novo" },
  { keys: ["⌘/Ctrl", "K"], label: "Abrir busca global" },
  { keys: ["?"], label: "Mostrar atalhos" },
];

export const KeyboardShortcutsHelp = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let buf: string[] = [];
    let timer: number | null = null;

    const flush = () => { buf = []; timer = null; };

    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") { e.preventDefault(); setOpen(o => !o); return; }
      if (e.key === "Escape") { setOpen(false); return; }

      buf.push(e.key.toLowerCase());
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(flush, 800);

      const seq = buf.join("");
      const match = SHORTCUTS.find(s => s.path && s.keys.join("").toLowerCase() === seq);
      if (match?.path) {
        e.preventDefault();
        navigate(match.path);
        flush();
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (timer) window.clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard size={18} /> Atalhos de teclado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/40 text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <div className="flex gap-1">
                {s.keys.map((k, j) => (
                  <kbd key={j} className="px-2 py-0.5 text-[11px] font-mono bg-muted border border-border rounded">{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          Pressione <kbd className="px-1.5 py-0.5 bg-muted rounded">?</kbd> para abrir essa janela
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsHelp;
