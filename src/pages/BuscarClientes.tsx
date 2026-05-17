import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight, User as UserIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_SIZE = 10;

const BuscarClientes = () => {
  const { user } = useAuth();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const { data, isFetching } = useQuery({
    queryKey: ["buscar-clientes", user?.id, query, page],
    enabled: !!user,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let req = supabase
        .from("clients")
        .select("id, name, email, phone, cpf_cnpj, status, avatar_url", { count: "exact" })
        .order("name", { ascending: true })
        .range(from, to);
      if (query.trim()) req = req.ilike("name", `%${query.trim()}%`);
      const { data, count, error } = await req;
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
  });

  const total = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setQuery(term);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Buscar Clientes</h1>
        <p className="text-sm text-muted-foreground">Pesquise por nome (não diferencia maiúsculas/minúsculas).</p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Digite o nome..."
            className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-ring"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Buscar
        </button>
      </form>

      <div className="bg-card border border-border rounded-2xl divide-y divide-border min-h-[200px]">
        {isFetching ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : data?.rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
        ) : (
          data?.rows.map((c) => (
            <Link
              key={c.id}
              to={`/clientes/${c.id}`}
              className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors"
            >
              {c.avatar_url ? (
                <img src={c.avatar_url} alt={c.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserIcon size={18} className="text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.cpf_cnpj || "—"} {c.phone ? `• ${c.phone}` : ""} {c.email ? `• ${c.email}` : ""}
                </p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-muted text-muted-foreground">
                {c.status}
              </span>
            </Link>
          ))
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Página {page + 1} de {totalPages} • {total} resultado{total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-2 rounded-xl border border-border text-foreground disabled:opacity-40 hover:bg-muted/30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
              disabled={page + 1 >= totalPages}
              className="px-3 py-2 rounded-xl border border-border text-foreground disabled:opacity-40 hover:bg-muted/30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuscarClientes;
