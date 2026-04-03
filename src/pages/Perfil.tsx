import { useState, useEffect } from "react";
import { User, Camera, Save, Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Perfil = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    pix_key: "",
    pix_key_type: "CPF",
    billing_message: "",
  });
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || "",
        email: profile.email || "",
        pix_key: profile.pix_key || "",
        pix_key_type: profile.pix_key_type || "CPF",
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
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, avatarFile, { upsert: true });

      if (!uploadError) {
        const { data } = supabase.storage.from("uploads").getPublicUrl(path);
        avatar_url = data.publicUrl;
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        name: form.name.trim(),
        pix_key: form.pix_key.trim() || null,
        pix_key_type: form.pix_key_type,
        billing_message: form.billing_message.trim() || null,
        avatar_url,
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado!" });
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas informações pessoais e preferências.</p>
      </div>

      {/* Avatar */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center text-2xl font-bold text-foreground overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                profile?.name?.charAt(0)?.toUpperCase() || "U"
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
              <Camera size={14} className="text-primary-foreground" />
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>
          <div>
            <p className="font-semibold text-foreground text-lg">{profile?.name || "Usuário"}</p>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Plano: <span className="text-foreground font-medium">{profile?.subscription_type === "yearly" ? "Anual" : "Mensal"}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Informações</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Nome</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Email</label>
            <input type="email" value={form.email} disabled className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border/50 text-muted-foreground text-sm cursor-not-allowed" />
          </div>
        </div>
      </div>

      {/* PIX */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Key size={18} /> Chave PIX</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Tipo</label>
            <select value={form.pix_key_type} onChange={(e) => setForm({ ...form, pix_key_type: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="Email">Email</option>
              <option value="Telefone">Telefone</option>
              <option value="Aleatória">Chave Aleatória</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Chave</label>
            <input type="text" value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="Sua chave PIX" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      </div>

      {/* Billing message */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Mensagem de Cobrança</h2>
        <p className="text-xs text-muted-foreground">Use variáveis: {"{nome}"}, {"{parcela}"}, {"{valor}"}, {"{data}"}</p>
        <textarea
          value={form.billing_message}
          onChange={(e) => setForm({ ...form, billing_message: e.target.value })}
          rows={4}
          className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          placeholder="Olá {nome}, sua parcela {parcela} de R$ {valor} venceu em {data}..."
        />
      </div>

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
        <Save size={16} />
        {saving ? "Salvando..." : "Salvar Alterações"}
      </button>
    </div>
  );
};

export default Perfil;
