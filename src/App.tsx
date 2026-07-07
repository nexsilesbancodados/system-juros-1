import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WhiteLabelProvider } from "@/contexts/WhiteLabelContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import OfflineIndicator from "./components/OfflineIndicator";
import ErrorBoundary from "./components/ErrorBoundary";
import SuspenseWatchdog from "./components/SuspenseWatchdog";
import { ConfirmProvider } from "./components/ConfirmProvider";
import PortalSessionGuard from "./components/PortalSessionGuard";

import Index from "./pages/Index";

import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PortalCliente = lazy(() => import("./pages/PortalCliente"));
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

const ClienteDetalhe = lazy(() => import("./pages/ClienteDetalhe"));
const ContractRedirect = lazy(() => import("./pages/ContractRedirect"));
const Suporte = lazy(() => import("./pages/Suporte"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const Chat = lazy(() => import("./pages/Chat"));
const Inadimplencia = lazy(() => import("./pages/Inadimplencia"));
const WhatsAppConfig = lazy(() => import("./pages/WhatsAppConfig"));
const TvMode = lazy(() => import("./pages/TvMode"));
const BuscarClientes = lazy(() => import("./pages/BuscarClientes"));
const Hoje = lazy(() => import("./pages/Hoje"));
const Planos = lazy(() => import("./pages/Planos"));
const Comunicacao = lazy(() => import("./pages/Comunicacao"));
const WhatsAppInbox = lazy(() => import("./pages/WhatsAppInbox"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        const status = error?.status ?? error?.code;
        // não retentar 4xx (auth/permissão/validação)
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      retry: 0,
    },
  },
});

const PageLoader = () => (
  <SuspenseWatchdog>
    <div className="min-h-[60vh] p-6 space-y-4 animate-pulse">
      <div className="h-7 w-48 rounded-lg bg-muted/40" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted/30 border border-border/20" />
        ))}
      </div>
      <div className="h-[320px] rounded-2xl bg-muted/20 border border-border/20" />
    </div>
  </SuspenseWatchdog>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineIndicator />
      <AuthProvider>
        <WhiteLabelProvider>
          <ThemeProvider>
          <ConfirmProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <PortalSessionGuard />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/planos" element={<Planos />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/portal-cliente" element={<PortalCliente />} />
                  <Route path="/cobrador-externo" element={<CobradorExterno />} />
                  <Route path="/tv" element={<ProtectedRoute><TvMode /></ProtectedRoute>} />
                  <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                    <Route path="/hoje" element={<ErrorBoundary><Hoje /></ErrorBoundary>}/>
                    <Route path="/analises" element={<ErrorBoundary><Analises /></ErrorBoundary>} />
                    <Route path="/clientes" element={<ErrorBoundary><Clientes /></ErrorBoundary>} />
                    <Route path="/clientes/novo" element={<ErrorBoundary><NovoCliente /></ErrorBoundary>} />
                    <Route path="/clientes/buscar" element={<ErrorBoundary><BuscarClientes /></ErrorBoundary>} />
                    <Route path="/clientes/:id" element={<ErrorBoundary><ClienteDetalhe /></ErrorBoundary>} />
                    <Route path="/contratos/:id" element={<ContractRedirect />} />
                    <Route path="/cobrancas" element={<ErrorBoundary><Cobrancas /></ErrorBoundary>} />
                    <Route path="/carteira" element={<ErrorBoundary><Carteira /></ErrorBoundary>} />
                    <Route path="/lucros" element={<ErrorBoundary><Lucros /></ErrorBoundary>} />
                    <Route path="/gastos" element={<ErrorBoundary><Gastos /></ErrorBoundary>} />
                    <Route path="/ferramentas/metas" element={<ErrorBoundary><Metas /></ErrorBoundary>} />
                    <Route path="/ferramentas/simulador" element={<ErrorBoundary><Simulador /></ErrorBoundary>} />
                    <Route path="/ferramentas/tarefas" element={<ErrorBoundary><Tarefas /></ErrorBoundary>} />
                    <Route path="/ferramentas/anotacoes" element={<ErrorBoundary><Anotacoes /></ErrorBoundary>} />
                    <Route path="/ferramentas/planilha" element={<ErrorBoundary><Planilha /></ErrorBoundary>} />
                    <Route path="/puxada-dados" element={<ErrorBoundary><PuxadaDados /></ErrorBoundary>} />
                    <Route path="/sobre" element={<Sobre />} />
                    <Route path="/perfil" element={<ErrorBoundary><Perfil /></ErrorBoundary>} />
                    <Route path="/admin" element={<ErrorBoundary><Admin /></ErrorBoundary>} />
                    <Route path="/relatorios" element={<ErrorBoundary><Relatorios /></ErrorBoundary>} />
                    <Route path="/historico" element={<ErrorBoundary><Historico /></ErrorBoundary>} />
                    <Route path="/configuracoes" element={<ErrorBoundary><Configuracoes /></ErrorBoundary>} />
                    <Route path="/cobradores" element={<ErrorBoundary><Cobradores /></ErrorBoundary>} />
                    <Route path="/qrcode" element={<QRCodePage />} />
                    <Route path="/comunicacao" element={<ErrorBoundary><Comunicacao /></ErrorBoundary>} />
                    <Route path="/comunicacao/inbox" element={<ErrorBoundary><WhatsAppInbox /></ErrorBoundary>} />
                    <Route path="/agente-ia" element={<Navigate to="/comunicacao?tab=agente" replace />} />
                    <Route path="/automacoes" element={<Navigate to="/configuracoes?tab=bot" replace />} />
                    <Route path="/configuracoes/whatsapp" element={<Navigate to="/comunicacao?tab=whatsapp" replace />} />
                    <Route path="/auditoria" element={<ErrorBoundary><Auditoria /></ErrorBoundary>} />
                    <Route path="/suporte" element={<ErrorBoundary><Suporte /></ErrorBoundary>} />
                    <Route path="/notificacoes" element={<ErrorBoundary><Notificacoes /></ErrorBoundary>} />
                    <Route path="/chat" element={<ErrorBoundary><Chat /></ErrorBoundary>} />
                    <Route path="/inadimplencia" element={<ErrorBoundary><Inadimplencia /></ErrorBoundary>} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
          </ConfirmProvider>
          </ThemeProvider>
        </WhiteLabelProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
