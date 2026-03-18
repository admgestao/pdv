import { useState, useEffect } from 'react';
import { 
  Wallet, Plus, Search, DollarSign, ArrowDownLeft, ArrowUpRight, 
  Lock, Calendar, User as UserIcon, Filter, X, ChevronRight, Activity 
} from 'lucide-react';
import { supabase, logAction } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ValueDisplay } from '@/components/ValueDisplay';
import { toast } from 'sonner';

interface Movimento {
  id: string;
  usuario_id: string;
  tipo: string;
  valor: number;
  descricao: string;
  criado_em: string;
}

export default function Caixa() {
  const { user } = useAuth();
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [tipo, setTipo] = useState('abertura');
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState('');

  const [filterUser, setFilterUser] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => { load(); }, [filterUser, dateRange]);

  async function load() {
    setLoading(true);
    try {
      let query = supabase
        .from('caixa_movimentos')
        .select('*')
        .order('criado_em', { ascending: false });

      if (dateRange.start) {
        query = query.gte('criado_em', `${dateRange.start}T00:00:00`);
      }
      if (dateRange.end) {
        query = query.lte('criado_em', `${dateRange.end}T23:59:59`);
      }
      if (filterUser) {
        query = query.ilike('usuario_id', `%${filterUser}%`);
      }

      const { data } = await query;
      setMovimentos(data || []);
    } catch (error) {
      console.error("Erro ao carregar caixa:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (valor <= 0 && tipo !== 'fechamento') { 
      toast.error('Informe um valor válido'); 
      return; 
    }

    // Registro automático apenas com o nome do usuário, conforme solicitado
    const payload = {
      tipo,
      valor: Number(valor) || 0,
      descricao: descricao || tipo,
      usuario_id: user?.name || 'Sistema', 
    };

    const { error } = await supabase.from('caixa_movimentos').insert(payload);
    
    if (error) { 
      toast.error('Erro ao registrar: ' + error.message); 
      return; 
    }

    await logAction(user?.name || 'Sistema', `caixa_${tipo}`, `Valor: R$ ${valor}`);
    toast.success(`${tipo.toUpperCase()} registrado com sucesso!`);
    
    setShowForm(false);
    setValor(0);
    setDescricao('');
    load();
  }

  const totalEntradas = movimentos
    .filter(m => ['abertura', 'entrada'].includes(m.tipo))
    .reduce((s, m) => s + Number(m.valor), 0);
    
  const totalSaidas = movimentos
    .filter(m => ['sangria', 'saida', 'fechamento'].includes(m.tipo))
    .reduce((s, m) => s + Number(m.valor), 0);
    
  const saldo = totalEntradas - totalSaidas;

  const iconMap: Record<string, any> = { 
    abertura: DollarSign, 
    sangria: ArrowDownLeft, 
    fechamento: Lock, 
    entrada: ArrowUpRight, 
    saida: ArrowDownLeft 
  };

  return (
    <div className="p-4 md:p-6 space-y-6 bg-[#09090b] min-h-screen text-slate-200">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
             <Wallet className="text-emerald-500 h-6 w-6" /> Fluxo de Caixa
          </h1>
          <p className="text-muted-foreground text-[11px] mt-1 uppercase tracking-wider">Gestão de entradas, saídas e conferência</p>
        </div>

        <button 
          onClick={() => setShowForm(true)} 
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-lg shadow-emerald-900/20"
        >
          <Plus className="h-4 w-4" /> NOVA MOVIMENTAÇÃO
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#18181b] border border-white/5 p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Entradas / Abertura</p>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </div>
          <ValueDisplay id="total-entradas" value={`R$ ${totalEntradas.toFixed(2)}`} className="text-xl font-black text-white" />
        </div>

        <div className="bg-[#18181b] border border-white/5 p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saídas / Sangrias</p>
            <ArrowDownLeft className="h-4 w-4 text-red-500" />
          </div>
          <ValueDisplay id="total-saidas" value={`R$ ${totalSaidas.toFixed(2)}`} className="text-xl font-black text-white" />
        </div>

        <div className={`bg-[#18181b] border p-5 rounded-2xl transition-colors ${saldo >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saldo em Caixa</p>
            <Activity className={`h-4 w-4 ${saldo >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
          </div>
          <ValueDisplay id="saldo-atual" value={`R$ ${saldo.toFixed(2)}`} className={`text-xl font-black ${saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
        </div>
      </div>

      <div className="bg-[#18181b] border border-white/5 p-4 rounded-2xl flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Período
          </label>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="bg-[#27272a] border-none rounded-lg text-xs p-2 text-white outline-none focus:ring-1 focus:ring-emerald-500" 
            />
            <span className="text-slate-600 text-xs font-bold">ATÉ</span>
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="bg-[#27272a] border-none rounded-lg text-xs p-2 text-white outline-none focus:ring-1 focus:ring-emerald-500" 
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <UserIcon className="h-3 w-3" /> Filtrar Usuário
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input 
              placeholder="Ex: Admin, João..." 
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full bg-[#27272a] border-none rounded-lg text-xs pl-9 pr-3 py-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <button 
          onClick={() => { setFilterUser(''); setDateRange({ start: '', end: '' }); }}
          className="bg-white/5 hover:bg-white/10 p-2.5 rounded-lg transition-colors"
          title="Limpar Filtros"
        >
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <div className="bg-[#18181b] border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {movimentos.map((m) => {
              const Icon = iconMap[m.tipo] || DollarSign;
              const isEntry = ['abertura', 'entrada'].includes(m.tipo);
              
              return (
                <div key={m.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                      isEntry ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-tight text-white">{m.tipo}</span>
                        {m.descricao && m.descricao !== m.tipo && (
                          <span className="text-[10px] text-slate-500 font-medium">— {m.descricao}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-emerald-500/80">{m.usuario_id}</span>
                        <span className="text-[10px] text-slate-600">•</span>
                        <span className="text-[10px] text-slate-600 font-mono">
                          {new Date(m.criado_em).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-black tabular-nums ${isEntry ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isEntry ? '+' : '-'} {Number(m.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              );
            })}
            {movimentos.length === 0 && (
              <div className="p-20 text-center">
                <Wallet className="h-12 w-12 text-slate-800 mx-auto mb-4" />
                <p className="text-slate-500 text-sm font-medium">Nenhum registro encontrado para este filtro.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-[#18181b] border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tighter">
                <Plus className="text-emerald-500 h-5 w-5" /> Novo Registro
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setTipo('abertura')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${tipo === 'abertura' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}
                >Abertura</button>
                <button 
                  onClick={() => setTipo('sangria')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${tipo === 'sangria' ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}
                >Sangria</button>
                <button 
                  onClick={() => setTipo('entrada')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${tipo === 'entrada' ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}
                >Entrada</button>
                <button 
                  onClick={() => setTipo('saida')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${tipo === 'saida' ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}
                >Saída</button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Valor do Lançamento</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-emerald-500 font-bold text-sm">R$</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={valor || ''} 
                    onChange={(e) => setValor(Number(e.target.value))}
                    placeholder="0,00"
                    className="w-full bg-[#27272a] border-none rounded-2xl py-3 pl-10 pr-4 text-white font-black text-lg outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Descrição / Observação</label>
                <input 
                  value={descricao} 
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Troco inicial, Pagamento fornecedor..."
                  className="w-full bg-[#27272a] border-none rounded-2xl py-3 px-4 text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" 
                />
              </div>

              <div className="pt-4 grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowForm(false)}
                  className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-black uppercase transition-all"
                >Descartar</button>
                <button 
                  onClick={handleSave}
                  className="py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase transition-all shadow-lg shadow-emerald-900/40"
                >Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}