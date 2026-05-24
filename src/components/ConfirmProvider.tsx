import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, Info } from "lucide-react";

type Variant = "default" | "destructive" | "warning";

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

const variantStyles: Record<Variant, { icon: ReactNode; btn: string; iconWrap: string }> = {
  default: {
    icon: <Info size={20} />,
    btn: "bg-primary text-primary-foreground hover:bg-primary/90",
    iconWrap: "bg-primary/10 text-primary",
  },
  warning: {
    icon: <AlertTriangle size={20} />,
    btn: "bg-warning text-warning-foreground hover:opacity-90",
    iconWrap: "bg-warning/10 text-warning",
  },
  destructive: {
    icon: <Trash2 size={20} />,
    btn: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    iconWrap: "bg-destructive/10 text-destructive",
  },
};

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback((input) => {
    const o: ConfirmOptions = typeof input === "string" ? { title: input } : input;
    setOpts({
      title: o.title ?? "Confirmar ação",
      description: o.description,
      confirmLabel: o.confirmLabel ?? "Confirmar",
      cancelLabel: o.cancelLabel ?? "Cancelar",
      variant: o.variant ?? "default",
    });
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handle = (value: boolean) => {
    setOpen(false);
    resolverRef.current?.(value);
    resolverRef.current = null;
  };

  const v = variantStyles[opts.variant ?? "default"];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => { if (!o) handle(false); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${v.iconWrap}`}>
                {v.icon}
              </div>
              <div className="flex-1 text-left">
                <AlertDialogTitle>{opts.title}</AlertDialogTitle>
                {opts.description && (
                  <AlertDialogDescription className="mt-1.5">
                    {opts.description}
                  </AlertDialogDescription>
                )}
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handle(false)}>{opts.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handle(true)} className={v.btn}>
              {opts.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback seguro caso seja chamado fora do provider
    return async (input) => {
      const title = typeof input === "string" ? input : input.title || "Confirmar?";
      return window.confirm(title);
    };
  }
  return ctx;
};
