import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ContractRedirect = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const redirect = async () => {
      if (!id) { navigate("/clientes", { replace: true }); return; }
      const { data } = await supabase.from("contracts").select("client_id").eq("id", id).single();
      if (data?.client_id) {
        navigate(`/clientes/${data.client_id}`, { replace: true });
      } else {
        navigate("/clientes", { replace: true });
      }
    };
    redirect();
  }, [id, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default ContractRedirect;
