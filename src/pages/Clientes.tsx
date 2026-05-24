import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Users, Trash2, Eye, X, ChevronRight, LayoutGrid, List,
  Phone, Mail, Upload, FileSpreadsheet, CheckCircle, AlertCircle,
  ArrowUpDown, SlidersHorizontal, Download, FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import { useConfirm } from "@/components/ConfirmProvider";

type SortKey = "recent" | "name" | "score_desc" | "score_asc" | "overdue";
type ScoreBand = "all" | "high" | "mid" | "low";

const scoreColor = (s: number) =>
  s >= 700 ? "text-success bg-success/10 ring-success/20"
  : s >= 400 ? "text-warning bg-warning/10 ring-warning/20"
  : "text-destructive bg-destructive/10 ring-destructive/20";

const scoreLabel = (s: number) => s >= 700 ? "Bom" : s >= 400 ? "Médio" : "Risco";

// debounce hook (small, local)
const useDebounced = <T,>(value: T, ms = 200) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const PAGE_SIZE = 30;

const Clientes = () => {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search, 180);
  const [statusFilter, setStatusFilter] = useState<"all" | "Ativo" | "Inativo">("all");
  const [scoreBand, setScoreBand] = useState<ScoreBand>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const [viewMode, setViewMode] = useState<"list" | "cards">(() => {
    return (localStorage.getItem("clients-view") as "list" | "cards") || "list";
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleView = (mode: "list" | "cards") => {
    setViewMode(mode);
    localStorage.setItem("clients-view", mode);
  };

  // Keyboard shortcuts: "/" focus search, "Esc" clears search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useMultiTableRealtime(
    ["clients", "contracts", "contract_installments"],
    [["clients", user?.id || ""]],
  );

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Aggregate contracts + overdue counts per client (lightweight, single query)
  const { data: contractMap = {} } = useQuery({
    queryKey: ["clients-contract-summary", user?.id],
    queryFn: async () => {
      const [{ data: ctr }, { data: ins }] = await Promise.all([
        supabase.from("contracts").select("client_id, status").eq("user_id", user!.id),
        supabase.from("contract_installments").select("client_id, status, due_date").eq("user_id", user!.id).eq("status", "pending"),
      ]);
      const map: Record<string, { contracts: number; active: number; overdue: number }> = {};
      const now = Date.now();
      (ctr || []).forEach((c: any) => {
        const k = c.client_id; if (!k) return;
        if (!map[k]) map[k] = { contracts: 0, active: 0, overdue: 0 };
        map[k].contracts++;
        if (c.status === "active") map[k].active++;
      });
      (ins || []).forEach((i: any) => {
        const k = i.client_id; if (!k) return;
        if (new Date(i.due_date).getTime() < now) {
          if (!map[k]) map[k] = { contracts: 0, active: 0, overdue: 0 };
          map[k].overdue++;
        }
      });
      return map;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [dSearch, statusFilter, scoreBand, sort]);

  const { filtered, stats } = useMemo(() => {
    const q = dSearch.trim().toLowerCase();
    const cleanQ = q.replace(/\D/g, "");
    let arr = clients.filter((c: any) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      const sc = Number(c.credit_score || 0);
      if (scoreBand === "high" && sc < 700) return false;
      if (scoreBand === "mid" && (sc < 400 || sc >= 700)) return false;
      if (scoreBand === "low" && sc >= 400) return false;
      if (!q) return true;
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || c.whatsapp || "").replace(/\D/g, "");
      const doc = (c.cpf_cnpj || "").replace(/\D/g, "");
      return name.includes(q)
        || email.includes(q)
        || (cleanQ && (doc.includes(cleanQ) || phone.includes(cleanQ)));
    });

    if (sort === "name") arr = [...arr].sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"));
    else if (sort === "score_desc") arr = [...arr].sort((a, b) => (b.credit_score || 0) - (a.credit_score || 0));
    else if (sort === "score_asc") arr = [...arr].sort((a, b) => (a.credit_score || 0) - (b.credit_score || 0));
    else if (sort === "overdue") arr = [...arr].sort((a, b) => (contractMap[b.id]?.overdue || 0) - (contractMap[a.id]?.overdue || 0));

    return {
      filtered: arr,
      stats: {
        total: clients.length,
        active: clients.filter((c: any) => c.status === "Ativo").length,
        inactive: clients.filter((c: any) => c.status === "Inativo").length,
      },
    };
  }, [clients, dSearch, statusFilter, scoreBand, sort, contractMap]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;
  const activeFilters = (statusFilter !== "all" ? 1 : 0) + (scoreBand !== "all" ? 1 : 0) + (sort !== "recent" ? 1 : 0);

  const clearFilters = () => { setStatusFilter("all"); setScoreBand("all"); setSort("recent"); };

  // ─── Selection ─────────────────────────────────────────────
  const allVisibleSelected = visible.length > 0 && visible.every((c: any) => selected.has(c.id));
  const toggleOne = (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
    e?.stopPropagation?.();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllVisible = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((c: any) => next.delete(c.id));
      else visible.forEach((c: any) => next.add(c.id));
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(await confirm("Excluir este cliente e todos os seus dados?"))) return;
    await supabase.from("contract_installments").delete().eq("client_id", id);
    await supabase.from("contracts").delete().eq("client_id", id);
    await supabase.from("installments").delete().eq("client_id", id);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cliente excluído!" });
    qc.invalidateQueries({ queryKey: ["clients", user?.id] });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!(await confirm(`Excluir ${ids.length} cliente(s) e todos os dados associados?`))) return;
    await supabase.from("contract_installments").delete().in("client_id", ids);
    await supabase.from("contracts").delete().in("client_id", ids);
    await supabase.from("installments").delete().in("client_id", ids);
    const { error } = await supabase.from("clients").delete().in("id", ids);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${ids.length} cliente(s) excluído(s)!` });
    clearSelection();
    qc.invalidateQueries({ queryKey: ["clients", user?.id] });
  };

  const handleBulkExport = useCallback(() => {
    const rows = (selected.size > 0 ? clients.filter((c: any) => selected.has(c.id)) : filtered) as any[];
    if (rows.length === 0) { toast({ title: "Nada para exportar" }); return; }
    const headers = ["nome", "cpf_cnpj", "telefone", "whatsapp", "email", "status", "credit_score", "criado_em"];
    const csv = [
      headers.join(","),
      ...rows.map(r => [
        `"${(r.name || "").replace(/"/g, '""')}"`,
        r.cpf_cnpj || "",
        r.phone || "",
        r.whatsapp || "",
        r.email || "",
        r.status || "",
        r.credit_score ?? "",
        r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : "",
      ].join(",")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clientes-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${rows.length} cliente(s) exportado(s)` });
  }, [selected, clients, filtered, toast]);

  // ─── CSV Import ─────────────────────────────────────────────
  const parseCSV = (text: string): any[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
    const map: Record<string, string> = {
      nome: "name", name: "name",
      cpf: "cpf_cnpj", cnpj: "cpf_cnpj", cpf_cnpj: "cpf_cnpj", documento: "cpf_cnpj",
      telefone: "phone", phone: "phone", celular: "phone", tel: "phone",
      whatsapp: "whatsapp", wpp: "whatsapp", "whats app": "whatsapp",
      email: "email", "e-mail": "email",
      status: "status",
      "data nascimento": "birth_date", nascimento: "birth_date", birth_date: "birth_date", aniversario: "birth_date",
    };
    return lines.slice(1).map((line, idx) => {
      const cols = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));
      const row: any = { _row: idx + 2, _errors: [] as string[] };
      headers.forEach((h, i) => {
        const key = map[h];
        if (key) row[key] = cols[i] || "";
      });
      if (!row.name) row._errors.push("nome obrigatório");
      if (row.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.birth_date)) {
        const m = row.birth_date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) row.birth_date = `${m[3]}-${m[2]}-${m[1]}`;
        else { row._errors.push("data inválida"); row.birth_date = null; }
      }
      return row;
    });
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCSV(String(reader.result || ""));
      if (parsed.length === 0) {
        toast({ title: "CSV vazio ou inválido", variant: "destructive" });
        return;
      }
      setImportPreview(parsed);
    };
    reader.readAsText(file, "utf-8");
  };

  const confirmImport = async () => {
    if (!importPreview || !user) return;
    const valid = importPreview.filter(r => r._errors.length === 0);
    if (valid.length === 0) {
      toast({ title: "Nenhuma linha válida", variant: "destructive" });
      return;
    }
    setImporting(true);
    const rows = valid.map(r => ({
      user_id: user.id,
      name: r.name,
      cpf_cnpj: r.cpf_cnpj || null,
      phone: r.phone || null,
      whatsapp: r.whatsapp || r.phone || null,
      email: r.email || null,
      birth_date: r.birth_date || null,
      status: r.status === "Inativo" ? "Inativo" : "Ativo",
      client_type: "loan",
    }));
    const { error } = await supabase.from("clients").insert(rows);
    setImporting(false);
    if (error) {
      toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `✓ ${rows.length} cliente(s) importado(s)!` });
    setImportOpen(false); setImportPreview(null);
    qc.invalidateQueries({ queryKey: ["clients", user?.id] });
  };

  const downloadTemplate = () => {
    const csv = "nome,cpf,telefone,whatsapp,email,data_nascimento,status\nJoão da Silva,123.456.789-00,(11) 91234-5678,(11) 91234-5678,joao@email.com,1990-05-15,Ativo\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "modelo-clientes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto pb-24">
      {/* Hero */}
      <div className="page-hero animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.2)]">
              <Users size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-display text-4xl md:text-5xl text-foreground tracking-tight">Clientes</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Gerencie seus clientes e contratos.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkExport} className="btn-ghost" title="Exportar lista atual / selecionados">
              <Download size={15} /> Exportar
            </button>
            <button onClick={() => setImportOpen(true)} className="btn-ghost">
              <Upload size={15} /> Importar CSV
            </button>
            <button onClick={() => navigate("/clientes/novo")} className="btn-premium">
              <Plus size={16} /> Novo Cliente
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground", filter: "all" as const },
          { label: "Ativos", value: stats.active, color: "text-success", filter: "Ativo" as const },
          { label: "Inativos", value: stats.inactive, color: "text-muted-foreground", filter: "Inativo" as const },
        ].map(s => (
          <button key={s.label} onClick={() => setStatusFilter(s.filter)}
            className={`rounded-3xl border p-6 text-left transition-all duration-300 ${statusFilter === s.filter ? "border-primary/40 bg-card/60 shadow-xl shadow-primary/5 scale-[1.02] z-10" : "border-border/10 bg-card/20 hover:bg-card/40"}`}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Search bar + view toggle */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar por nome, CPF, telefone ou email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-28 py-3.5 rounded-2xl bg-card/30 backdrop-blur-md border border-border/10 text-foreground placeholder:text-muted-foreground/40 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {search ? (
                <>
                  <span className="text-[10px] text-muted-foreground">{filtered.length}</span>
                  <button onClick={() => setSearch("")} className="p-1 rounded-md hover:bg-accent text-muted-foreground"><X size={14} /></button>
                </>
              ) : (
                <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded-md border border-border/40 bg-muted/40 text-[10px] font-mono text-muted-foreground">/</kbd>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowFilters(v => !v)}
            className={`relative shrink-0 px-3.5 py-3.5 rounded-2xl border transition-all ${activeFilters > 0 ? "border-primary/40 bg-primary/5 text-primary" : "border-border/10 bg-card/30 text-muted-foreground hover:text-foreground"}`}
            title="Filtros e ordenação"
          >
            <SlidersHorizontal size={16} />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold rounded-full bg-primary text-primary-foreground flex items-center justify-center">{activeFilters}</span>
            )}
          </button>

          <div className="flex items-center bg-card/30 backdrop-blur-md border border-border/10 rounded-2xl p-1 shrink-0">
            <button onClick={() => toggleView("list")}
              className={`p-2.5 rounded-xl transition-colors ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Lista">
              <List size={16} />
            </button>
            <button onClick={() => toggleView("cards")}
              className={`p-2.5 rounded-xl transition-colors ${viewMode === "cards" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Cards">
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="rounded-2xl border border-border/10 bg-card/30 backdrop-blur-md p-4 space-y-3 animate-fade-in">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">Score</span>
                {([
                  { v: "all", label: "Todos" },
                  { v: "high", label: "Bom (700+)" },
                  { v: "mid", label: "Médio" },
                  { v: "low", label: "Risco" },
                ] as const).map(b => (
                  <button key={b.v} onClick={() => setScoreBand(b.v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${scoreBand === b.v ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
                    {b.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <ArrowUpDown size={13} className="text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">Ordenar</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-muted/30 text-foreground border border-border/10 focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="recent">Mais recentes</option>
                  <option value="name">Nome (A → Z)</option>
                  <option value="score_desc">Maior score</option>
                  <option value="score_asc">Menor score</option>
                  <option value="overdue">Mais em atraso</option>
                </select>

                {activeFilters > 0 && (
                  <button onClick={clearFilters} className="ml-2 text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-4 z-30 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/30 backdrop-blur-md shadow-lg shadow-primary/10 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-primary">{selected.size} selecionado(s)</span>
            <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground">Limpar</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkExport} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-card/60 hover:bg-card text-foreground border border-border/40 flex items-center gap-1.5">
              <Download size={13} /> Exportar
            </button>
            <button onClick={handleBulkDelete} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-destructive/15 hover:bg-destructive/25 text-destructive border border-destructive/30 flex items-center gap-1.5">
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className={viewMode === "cards" ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" : "space-y-2"}>
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={`rounded-2xl bg-muted/20 animate-pulse ${viewMode === "cards" ? "h-44" : "h-16"}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-dashed border-border/30 bg-card/10">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <Users size={28} className="text-muted-foreground/50" />
          </div>
          <p className="text-foreground font-semibold">
            {search ? `Nenhum resultado para "${search}"` : activeFilters > 0 ? "Nenhum cliente com esses filtros" : "Nenhum cliente cadastrado"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || activeFilters > 0 ? "Tente ajustar a busca ou os filtros." : "Comece cadastrando seu primeiro cliente."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            {(search || activeFilters > 0) && (
              <button onClick={() => { setSearch(""); clearFilters(); }} className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted/40 hover:bg-muted text-foreground">
                Limpar tudo
              </button>
            )}
            <button onClick={() => navigate("/clientes/novo")} className="btn-premium text-xs">
              <Plus size={14} /> Novo cliente
            </button>
          </div>
        </div>
      ) : viewMode === "list" ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-3xl border border-border/10 overflow-hidden bg-card/30 backdrop-blur-xl shadow-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible}
                      className="w-4 h-4 rounded border-border/40 bg-card text-primary focus:ring-primary/40 cursor-pointer" />
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contato</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contratos</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c: any) => {
                  const summary = contractMap[c.id] || { contracts: 0, active: 0, overdue: 0 };
                  const isSel = selected.has(c.id);
                  return (
                    <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
                      className={`border-t border-border/60 hover:bg-accent/30 cursor-pointer transition-colors ${isSel ? "bg-primary/5" : ""}`}>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(c.id)}
                          className="w-4 h-4 rounded border-border/40 bg-card text-primary focus:ring-primary/40 cursor-pointer" />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                            {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-9 h-9 rounded-2xl object-cover" /> : c.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{c.name}</p>
                            {c.cpf_cnpj && <p className="text-[11px] text-muted-foreground font-mono">{c.cpf_cnpj}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <div className="space-y-0.5">
                          {(c.phone || c.whatsapp) && <p className="text-xs">{c.phone || c.whatsapp}</p>}
                          {c.email && <p className="text-[11px] truncate max-w-[200px]">{c.email}</p>}
                          {!c.phone && !c.whatsapp && !c.email && <span className="text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {summary.contracts === 0 ? (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 text-[11px] font-semibold text-foreground">
                              <FileText size={10} /> {summary.contracts}
                            </span>
                            {summary.overdue > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive text-[10px] font-bold ring-1 ring-destructive/20" title="Parcelas em atraso">
                                {summary.overdue} atras.
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ring-1 ${scoreColor(c.credit_score || 0)}`}>{c.credit_score || 0}</span>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className={c.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>{c.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${c.id}`); }} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Ver">
                            <Eye size={15} />
                          </button>
                          <button onClick={(e) => handleDelete(c.id, e)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Excluir">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden space-y-2">
            {visible.map((c: any) => {
              const summary = contractMap[c.id] || { contracts: 0, active: 0, overdue: 0 };
              return (
                <button key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:bg-accent/30 transition-colors text-left">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-11 h-11 rounded-2xl object-cover" /> : c.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{c.name}</p>
                      <Badge variant="outline" className={`text-[9px] shrink-0 ${c.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>{c.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">{c.cpf_cnpj || c.phone || "—"}</p>
                      {summary.overdue > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-bold shrink-0">{summary.overdue} atras.</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 ${scoreColor(c.credit_score || 0)}`}>{c.credit_score || 0}</span>
                    <ChevronRight size={16} className="text-muted-foreground/40" />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visible.map((c: any) => {
            const summary = contractMap[c.id] || { contracts: 0, active: 0, overdue: 0 };
            const sc = Number(c.credit_score || 0);
            const isSel = selected.has(c.id);
            return (
              <div key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
                className={`relative bg-gradient-to-br from-card/40 to-card/10 backdrop-blur-md border rounded-3xl p-5 cursor-pointer transition-all group shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 ${isSel ? "border-primary/50 ring-1 ring-primary/30" : "border-border/10 hover:border-primary/30"}`}>
                {/* Top-left checkbox */}
                <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={() => toggleOne(c.id)}
                    className="w-4 h-4 rounded border-border/40 bg-card text-primary focus:ring-primary/40 cursor-pointer" />
                </div>

                {/* Top-right delete */}
                <button onClick={(e) => handleDelete(c.id, e)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  title="Excluir">
                  <Trash2 size={13} />
                </button>

                {/* Overdue tag */}
                {summary.overdue > 0 && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold ring-1 ring-destructive/30">
                    {summary.overdue} em atraso
                  </div>
                )}

                {/* Avatar */}
                <div className="flex flex-col items-center text-center mb-3 mt-2">
                  <div className="relative w-16 h-16 mb-2">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/15 flex items-center justify-center text-xl font-bold text-primary">
                      {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover" /> : c.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className={`absolute -bottom-1 -right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ring-2 ring-card ${scoreColor(sc)}`}>{sc}</span>
                  </div>
                  <p className="font-semibold text-foreground text-sm truncate w-full">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{scoreLabel(sc)}{c.cpf_cnpj ? ` • ${c.cpf_cnpj}` : ""}</p>
                </div>

                {/* Info */}
                <div className="space-y-1.5 mb-3 min-h-[42px]">
                  {(c.phone || c.whatsapp) && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone size={11} className="shrink-0" />
                      <span className="truncate">{c.phone || c.whatsapp}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail size={11} className="shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {!c.phone && !c.whatsapp && !c.email && (
                    <p className="text-[11px] text-muted-foreground/50 italic">Sem contato</p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
                  <Badge variant="outline" className={`text-[9px] ${c.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>
                    {c.status}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <FileText size={10} /> {summary.contracts} contrato{summary.contracts !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {!isLoading && hasMore && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-xs text-muted-foreground">Mostrando {visible.length} de {filtered.length}</p>
          <button onClick={() => setPage(p => p + 1)} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-card/40 hover:bg-card border border-border/30 text-foreground transition-colors">
            Carregar mais
          </button>
        </div>
      )}

      {/* ─── Import CSV Modal ──────────────────────────────── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => { setImportOpen(false); setImportPreview(null); }}>
          <div className="bg-card border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-primary" />
                <h3 className="text-base font-bold text-foreground">Importar Clientes (CSV)</h3>
              </div>
              <button onClick={() => { setImportOpen(false); setImportPreview(null); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={16} /></button>
            </div>

            {!importPreview ? (
              <div className="p-6 space-y-4">
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <Upload size={28} className="mx-auto text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-medium text-foreground">Clique ou arraste o CSV aqui</p>
                  <p className="text-xs text-muted-foreground mt-1">Colunas aceitas: nome, cpf, telefone, whatsapp, email, data_nascimento, status</p>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
                <button onClick={downloadTemplate} className="text-xs text-primary hover:underline">📥 Baixar modelo CSV</button>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-border flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-success"><CheckCircle size={13} /> {importPreview.filter(r => r._errors.length === 0).length} válidas</span>
                  <span className="flex items-center gap-1 text-destructive"><AlertCircle size={13} /> {importPreview.filter(r => r._errors.length > 0).length} com erro</span>
                  <span className="text-muted-foreground ml-auto">{importPreview.length} total</span>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">#</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Nome</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">CPF</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Telefone</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Email</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((r) => (
                        <tr key={r._row} className={`border-t border-border/50 ${r._errors.length > 0 ? "bg-destructive/5" : ""}`}>
                          <td className="px-3 py-2 text-muted-foreground">{r._row}</td>
                          <td className="px-3 py-2 text-foreground font-medium">
                            {r.name || <span className="text-destructive">—</span>}
                            {r._errors.length > 0 && <p className="text-[10px] text-destructive">{r._errors.join(", ")}</p>}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground font-mono">{r.cpf_cnpj || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.phone || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">{r.email || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.status || "Ativo"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
                  <button onClick={() => setImportPreview(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent">Voltar</button>
                  <button onClick={confirmImport} disabled={importing} className="btn-premium disabled:opacity-50">
                    {importing ? "Importando..." : `Importar ${importPreview.filter(r => r._errors.length === 0).length} cliente(s)`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;
