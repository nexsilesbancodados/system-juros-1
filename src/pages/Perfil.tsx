import { useState, useEffect } from "react";
import { User, Camera, Save, Key, Mail, Shield, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const Perfil = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", email: "", pix_key: "", pix_key_type: "CPF", billing_message: "",
  });
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || "", email: profile.email || "",
        pix_key: profile.pix_key || "", pix_key_type: profile.pix_key_type || "CPF",
        billing_message: profile.billing_message || "",
      });
      setAvatarPreview(profile.avatar_url || null);
    }
  }, [profile]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    let avatar_url = profile?.avatar_url || null;
    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `avatars/${user.id}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("uploads").upload(path, avatarFile, { upsert: true });
      if (!uploadError) {
        const { data } = supabase.storage.from("uploads").getPublicUrl(path);
        avatar_url = data.publicUrl;
      }
    }
    const { error } = await supabase.from("profiles").update({
      name: form.name.trim(), pix_key: form.pix_key.trim() || null,
      pix_key_type: form.pix_key_type, billing_message: form.billing_message.trim() || null, avatar_url,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Perfil atualizado!" }); window.location.reload(); }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas informações pessoais.</p>
      </div>

      {/* Avatar Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden ring-2 ring-primary/20">
              {avatarPreview ? <img src={avatarPreview} alt="" className="w-20 h-20 rounded-2xl object-cover" /> : profile?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity" style={{ background: "var(--gradient-button)" }}>
              <Camera size={13} className="text-white" />
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>
          <div>
            <p className="font-bold text-foreground text-lg">{profile?.name || "Usuário"}</p>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                {profile?.subscription_type === "yearly" ? "Plano Anual" : "Plano Mensal"}
              </Badge>
              {profile?.is_admin && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px]">
                  <Shield size={10} className="mr-1" /> Admin
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2"><User size={16} /> Informações</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Nome</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="email" value={form.email} disabled className={`${inputCls} pl-9 bg-muted cursor-not-allowed`} />
            </div>
          </div>
        </div>
      </div>

      {/* PIX */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2"><Key size={16} className="text-primary" /> Chave PIX</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Tipo</label>
            <select value={form.pix_key_type} onChange={(e) => setForm({ ...form, pix_key_type: e.target.value })} className={inputCls}>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="Email">Email</option>
              <option value="Telefone">Telefone</option>
              <option value="Aleatória">Chave Aleatória</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Chave</label>
            <input type="text" value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="Sua chave PIX" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Billing message */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Mensagem de Cobrança</h2>
        <p className="text-xs text-muted-foreground">Variáveis: <code className="text-primary">{"{nome}"}</code>, <code className="text-primary">{"{parcela}"}</code>, <code className="text-primary">{"{valor}"}</code>, <code className="text-primary">{"{data}"}</code></p>
        <textarea
          value={form.billing_message}
          onChange={(e) => setForm({ ...form, billing_message: e.target.value })}
          rows={4}
          className={`${inputCls} resize-none`}
          placeholder="Olá {nome}, sua parcela {parcela} de R$ {valor} venceu em {data}..."
        />
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-primary/20"
        style={{ background: "var(--gradient-button)" }}>
        <Save size={16} /> {saving ? "Salvando..." : "Salvar Alterações"}
      </button>
    </div>
  );
};

export default Perfil;
