import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, FileSignature, Users, LayoutDashboard } from "lucide-react";

interface SearchResult {
  type: "client" | "contract" | "page";
  title: string;
  subtitle?: string;
  path: string;
}

const pages: SearchResult[] = [
  { type: "page", title: "Painel", path: "/dashboard" },
  { type: "page", title: "Contratos", path: "/contratos" },
  { type: "page", title: "Clientes", path: "/clientes" },
  { type: "page", title: "Mesa de Cobrança", path: "/mesa-cobranca" },
  { type: "page", title: "Tesouraria", path: "/tesouraria" },
  { type: "page", title: "Análises", path: "/analises" },
  { type: "page", title: "Cobradores", path: "/cobradores" },
  { type: "page", title: "Agente IA", path: "/agente-ia" },
  { type: "page", title: "Configurações", path: "/configuracoes" },
  { type: "page", title: "Histórico", path: "/historico" },
  { type: "page", title: "QR Code", path: "/qrcode" },
  { type: "page", title: "Simulador", path: "/ferramentas/simulador" },
  { type: "page", title: "Metas", path: "/ferramentas/metas" },
  { type: "page", title: "Tarefas", path: "/ferramentas/tarefas" },
];

const GlobalSearch = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(pages.slice(0, 6));
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
        type: "client", title: c.name, subtitle: c.cpf_cnpj, path: `/clientes`,
      }));

      const contractResults: SearchResult[] = (contractsRes.data || [])
        .filter((c: any) => c.clients?.name?.toLowerCase().includes(q))
        .map((c: any) => ({
          type: "contract", title: `Contrato - ${c.clients?.name}`, subtitle: `R$ ${Number(c.capital).toLocaleString("pt-BR")}`, path: `/contratos/${c.id}`,
        }));

      setResults([...pageResults, ...clientResults, ...contractResults]);
      setLoading(false);
    };

    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [query, user]);

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

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[61]">
        <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search size={16} className="text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar clientes, contratos, páginas..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">ESC</kbd>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 && query && !loading && (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhum resultado</div>
            )}
            {results.map((r, i) => (
              <button
                key={`${r.path}-${i}`}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
              >
                <span className="text-muted-foreground">{icons[r.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-muted-foreground">{r.subtitle}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground capitalize">{r.type === "page" ? "Página" : r.type === "client" ? "Cliente" : "Contrato"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default GlobalSearch;
