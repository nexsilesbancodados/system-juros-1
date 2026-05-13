import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WhiteLabelProvider } from "@/contexts/WhiteLabelContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";

import Index from "./pages/Index";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PortalCliente from "./pages/PortalCliente";
// ... keep existing code
const NovoCliente = lazy(() => import("./pages/NovoCliente"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Analises = lazy(() => import("./pages/Analises"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Cobrancas = lazy(() => import("./pages/Cobrancas"));
const Carteira = lazy(() => import("./pages/Carteira"));
const Lucros = lazy(() => import("./pages/Lucros"));
const Gastos = lazy(() => import("./pages/Gastos"));
const Metas = lazy(() => import("./pages/Metas"));
const Simulador = lazy(() => import("./pages/Simulador"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Anotacoes = lazy(() => import("./pages/Anotacoes"));
const Planilha = lazy(() => import("./pages/Planilha"));
const PuxadaDados = lazy(() => import("./pages/PuxadaDados"));
const Sobre = lazy(() => import("./pages/Sobre"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Admin = lazy(() => import("./pages/Admin"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Historico = lazy(() => import("./pages/Historico"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Cobradores = lazy(() => import("./pages/Cobradores"));
const QRCodePage = lazy(() => import("./pages/QRCodePage"));
const AgenteIA = lazy(() => import("./pages/AgenteIA"));
const CobradorExterno = lazy(() => import("./pages/CobradorExterno"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Automacoes = lazy(() => import("./pages/Automacoes"));
const ClienteDetalhe = lazy(() => import("./pages/ClienteDetalhe"));
const ContractRedirect = lazy(() => import("./pages/ContractRedirect"));
const Suporte = lazy(() => import("./pages/Suporte"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const Chat = lazy(() => import("./pages/Chat"));
const Inadimplencia = lazy(() => import("./pages/Inadimplencia"));
const WhatsAppConfig = lazy(() => import("./pages/WhatsAppConfig"));
const TvMode = lazy(() => import("./pages/TvMode"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <WhiteLabelProvider>
          <ThemeProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/portal-cliente" element={<PortalCliente />} />
                <Route path="/cobrador-externo" element={<CobradorExterno />} />
                <Route path="/tv" element={<ProtectedRoute><TvMode /></ProtectedRoute>} />
                <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/analises" element={<Analises />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/clientes/novo" element={<NovoCliente />} />
                  <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                  <Route path="/contratos/:id" element={<ContractRedirect />} />
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
                  <Route path="/historico" element={<Historico />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                  <Route path="/cobradores" element={<Cobradores />} />
                  <Route path="/qrcode" element={<QRCodePage />} />
                  <Route path="/agente-ia" element={<AgenteIA />} />
                  <Route path="/auditoria" element={<Auditoria />} />
                  <Route path="/automacoes" element={<Automacoes />} />
                  <Route path="/suporte" element={<Suporte />} />
                  <Route path="/notificacoes" element={<Notificacoes />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/inadimplencia" element={<Inadimplencia />} />
                  <Route path="/configuracoes/whatsapp" element={<WhatsAppConfig />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          </ThemeProvider>
        </WhiteLabelProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
