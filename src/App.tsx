import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import DashboardLayout from "./components/DashboardLayout.tsx";
import NovoCliente from "./pages/NovoCliente.tsx";
import NotFound from "./pages/NotFound.tsx";
import Analises from "./pages/Analises.tsx";
import Clientes from "./pages/Clientes.tsx";
import Veiculos from "./pages/Veiculos.tsx";
import Celulares from "./pages/Celulares.tsx";
import Penhoras from "./pages/Penhoras.tsx";
import Cobrancas from "./pages/Cobrancas.tsx";
import Carteira from "./pages/Carteira.tsx";
import Lucros from "./pages/Lucros.tsx";
import Gastos from "./pages/Gastos.tsx";
import Metas from "./pages/Metas.tsx";
import Simulador from "./pages/Simulador.tsx";
import Tarefas from "./pages/Tarefas.tsx";
import Anotacoes from "./pages/Anotacoes.tsx";
import Planilha from "./pages/Planilha.tsx";
import PuxadaDados from "./pages/PuxadaDados.tsx";
import Sobre from "./pages/Sobre.tsx";
import Perfil from "./pages/Perfil.tsx";
import Admin from "./pages/Admin.tsx";
import Relatorios from "./pages/Relatorios.tsx";
import Contratos from "./pages/Contratos.tsx";
import NovoContrato from "./pages/NovoContrato.tsx";
import ContratoDetalhe from "./pages/ContratoDetalhe.tsx";
import MesaCobranca from "./pages/MesaCobranca.tsx";
import Tesouraria from "./pages/Tesouraria.tsx";
import Historico from "./pages/Historico.tsx";
import Configuracoes from "./pages/Configuracoes.tsx";
import Cobradores from "./pages/Cobradores.tsx";
import PortalCliente from "./pages/PortalCliente.tsx";
import QRCodePage from "./pages/QRCodePage.tsx";
import AgenteIA from "./pages/AgenteIA.tsx";
import CobradorExterno from "./pages/CobradorExterno.tsx";
import Auditoria from "./pages/Auditoria.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/cobrador-externo" element={<CobradorExterno />} />
              <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/analises" element={<Analises />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/clientes/novo" element={<NovoCliente />} />
                <Route path="/contratos" element={<Contratos />} />
                <Route path="/novo-contrato" element={<NovoContrato />} />
                <Route path="/contratos/:id" element={<ContratoDetalhe />} />
                <Route path="/mesa-cobranca" element={<MesaCobranca />} />
                <Route path="/cobrancas" element={<Cobrancas />} />
                <Route path="/carteira" element={<Carteira />} />
                <Route path="/lucros" element={<Lucros />} />
                <Route path="/gastos" element={<Gastos />} />
                <Route path="/ferramentas/metas" element={<Metas />} />
                <Route path="/ferramentas/simulador" element={<Simulador />} />
                <Route path="/ferramentas/tarefas" element={<Tarefas />} />
                <Route path="/ferramentas/anotacoes" element={<Anotacoes />} />
                <Route path="/ferramentas/planilha" element={<Planilha />} />
                
                <Route path="/puxada-dados" element={<PuxadaDados />} />
                
                <Route path="/sobre" element={<Sobre />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/tesouraria" element={<Tesouraria />} />
                <Route path="/historico" element={<Historico />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/cobradores" element={<Cobradores />} />
                <Route path="/portal-cliente" element={<PortalCliente />} />
                <Route path="/qrcode" element={<QRCodePage />} />
                <Route path="/agente-ia" element={<AgenteIA />} />
                <Route path="/auditoria" element={<Auditoria />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
