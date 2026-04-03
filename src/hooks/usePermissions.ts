import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type AppRole = "admin" | "operator" | "viewer";

export const usePermissions = () => {
  const { user } = useAuth();

  const { data: role, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .single();
      return (data?.role as AppRole) || "operator"; // default to operator if no role set
    },
    enabled: !!user,
  });

  const currentRole: AppRole = role || "operator";

  return {
    role: currentRole,
    isLoading,
    isAdmin: currentRole === "admin",
    isOperator: currentRole === "operator",
    isViewer: currentRole === "viewer",
    canCreate: currentRole === "admin" || currentRole === "operator",
    canEdit: currentRole === "admin" || currentRole === "operator",
    canDelete: currentRole === "admin",
    canManageSettings: currentRole === "admin",
    canManageUsers: currentRole === "admin",
  };
};
