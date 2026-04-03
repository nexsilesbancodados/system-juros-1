import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, FileSignature, Users, LayoutDashboard, ArrowRight, CornerDownLeft } from "lucide-react";

interface SearchResult {
  type: "client" | "contract" | "page";
  title: string;
  subtitle?: string;
  path: string;
}

const pages: SearchResult[] = [
  { type: "page", title: "Painel", path: "/dashboard" },
  { type: "page", title: "Clientes", path: "/clientes" },
  { type: "page", title: "Clientes", path: "/clientes" },
  { type: "page", title: "Cobranças", path: "/cobrancas" },
  { type: "page", title: "Carteira", path: "/carteira" },
  { type: "page", title: "Análises", path: "/analises" },
  { type: "page", title: "Relatórios", path: "/relatorios" },
  { type: "page", title: "Cobradores", path: "/cobradores" },
  { type: "page", title: "Lucros", path: "/lucros" },
  { type: "page", title: "Gastos", path: "/gastos" },
  { type: "page", title: "Agente IA", path: "/agente-ia" },
  { type: "page", title: "Configurações", path: "/configuracoes" },
  { type: "page", title: "Histórico", path: "/historico" },
  { type: "page", title: "QR Code", path: "/qrcode" },
  { type: "page", title: "Simulador", path: "/ferramentas/simulador" },
  { type: "page", title: "Metas", path: "/ferramentas/metas" },
  { type: "page", title: "Tarefas", path: "/ferramentas/tarefas" },
  { type: "page", title: "Anotações", path: "/ferramentas/anotacoes" },
  { type: "page", title: "Planilha", path: "/ferramentas/planilha" },
  { type: "page", title: "Puxada de Dados", path: "/puxada-dados" },
];

const GlobalSearch = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  // Improvement #16: Keyboard navigation in search
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); setSelectedIndex(0); }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(pages.slice(0, 8));
      setSelectedIndex(0);
      return;
    }

    const q = query.toLowerCase();
    const pageResults = pages.filter((p) => p.title.toLowerCase().includes(q));

    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      const [clientsRes, contractsRes] = await Promise.all([
        supabase.from("clients").select("id, name, cpf_cnpj").eq("user_id", user.id).or(`name.ilike.%${query}%,cpf_cnpj.ilike.%${query}%`).limit(5),
        supabase.from("contracts").select("id, capital, clients(name)").eq("user_id", user.id).limit(5),
      ]);

      const clientResults: SearchResult[] = (clientsRes.data || []).map((c: any) => ({
        type: "client", title: c.name, subtitle: c.cpf_cnpj, path: `/clientes/${c.id}`,
      }));

      const contractResults: SearchResult[] = (contractsRes.data || [])
        .filter((c: any) => c.clients?.name?.toLowerCase().includes(q))
        .map((c: any) => ({
          type: "contract", title: `Contrato - ${c.clients?.name}`, subtitle: `R$ ${Number(c.capital).toLocaleString("pt-BR")}`, path: `/contratos/${c.id}`,
        }));

      const combined = [...pageResults, ...clientResults, ...contractResults];
      setResults(combined);
      setSelectedIndex(0);
      setLoading(false);
    };

    const timer = setTimeout(fetchData, 250);
    return () => clearTimeout(timer);
  }, [query, user]);

  // Improvement #17: Keyboard up/down/enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      navigate(results[selectedIndex].path);
      onClose();
    }
  }, [results, selectedIndex, navigate, onClose]);

  // Improvement #18: Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    onClose();
  };

  if (!open) return null;

  const icons: Record<string, any> = {
    page: <LayoutDashboard size={14} />,
    client: <Users size={14} />,
    contract: <FileSignature size={14} />,
  };

  const typeLabels: Record<string, string> = {
    page: "Página",
    client: "Cliente",
    contract: "Contrato",
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-fade-in" onClick={onClose} />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[61] px-4 animate-scale-in">
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Improvement #19: Enhanced search input with clear button */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <Search size={16} className={`transition-colors ${loading ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar clientes, contratos, páginas..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="p-1 rounded-md hover:bg-accent text-muted-foreground transition-colors">
                <X size={14} />
              </button>
            )}
            <kbd className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">ESC</kbd>
          </div>

          <div ref={listRef} className="max-h-80 overflow-y-auto">
            {results.length === 0 && query && !loading && (
              <div className="py-12 text-center">
                <Search size={32} className="mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum resultado para "{query}"</p>
              </div>
            )}
            {results.map((r, i) => (
              <button
                key={`${r.path}-${i}`}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                  i === selectedIndex ? "bg-accent/60" : "hover:bg-accent/30"
                }`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  r.type === "client" ? "bg-primary/8 text-primary" :
                  r.type === "contract" ? "bg-success/8 text-success" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {icons[r.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground">{typeLabels[r.type]}</span>
                  {i === selectedIndex && <CornerDownLeft size={12} className="text-muted-foreground/50" />}
                </div>
              </button>
            ))}
          </div>

          {/* Improvement #20: Search footer with keyboard hints */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border text-[10px] text-muted-foreground/60">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted font-mono">↑↓</kbd> navegar</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted font-mono">↵</kbd> abrir</span>
            </div>
            <span>{results.length} resultado{results.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default GlobalSearch;
