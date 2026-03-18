import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeUsuario || !senha) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      // 1. Busca o usuário na sua tabela personalizada
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('nome_usuario', nomeUsuario)
        .eq('senha', senha) // Em produção, usaríamos hash, mas para o seu PDV atual isso funciona
        .single();

      if (error || !data) {
        toast.error('Usuário ou senha incorretos');
        setLoading(false);
        return;
      }

      // 2. Salva os dados do usuário no localStorage para manter a sessão
      // Isso "engana" o sistema para ele saber quem está logado sem precisar do Auth oficial
      localStorage.setItem('pdv_user_session', JSON.stringify(data));
      
      toast.success(`Bem-vindo, ${data.nome_completo}!`);
      
      // 3. Redireciona para o Dashboard
      navigate('/');
      window.location.reload(); // Recarrega para atualizar o menu com as permissões
      
    } catch (err) {
      toast.error('Erro ao processar login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Acesso ao Sistema</CardTitle>
          <CardDescription>Digite suas credenciais para entrar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="usuario">Usuário</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="usuario"
                  placeholder="Seu login" 
                  className="pl-10"
                  value={nomeUsuario}
                  onChange={(e) => setNomeUsuario(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••" 
                  className="pl-10"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Entrar no Sistema'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}