import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquare, Check } from "lucide-react";
import { formatBR } from "@/lib/dateUtils";

interface Props {
  installments: any[];
  onWhatsApp: (i: any) => void;
  onMarkPaid: (id: string) => void;
  onClickInstallment?: (i: any) => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const CalendarView = ({ installments, onWhatsApp, onMarkPaid, onClickInstallment }: Props) => {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { days, byDay } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startWeekday = first.getDay();
    const totalDays = last.getDate();
    const grid: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) grid.push(null);
    for (let d = 1; d <= totalDays; d++) grid.push(new Date(year, month, d));
    while (grid.length % 7 !== 0) grid.push(null);

    const map = new Map<string, any[]>();
    installments.forEach((i: any) => {
      const dt = new Date(i.due_date);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      const list = map.get(key) || [];
      list.push(i);
      map.set(key, list);
    });
    return { days: grid, byDay: map };
  }, [cursor, installments]);

  const monthName = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const selectedItems = selectedDay ? byDay.get(selectedDay) || [] : [];
  const selectedTotal = selectedItems.reduce((acc, i) => acc + Number(i.amount), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-4">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="p-2 rounded-lg hover:bg-accent focus-ring"
        >
          <ChevronLeft size={16} />
        </button>
        <h3 className="text-headline text-lg capitalize">{monthName}</h3>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="p-2 rounded-lg hover:bg-accent focus-ring"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-3 overflow-x-auto">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 min-w-[560px]">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 min-w-[560px]">
          {days.map((d, idx) => {
            if (!d) return <div key={idx} className="h-20 rounded-lg bg-muted/10" />;
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const items = byDay.get(key) || [];
            const overdueCount = items.filter((i) => i.status === "overdue").length;
            const pendingCount = items.filter((i) => i.status === "pending").length;
            const paidCount = items.filter((i) => i.status === "paid").length;
            const total = items.reduce((acc, i) => acc + Number(i.amount), 0);
            const isToday = key === todayKey;
            const isSelected = key === selectedDay;

            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(items.length > 0 ? key : null)}
                className={`h-20 rounded-lg border p-1.5 text-left transition-all focus-ring ${
                  isSelected
                    ? "border-primary ring-1 ring-primary/30 bg-primary/5"
                    : isToday
                    ? "border-primary/40 bg-primary/5"
                    : items.length > 0
                    ? "border-border bg-card hover:bg-accent/40"
                    : "border-transparent bg-muted/5"
                }`}
              >
                <div className={`text-xs font-bold mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>
                  {d.getDate()}
                </div>
                {items.length > 0 && (
                  <div className="space-y-0.5">
                    {overdueCount > 0 && (
                      <div className="text-[9px] px-1 rounded bg-destructive/15 text-destructive font-semibold">
                        {overdueCount} atras.
                      </div>
                    )}
                    {pendingCount > 0 && (
                      <div className="text-[9px] px-1 rounded bg-warning/15 text-warning font-semibold">
                        {pendingCount} pend.
                      </div>
                    )}
                    {paidCount > 0 && (
                      <div className="text-[9px] px-1 rounded bg-success/15 text-success font-semibold">
                        {paidCount} pagas
                      </div>
                    )}
                    <div className="text-[9px] text-muted-foreground truncate">R$ {fmt(total)}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && selectedItems.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground">
              Parcelas — {formatBR(selectedItems[0].due_date)}
            </h4>
            <span className="text-xs text-muted-foreground">Total: <strong className="text-foreground">R$ {fmt(selectedTotal)}</strong></span>
          </div>
          <div className="space-y-2">
            {selectedItems.map((i) => (
              <div key={i.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-primary" onClick={() => onClickInstallment?.(i)}>
                    {i.client_name} <span className="text-muted-foreground text-xs">#{i.installment_number}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">R$ {fmt(Number(i.amount))} · {i.status === "overdue" ? "Atrasada" : i.status === "paid" ? "Paga" : "Pendente"}</p>
                </div>
                {i.status !== "paid" && (
                  <div className="flex gap-1.5">
                    <button onClick={() => onWhatsApp(i)} className="p-2 rounded-lg bg-success text-success-foreground hover:opacity-90 active:scale-95 focus-ring" title="WhatsApp">
                      <MessageSquare size={14} />
                    </button>
                    <button onClick={() => onMarkPaid(i.id)} className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 active:scale-95 focus-ring" title="Marcar como paga">
                      <Check size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
