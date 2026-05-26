import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";

const DAYS = [
  { key: "mon", label: "Seg" },
  { key: "tue", label: "Ter" },
  { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" },
  { key: "fri", label: "Sex" },
  { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
];

interface Props {
  settings: any;
  onUpdate: (updates: any) => void;
}

export const BusinessHoursCard = ({ settings, onUpdate }: Props) => {
  if (!settings) return null;

  const enabled = !!settings.bot_business_hours_only;
  const workDays: string[] = Array.isArray(settings.bot_work_days)
    ? settings.bot_work_days
    : ["mon", "tue", "wed", "thu", "fri"];

  const toggleDay = (day: string) => {
    const next = workDays.includes(day)
      ? workDays.filter((d) => d !== day)
      : [...workDays, day];
    onUpdate({ bot_work_days: next });
  };

  return (
    <Card className="p-6 border-border/50 bg-card/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Clock size={18} className="text-amber-500" />
          </div>
          <div>
            <h3 className="font-bold">Horário Comercial do Bot</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fora do expediente, mensagens são marcadas para humano
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => onUpdate({ bot_business_hours_only: v })}
        />
      </div>

      {enabled && (
        <div className="space-y-5 pt-4 border-t border-border/50">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Início</Label>
              <Input
                type="time"
                value={settings.bot_business_start || "08:00"}
                onChange={(e) => onUpdate({ bot_business_start: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Fim</Label>
              <Input
                type="time"
                value={settings.bot_business_end || "18:00"}
                onChange={(e) => onUpdate({ bot_business_end: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Dias de trabalho</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const active = workDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    onClick={() => toggleDay(d.key)}
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
