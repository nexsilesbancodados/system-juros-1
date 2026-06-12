import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Plus, CheckCircle, Edit, Trash2, Send, Copy, Download, Printer,
  FileText, Star, TrendingUp, Ban, MessageSquare, Repeat, PhoneCall,
  StickyNote, Wrench, type LucideIcon,
} from "lucide-react";

export type ToolAction = {
  icon: LucideIcon;
  label: string;
  description: string;
  action: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export type ToolGroup = {
  label: string;
  actions: ToolAction[];
};

interface Props {
  trigger: ReactNode;
  groups: ToolGroup[];
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export default function ClientToolsPanel({ trigger, groups, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-card border-l border-border">
        <SheetHeader className="space-y-1 mb-2">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Wrench size={18} className="text-primary" /> Ferramentas
          </SheetTitle>
          <SheetDescription className="text-xs">
            Todas as ações disponíveis para este cliente.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 pb-6">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {g.label}
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {g.actions.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={`${a.label}-${i}`}
                      disabled={a.disabled}
                      onClick={a.action}
                      className={`group flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                        a.destructive
                          ? "border-destructive/20 hover:bg-destructive/10 text-destructive"
                          : "border-border hover:bg-accent hover:border-primary/30 text-foreground"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          a.destructive
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary group-hover:bg-primary/20"
                        }`}
                      >
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{a.label}</p>
                        <p
                          className={`text-[11px] leading-tight mt-0.5 ${
                            a.destructive ? "text-destructive/70" : "text-muted-foreground"
                          }`}
                        >
                          {a.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Re-export icons used by consumers for convenience
export {
  Plus, CheckCircle, Edit, Trash2, Send, Copy, Download, Printer,
  FileText, Star, TrendingUp, Ban, MessageSquare, Repeat, PhoneCall, StickyNote,
};
