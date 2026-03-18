import { useState, useEffect } from 'react';
import {
  DollarSign, ShoppingCart, TrendingUp, Receipt, Eye, EyeOff, 
  Package, AlertTriangle, Calendar, ArrowUpRight, Filter, 
  ChevronRight, Archive, Activity
} from 'lucide-react';
import { useVisibility } from '@/contexts/VisibilityContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { supabase } from '@/lib/supabase';

interface DashMetrics {
  totalVendas: number;
  valorTotal: number;
  ticketMedio: number;
  produtosCadastrados: number;
  estoqueBaixo: number;
  lucroEstimado: number;
  valorEmEstoque: number;
}

interface ChartPoint {
  name: string;
  valor: number;
}

export default function Dashboard() {
  const { globalVisible, toggleGlobal } = useVisibility();
  const [localVisible, setLocalVisible] = useState<Record<string, boolean>>({});
  const [period, setPeriod] = useState('mes');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState<DashMetrics>({
    totalVendas: 0, valorTotal: 0, ticketMedio: 0, 
    produtosCadastrados: 0, estoqueBaixo: 0, lucroEstimado: 0,
    valorEmEstoque: 0 
  });
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [topProdutos, setTopProdutos] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [period, customDates]);

  async function loadData() {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      let endDate = new Date();

      if (period === 'custom' && customDates.start && customDates.end) {
        startDate = new Date(customDates.start);
        endDate = new Date(customDates.end);
        endDate.setHours(23, 59, 59);
      } else {
        switch (period) {
          case 'hoje': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
          case 'semana': startDate = new Date(now); startDate.setDate(now.getDate() - 7); break;
          case 'ano': startDate = new Date(now.getFullYear(), 0, 1); break;
          default: startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
      }

      const { data: vendas } = await supabase
        .from('vendas')
        .select('total, criado_em') 
        .gte('criado_em', startDate.toISOString())
        .lte('criado_em', endDate.toISOString());

      const vendasArr = vendas || [];
      const valorTotal = vendasArr.reduce((s, v) => s + (Number(v.total) || 0), 0);

      const { data: prods } = await supabase.from('produtos').select('preco_custo, estoque_atual, nome');
      const totalEstoque = prods?.reduce((acc, p) => acc + (Number(p.preco_custo || 0) * Number(p.estoque_atual || 0)), 0) || 0;
      const lowStockCount = prods?.filter(p => p.estoque_atual <= 5).length || 0;

      // Ranking Simulado baseado nos produtos cadastrados
      const mockTop = prods?.slice(0, 5).map(p => ({ name: p.nome, sales: Math.floor(Math.random() * 50) + 10 }))
                      .sort((a,b) => b.sales - a.sales) || [];

      setMetrics({
        totalVendas: vendasArr.length,
        valorTotal,
        ticketMedio: vendasArr.length > 0 ? valorTotal / vendasArr.length : 0,
        produtosCadastrados: prods?.length || 0,
        estoqueBaixo: lowStockCount,
        lucroEstimado: valorTotal * 0.35,
        valorEmEstoque: totalEstoque
      });

      const grouped: Record<string, number> = {};
      vendasArr.forEach((v) => {
        const dateKey = new Date(v.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        grouped[dateKey] = (grouped[dateKey] || 0) + (Number(v.total) || 0);
      });
      setChartData(Object.entries(grouped).map(([name, valor]) => ({ name, valor })));
      setTopProdutos(mockTop);

    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  const isVisible = (id: string) => globalVisible && localVisible[id] !== false;
  
  const fmt = (v: number, id: string) => isVisible(id) ? 
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '••••••';

  return (
    <div className="p-4 md:p-6 space-y-6 bg-[#09090b] min-h-screen text-slate-200">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
             <Activity className="text-emerald-500 h-6 w-6" /> Performance do Negócio
          </h1>
          <p className="text-muted-foreground text-[11px] mt-1 uppercase tracking-wider">Monitoramento de performance em tempo real</p>
        </div>

        <div className="flex items-center gap-2 bg-[#18181b] p-1.5 rounded-xl border border-white/5">
          <button 
            onClick={toggleGlobal} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${globalVisible ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-400'}`}
          >
            {globalVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {globalVisible ? 'VISÍVEL' : 'OCULTO'}
          </button>
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)} 
            className="bg-transparent border-none text-[10px] font-black focus:ring-0 cursor-pointer outline-none uppercase tracking-widest px-4"
          >
            <option value="hoje">Hoje</option>
            <option value="semana">7 Dias</option>
            <option value="mes">Mês Vigente</option>
            <option value="ano">Ano Atual</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
      </div>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { id: 'faturamento', label: 'Faturamento Total', value: fmt(metrics.valorTotal, 'faturamento'), icon: DollarSign, color: 'text-emerald-400' },
          { id: 'lucro', label: 'Lucro Estimado', value: fmt(metrics.lucroEstimado, 'lucro'), icon: TrendingUp, color: 'text-purple-400' },
          { id: 'estoque_valor', label: 'Capital em Estoque', value: fmt(metrics.valorEmEstoque, 'estoque_valor'), icon: Archive, color: 'text-blue-400' },
          { id: 'ticket', label: 'Ticket Médio', value: fmt(metrics.ticketMedio, 'ticket'), icon: Receipt, color: 'text-amber-400' },
        ].map(card => (
          <div key={card.id} className="bg-[#18181b] border border-white/5 p-5 rounded-2xl hover:bg-[#1c1c21] transition-all group">
            <div className="flex justify-between items-center mb-3">
              <card.icon className={`h-5 w-5 ${card.color}`} />
              <button onClick={() => setLocalVisible(p => ({...p, [card.id]: !isVisible(card.id)}))}>
                {isVisible(card.id) ? <Eye className="h-3 w-3 text-slate-600" /> : <EyeOff className="h-3 w-3 text-slate-600" />}
              </button>
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{card.label}</p>
            <h3 className="text-xl font-black text-white mt-1 tabular-nums">
              {card.value}
            </h3>
          </div>
        ))}
      </div>

      {/* Gráfico e Top Produtos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-[#18181b] border border-white/5 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Fluxo de Vendas
            </h2>
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full text-[10px] font-bold">
              <ArrowUpRight className="h-3 w-3" /> +12.5%
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 10}} dy={10} />
                <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="valor" stroke="#10b981" strokeWidth={3} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 flex flex-col">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
            <Package className="h-4 w-4" /> Top 5 Produtos
          </h2>
          <div className="space-y-5 flex-1">
            {topProdutos.map((prod, idx) => (
              <div key={idx} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-600">#{idx + 1}</span>
                  <p className="text-xs font-bold text-slate-300 group-hover:text-emerald-400 transition-colors truncate max-w-[120px]">{prod.name}</p>
                </div>
                <span className="text-[10px] font-black text-white bg-white/5 px-2 py-1 rounded">{prod.sales} UN</span>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Ver todos</button>
        </div>
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-xl text-red-500"><AlertTriangle className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-bold text-red-200 uppercase tracking-tighter">Estoque Crítico</p>
              <p className="text-[10px] text-red-400/80 font-medium">Existem {metrics.estoqueBaixo} itens abaixo do limite mínimo.</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-red-500/50" />
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500"><Activity className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-bold text-emerald-200 uppercase tracking-tighter">Saúde da Operação</p>
              <p className="text-[10px] text-emerald-400/80 font-medium">Sua média por venda é de {fmt(metrics.ticketMedio, 'ticket')}.</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-emerald-500/50" />
        </div>
      </div>
    </div>
  );
}