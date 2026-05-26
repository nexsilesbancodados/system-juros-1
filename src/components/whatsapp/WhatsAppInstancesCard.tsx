import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Star, Loader2, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Instance {
  id: string;
  name: string;
  instance: string;
  api_url: string;
  api_key: string;
  is_default: boolean;
  is_active: boolean;
}

export const WhatsAppInstancesCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    instance: "",
    api_url: "https://nexsiles-evolution-api.y7p1l4.easypanel.host/",
    api_key: "",
  });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user?.id]);

  const handleCreate = async () => {
    if (!form.name || !form.instance || !form.api_key) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("whatsapp_instances").insert({
      user_id: user!.id,
      name: form.name,
      instance: form.instance,
      api_url: form.api_url,
      api_key: form.api_key,
      is_default: items.length === 0,
      is_active: true,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      return;
    }
    setForm({ name: "", instance: "", api_url: form.api_url, api_key: "" });
    fetchData();
    toast({ title: "Instância adicionada" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta instância?")) return;
    const { error } = await supabase.from("whatsapp_instances").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchData();
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from("whatsapp_instances").update({ is_default: false }).eq("user_id", user!.id);
    const { error } = await supabase.from("whatsapp_instances").update({ is_default: true }).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchData();
  };

  const handleToggleActive = async (item: Instance) => {
    const { error } = await supabase
      .from("whatsapp_instances")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchData();
  };

  return (
    <Card className="p-6 border-border/50 bg-card/50">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Smartphone size={18} className="text-emerald-500" />
        </div>
        <div>
          <h3 className="font-bold">Instâncias WhatsApp (Multi-número)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Adicione múltiplos números/instâncias Evolution. A padrão é usada por novas conversas.
          </p>
        </div>
      </div>

      <div className="space-y-2 mb-5">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="animate-spin mr-2" size={14} /> Carregando...
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            Nenhuma instância adicional. Use o formulário abaixo para adicionar.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full ${item.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    {item.is_default && (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">
                        <Star size={9} className="mr-1 fill-amber-500" /> Padrão
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{item.instance}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!item.is_default && (
                  <Button variant="ghost" size="sm" onClick={() => handleSetDefault(item.id)} title="Definir como padrão">
                    <Star size={14} />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleToggleActive(item)} title={item.is_active ? "Desativar" : "Ativar"}>
                  <span className={`text-[10px] font-bold ${item.is_active ? "text-emerald-500" : "text-muted-foreground"}`}>
                    {item.is_active ? "ON" : "OFF"}
                  </span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="text-destructive hover:bg-destructive/10">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pt-4 border-t border-border/50 space-y-3">
        <h4 className="text-xs font-bold uppercase text-muted-foreground">Adicionar Instância</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome / Rótulo</Label>
            <Input
              placeholder="Ex: Comercial"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Instance (Evolution)</Label>
            <Input
              placeholder="instancia-comercial"
              value={form.instance}
              onChange={(e) => setForm({ ...form, instance: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">API URL</Label>
            <Input
              value={form.api_url}
              onChange={(e) => setForm({ ...form, api_url: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">API Key</Label>
            <Input
              type="password"
              placeholder="Chave da Evolution API"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              className="rounded-xl"
            />
          </div>
        </div>
        <Button onClick={handleCreate} disabled={creating} className="btn-premium w-full sm:w-auto">
          {creating ? <Loader2 className="animate-spin mr-2" size={14} /> : <Plus size={14} className="mr-2" />}
          Adicionar
        </Button>
      </div>
    </Card>
  );
};
