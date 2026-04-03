import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
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
import Uruszap from "./pages/Uruszap.tsx";
import PuxadaDados from "./pages/PuxadaDados.tsx";
import NetworkPage from "./pages/NetworkPage.tsx";
import Sobre from "./pages/Sobre.tsx";
import Perfil from "./pages/Perfil.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analises" element={<Analises />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/novo" element={<NovoCliente />} />
              <Route path="/veiculos" element={<Veiculos />} />
              <Route path="/celulares" element={<Celulares />} />
              <Route path="/penhoras" element={<Penhoras />} />
              <Route path="/cobrancas" element={<Cobrancas />} />
              <Route path="/carteira" element={<Carteira />} />
              <Route path="/lucros" element={<Lucros />} />
              <Route path="/gastos" element={<Gastos />} />
              <Route path="/ferramentas/metas" element={<Metas />} />
              <Route path="/ferramentas/simulador" element={<Simulador />} />
              <Route path="/ferramentas/tarefas" element={<Tarefas />} />
              <Route path="/ferramentas/anotacoes" element={<Anotacoes />} />
              <Route path="/ferramentas/planilha" element={<Planilha />} />
              <Route path="/uruszap" element={<Uruszap />} />
              <Route path="/puxada-dados" element={<PuxadaDados />} />
              <Route path="/network" element={<NetworkPage />} />
              <Route path="/sobre" element={<Sobre />} />
              <Route path="/perfil" element={<Perfil />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
