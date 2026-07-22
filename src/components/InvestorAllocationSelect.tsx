import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Landmark } from "lucide-react";

type Option = {
  id: string;
  principal: number;
  total_due: number;
  paid_amount: number;
  investor_name: string;
  status: string;
};

/**
 * Seletor opcional para vincular um contrato de cliente a uma
 * captação (investor_loan) do credor.
 */
export default function InvestorAllocationSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("investor_loans" as never)
        .select("id, principal, total_due, paid_amount, status, investors(name)")
        .neq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = ((data as any) || []).map((r: any) => ({
        id: r.id,
        principal: Number(r.principal),
        total_due: Number(r.total_due),
        paid_amount: Number(r.paid_amount),
        status: r.status,
        investor_name: r.investors?.name || "Investidor",
      }));
      setOptions(rows);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (options.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Landmark className="h-3.5 w-3.5" /> Alocação de capital (opcional)
      </label>
      <p className="mt-1 text-[11px] text-white/50">
        Vincule este empréstimo ao capital captado de um investidor específico.
      </p>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none focus:border-primary"
      >
        <option value="">— Capital próprio —</option>
        {options.map((o) => {
          const saldo = o.principal - o.paid_amount;
          return (
            <option key={o.id} value={o.id}>
              {o.investor_name} — {o.principal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              {" "}(saldo {saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
            </option>
          );
        })}
      </select>
    </div>
  );
}
