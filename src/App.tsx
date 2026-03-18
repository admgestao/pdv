import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import PDV from "@/pages/PDV";
import Orcamentos from "@/pages/Orcamentos";
import Vendas from "@/pages/Vendas";
import Produtos from "@/pages/Produtos";
import Pessoas from "@/pages/Pessoas";
import FormasPagamento from "@/pages/FormasPagamento";
import Caixa from "@/pages/Caixa";
import ContasPagar from "@/pages/ContasPagar";
import ContasReceber from "@/pages/ContasReceber";
import Promocoes from "@/pages/Promocoes";
import Empresa from "@/pages/Empresa";
import Usuarios from "@/pages/Usuarios";
import Relatorios from "@/pages/Relatorios";
import Trocas from "@/pages/Trocas";
import Mensagens from "@/pages/Mensagens";
import NotFound from "@/pages/NotFound";
import { Loader2, ShieldAlert, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const queryClient = new QueryClient();

// --- COMPONENTE DE MENSAGEM DE ACESSO RESTRITO ---
const AccessDenied = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-in fade-in zoom-in duration-300">
    <div className="bg-destructive/10 p-4 rounded-full mb-4">
      <ShieldAlert className="h-12 w-12 text-destructive" />
    </div>
    <h2 className="text-2xl font-bold tracking-tight">Acesso Restrito</h2>
    <p className="text-muted-foreground mt-2 max-w-xs">
      Esta tela foi restringida pelo administrador do sistema. Entre em contato para solicitar permissão.
    </p>
    <Button asChild className="mt-6" variant="outline">
      <Link to="/"><Home className="mr-2 h-4 w-4" /> Voltar ao Início</Link>
    </Button>
  </div>
);

// --- COMPONENTE DE PROTEÇÃO DE ROTA ATUALIZADO ---
const ProtectedRoute = ({ children, permission }: { children: React.ReactNode, permission?: string }) => {
  const { user, hasPermission } = useAuth();
  const isStored = !!localStorage.getItem('pdv_user_v2');

  // 1. Enquanto carrega a sessão
  if (!user && isStored) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 2. Se não está logado mesmo, aí sim manda para o Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Se está logado, mas não tem a permissão:
  // Em vez de expulsar, exibe a mensagem de AccessDenied
  if (permission && !hasPermission(permission)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Rota de Login */}
              <Route path="/login" element={<Login />} />

              {/* Rotas Protegidas */}
              <Route element={<Layout />}>
                
                {/* Dashboard */}
                <Route path="/" element={
                  <ProtectedRoute permission="dashboard">
                    <Dashboard />
                  </ProtectedRoute>
                } />

                {/* Vendas */}
                <Route path="/pdv" element={
                  <ProtectedRoute permission="pdv">
                    <PDV />
                  </ProtectedRoute>
                } />
                <Route path="/vendas" element={
                  <ProtectedRoute permission="vendas">
                    <Vendas />
                  </ProtectedRoute>
                } />
                <Route path="/orcamentos" element={
                  <ProtectedRoute permission="orcamentos">
                    <Orcamentos />
                  </ProtectedRoute>
                } />

                {/* Cadastros */}
                <Route path="/cadastro/pessoas" element={
                  <ProtectedRoute permission="pessoas">
                    <Pessoas />
                  </ProtectedRoute>
                } />
                <Route path="/cadastro/produtos" element={
                  <ProtectedRoute permission="produtos">
                    <Produtos />
                  </ProtectedRoute>
                } />
                <Route path="/cadastro/empresa" element={
                  <ProtectedRoute permission="empresa">
                    <Empresa />
                  </ProtectedRoute>
                } />
                <Route path="/cadastro/pagamentos" element={
                  <ProtectedRoute permission="pagamentos">
                    <FormasPagamento />
                  </ProtectedRoute>
                } />

                {/* Financeiro */}
                <Route path="/financeiro/caixa" element={
                  <ProtectedRoute permission="caixa">
                    <Caixa />
                  </ProtectedRoute>
                } />
                <Route path="/financeiro/contas-pagar" element={
                  <ProtectedRoute permission="contas-pagar">
                    <ContasPagar />
                  </ProtectedRoute>
                } />
                <Route path="/financeiro/contas-receber" element={
                  <ProtectedRoute permission="contas-receber">
                    <ContasReceber />
                  </ProtectedRoute>
                } />

                {/* Outros */}
                <Route path="/promocoes" element={
                  <ProtectedRoute permission="promocoes">
                    <Promocoes />
                  </ProtectedRoute>
                } />
                <Route path="/Trocas" element={
                  <ProtectedRoute permission="trocas">
                    <Trocas />
                  </ProtectedRoute>
                } />
                <Route path="/relatorios" element={
                  <ProtectedRoute permission="relatorios">
                    <Relatorios />
                  </ProtectedRoute>
                } />
                <Route path="/mensagens" element={
                  <ProtectedRoute permission="mensagens">
                    <Mensagens />
                  </ProtectedRoute>
                } />

                {/* Configurações */}
                <Route path="/usuarios" element={
                  <ProtectedRoute permission="usuarios">
                    <Usuarios />
                  </ProtectedRoute>
                } />
                <Route path="/area-desenvolvedor" element={
                  <ProtectedRoute permission="area-desenvolvedor">
                    <Relatorios />
                  </ProtectedRoute>
                } />

              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;