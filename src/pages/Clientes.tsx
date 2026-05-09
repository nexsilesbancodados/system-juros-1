import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Users, Trash2, Eye, X, ChevronRight, LayoutGrid, List, Phone, Mail, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";

const scoreColor = (s: number) => s >= 700 ? "text-success bg-success/10" : s >= 400 ? "text-warning bg-warning/10" : "text-destructive bg-destructive/10";

const Clientes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Ativo" | "Inativo">("all");
  const [viewMode, setViewMode] = useState<"list" | "cards">(() => {
    return (localStorage.getItem("clients-view") as "list" | "cards") || "list";
  });
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleView = (mode: "list" | "cards") => {
    setViewMode(mode);
    localStorage.setItem("clients-view", mode);
  };

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

  const { filtered, stats } = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = clients.filter((c: any) => {
      const matchName = !q || c.name.toLowerCase().includes(q) || (c.cpf_cnpj || "").includes(search);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchName && matchStatus;
    });
    return {
      filtered,
      stats: {
        total: clients.length,
        active: clients.filter((c: any) => c.status === "Ativo").length,
        inactive: clients.filter((c: any) => c.status === "Inativo").length,
      },
    };
  }, [clients, search, statusFilter]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Excluir este cliente e todos os seus dados?")) return;
    await supabase.from("contract_installments").delete().eq("client_id", id);
    await supabase.from("contracts").delete().eq("client_id", id);
    await supabase.from("installments").delete().eq("client_id", id);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cliente excluído!" });
    qc.invalidateQueries({ queryKey: ["clients", user?.id] });
  };

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
        // tenta dd/mm/yyyy
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
    <div className="space-y-8 animate-fade-in max-w-[1600px] mx-auto">
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
            className={`rounded-3xl border p-6 text-left transition-all duration-300 ${statusFilter === s.filter ? "border-primary/40 bg-card/60 shadow-xl shadow-primary/5 scale-105 z-10" : "border-border/10 bg-card/20 hover:bg-card/40"}`}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Search + View Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-20 py-3.5 rounded-2xl bg-card/30 backdrop-blur-md border border-border/10 text-foreground placeholder:text-muted-foreground/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all" />
          {search && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{filtered.length}</span>
              <button onClick={() => setSearch("")} className="p-1 rounded-md hover:bg-accent text-muted-foreground"><X size={14} /></button>
            </div>
          )}
        </div>
        <div className="flex items-center bg-card border border-border rounded-2xl p-1 shrink-0">
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

      {isLoading ? (
        <div className={viewMode === "cards" ? "grid grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-3"}>
          {[1,2,3,4,5,6].map(i => <div key={i} className={`rounded-xl bg-muted/30 animate-pulse ${viewMode === "cards" ? "h-40" : "h-16"}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users size={28} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-foreground font-medium">{search ? `Nenhum resultado para "${search}"` : "Nenhum cliente encontrado"}</p>
          {!search && <button onClick={() => navigate("/clientes/novo")} className="mt-4 text-sm text-primary hover:underline">+ Cadastrar cliente</button>}
        </div>
      ) : viewMode === "list" ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-3xl border border-border/10 overflow-hidden bg-card/30 backdrop-blur-xl shadow-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => (
                  <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="border-t border-border hover:bg-accent/30 cursor-pointer transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-primary/8 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                          {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover" /> : c.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{c.name}</p>
                          {c.cpf_cnpj && <p className="text-xs text-muted-foreground font-mono">{c.cpf_cnpj}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{c.phone || c.whatsapp || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${scoreColor(c.credit_score || 0)}`}>{c.credit_score || 0}</span>
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden space-y-2">
            {filtered.map((c: any) => (
              <button key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:bg-accent/30 transition-colors text-left">
                <div className="w-11 h-11 rounded-2xl bg-primary/8 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-11 h-11 rounded-xl object-cover" /> : c.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{c.name}</p>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${c.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>{c.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.cpf_cnpj || c.phone || "—"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scoreColor(c.credit_score || 0)}`}>{c.credit_score || 0}</span>
                  <ChevronRight size={16} className="text-muted-foreground/40" />
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((c: any) => (
            <div key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
              className="bg-card/30 backdrop-blur-md border border-border/10 rounded-3xl p-6 hover:border-primary/40 hover:bg-card/50 cursor-pointer transition-all group relative shadow-lg hover:shadow-primary/5">
              {/* Delete button */}
              <button onClick={(e) => handleDelete(c.id, e)}
                className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                title="Excluir">
                <Trash2 size={13} />
              </button>

              {/* Avatar + Name */}
              <div className="flex flex-col items-center text-center mb-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary mb-2">
                  {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-14 h-14 rounded-2xl object-cover" /> : c.name?.charAt(0)?.toUpperCase()}
                </div>
                <p className="font-semibold text-foreground text-sm truncate w-full">{c.name}</p>
                {c.cpf_cnpj && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{c.cpf_cnpj}</p>}
              </div>

              {/* Info */}
              <div className="space-y-1.5 mb-3">
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
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-border">
                <Badge variant="outline" className={`text-[9px] ${c.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>
                  {c.status}
                </Badge>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scoreColor(c.credit_score || 0)}`}>
                  {c.credit_score || 0}
                </span>
              </div>
            </div>
          ))}
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
