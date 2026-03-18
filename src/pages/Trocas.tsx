import { useState, useEffect } from 'react';
import { 
  RefreshCcw, Search, Plus, Trash2, Save, FileText, 
  ArrowRight, Printer, Filter, X, AlertTriangle 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ItemTroca {
  id?: string;
  produto_id?: string;
  nome: string;
  quantidade: number;
  valor: number;
}

export default function TrocasDevolucoes() {
  const { user } = useAuth();
  const [aba, setAba] = useState<'novo' | 'historico' | 'secundario'>('novo');
  const [tipo, setTipo] = useState<'troca' | 'devolucao' | 'estorno'>('troca');
  const [itens, setItens] = useState<ItemTroca[]>([]);
  const [buscaProd, setBuscaProd] = useState('');
  const [produtosSugestao, setProdutosSugestao] = useState<any[]>([]);
  
  const [clienteId, setClienteId] = useState('');
  const [clientes, setClientes] = useState<any[]>([]);
  const [motivo, setMotivo] = useState('');
  const [devolverEstoque, setDevolverEstoque] = useState(true);
  const [gerarCredito, setGerarCredito] = useState(false);
  const [loading, setLoading] = useState(false);

  const [historico, setHistorico] = useState<any[]>([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [estoqueSecundario, setEstoqueSecundario] = useState<any[]>([]);
  const [registroSelecionado, setRegistroSelecionado] = useState<any>(null);

  useEffect(() => {
    loadClientes();
    if (aba === 'historico') loadHistorico();
    if (aba === 'secundario') loadEstoqueSecundario();
  }, [aba]);

  async function loadClientes() {
    const { data } = await supabase.from('pessoas').select('id, nome').eq('categoria', 'cliente');
    setClientes(data || []);
  }

  async function loadHistorico() {
    setLoading(true);
    const { data } = await supabase.from('trocas_devolucoes').select('*').order('created_at', { ascending: false });
    setHistorico(data || []);
    setLoading(false);
  }

  async function loadEstoqueSecundario() {
    const { data } = await supabase.from('estoque_secundario').select('*, produtos(nome, codigo)');
    setEstoqueSecundario(data || []);
  }

  async function buscarProduto(term: string) {
    setBuscaProd(term);
    if (term.length < 2) { setProdutosSugestao([]); return; }
    const { data } = await supabase.from('produtos').select('id, nome, preco_venda').or(`nome.ilike.%${term}%,codigo.ilike.%${term}%`).limit(5);
    setProdutosSugestao(data || []);
  }

  const adicionarProduto = (p?: any) => {
    const novo: ItemTroca = p ? 
      { produto_id: p.id, nome: p.nome, valor: p.preco_venda, quantidade: 1 } : 
      { nome: '', valor: 0, quantidade: 1 };
    setItens([...itens, novo]);
    setBuscaProd('');
    setProdutosSugestao([]);
  };

  const totalGeral = itens.reduce((acc, item) => acc + (item.valor * item.quantidade), 0);

  async function salvarRegistro() {
    if (itens.length === 0) return toast.error("Adicione ao menos um produto");
    setLoading(true);
    try {
      const { data: registro, error: errReg } = await supabase.from('trocas_devolucoes').insert({
        tipo, cliente_id: clienteId || null, motivo, total_valor: totalGeral,
        devolver_estoque: devolverEstoque, credito_gerado: gerarCredito ? totalGeral : 0,
        usuario_id: user?.name || 'Sistema'
      }).select().single();

      if (errReg) throw errReg;

      const itensFormatados = itens.map(i => ({
        registro_id: registro.id, produto_id: i.produto_id || null,
        produto_nome: i.nome, quantidade: i.quantidade, valor_unitario: i.valor, total: i.valor * i.quantidade
      }));
      await supabase.from('trocas_itens').insert(itensFormatados);

      for (const item of itens) {
        if (item.produto_id) {
          if (devolverEstoque) {
            await supabase.rpc('increment_inventory', { row_id: item.produto_id, amt: item.quantidade });
          } else {
            await supabase.from('estoque_secundario').insert({ produto_id: item.produto_id, quantidade: item.quantidade, origem_registro_id: registro.id });
          }
        }
      }

      if (gerarCredito && clienteId) {
        const { data: cli } = await supabase.from('pessoas').select('credito').eq('id', clienteId).single();
        await supabase.from('pessoas').update({ credito: (cli?.credito || 0) + totalGeral }).eq('id', clienteId);
      }

      toast.success("Registrado com sucesso!");
      setItens([]); setMotivo(''); setAba('historico');
    } catch (error: any) { toast.error("Erro: " + error.message); }
    finally { setLoading(false); }
  }

  // FUNÇÃO DE EXCLUSÃO CORRIGIDA
  async function excluirRegistro(id: string) {
    if (!confirm("Atenção: A exclusão removerá o registro e as referências no estoque secundário. Deseja continuar?")) return;
    
    setLoading(true);
    try {
      // 1. Remove primeiro as referências no estoque secundário (evita o erro de Foreign Key)
      await supabase.from('estoque_secundario').delete().eq('origem_registro_id', id);
      
      // 2. Remove os itens da troca (cascateamento manual caso não esteja no banco)
      await supabase.from('trocas_itens').delete().eq('registro_id', id);

      // 3. Agora sim, remove o registro principal
      const { error } = await supabase.from('trocas_devolucoes').delete().eq('id', id);
      
      if (error) throw error;
      
      toast.success("Registro removido com sucesso!");
      loadHistorico();
      loadEstoqueSecundario();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function imprimirComprovante(registro: any) {
    const { data: itensReg } = await supabase.from('trocas_itens').select('*').eq('registro_id', registro.id);
    const janela = window.open('', '_blank');
    if (!janela) return;

    janela.document.write(`
      <html><body style="font-family:monospace;width:300px;padding:20px;">
        <h2 style="text-align:center;margin-bottom:5px;">COMPROVANTE</h2>
        <h3 style="text-align:center;margin-top:0;text-transform:uppercase;">${registro.tipo}</h3>
        <p>Data: ${new Date(registro.created_at).toLocaleDateString()}</p>
        <hr style="border:none;border-top:1px dashed #000;"/>
        ${itensReg?.map(i => `<p style="margin:5px 0;">${i.quantidade}x ${i.produto_nome}<br/>R$ ${Number(i.total).toFixed(2)}</p>`).join('')}
        <hr style="border:none;border-top:1px dashed #000;"/>
        <h3 style="text-align:right;">TOTAL: R$ ${Number(registro.total_valor).toFixed(2)}</h3>
        <p style="font-size:10px;text-align:center;margin-top:30px;">_______________________<br/>Assinatura do Cliente</p>
      </body></html>
    `);
    janela.document.close();
    janela.print();
  }

  async function retornarAoEstoqueNormal(item: any) {
    try {
      await supabase.rpc('increment_inventory', { row_id: item.produto_id, amt: item.quantidade });
      await supabase.from('estoque_secundario').delete().eq('id', item.id);
      toast.success("Produto retornou ao estoque principal");
      loadEstoqueSecundario();
    } catch (e) { toast.error("Erro ao processar retorno"); }
  }

  return (
    <div className="p-4 space-y-6 max-w-[1600px] mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <h1 className="text-xl font-bold flex items-center gap-2"><RefreshCcw className="text-primary h-5 w-5" /> Trocas e Devoluções</h1>
        <div className="flex bg-secondary/50 p-1 rounded-lg border border-border">
          <button onClick={() => setAba('novo')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${aba === 'novo' ? 'bg-background shadow-sm text-primary' : ''}`}>NOVO</button>
          <button onClick={() => setAba('historico')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${aba === 'historico' ? 'bg-background shadow-sm text-primary' : ''}`}>HISTÓRICO</button>
          <button onClick={() => setAba('secundario')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${aba === 'secundario' ? 'bg-background shadow-sm text-primary' : ''}`}>ESTOQUE SECUNDÁRIO</button>
        </div>
      </div>

      {aba === 'novo' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
            <div className="flex gap-6 mb-6 bg-secondary/30 p-4 rounded-lg">
              {['troca', 'devolucao', 'estorno'].map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer uppercase text-sm font-bold">
                  <input type="radio" checked={tipo === t} onChange={() => setTipo(t as any)} className="accent-primary" /> {t}
                </label>
              ))}
            </div>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Buscar produto..." value={buscaProd} onChange={(e) => buscarProduto(e.target.value)} className="w-full pl-10 h-12 rounded-lg border border-input bg-background outline-none" />
              {produtosSugestao.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
                  {produtosSugestao.map(p => (
                    <button key={p.id} onClick={() => adicionarProduto(p)} className="w-full px-4 py-3 text-left hover:bg-primary/10 flex justify-between border-b last:border-0">
                      <span className="font-medium">{p.nome}</span><span className="font-bold text-primary">R$ {p.preco_venda}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              {itens.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-4 bg-secondary/20 rounded-xl border border-border">
                  <input type="text" value={item.nome} onChange={(e) => { const n = [...itens]; n[idx].nome = e.target.value; setItens(n); }} className="flex-1 bg-transparent border-none text-sm font-bold focus:ring-0" />
                  <input type="number" value={item.quantidade} onChange={(e) => { const n = [...itens]; n[idx].quantidade = Number(e.target.value); setItens(n); }} className="w-16 bg-background border rounded px-2 py-1 text-center font-bold" />
                  <input type="number" value={item.valor} onChange={(e) => { const n = [...itens]; n[idx].valor = Number(e.target.value); setItens(n); }} className="w-24 bg-background border rounded px-2 py-1 text-right font-mono font-bold" />
                  <button onClick={() => setItens(itens.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button onClick={() => adicionarProduto()} className="w-full py-3 border-2 border-dashed rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-all"><Plus className="h-4 w-4" /> Inserir Item Manual</button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="w-full h-10 rounded-lg border bg-background text-sm font-medium">
              <option value="">Consumidor Manual</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full p-3 rounded-lg border bg-background text-sm" rows={3} placeholder="Motivo..." />
            <div className="space-y-3">
              <div onClick={() => setDevolverEstoque(!devolverEstoque)} className="flex items-center gap-3 p-4 rounded-xl border cursor-pointer bg-secondary/50">
                <div className={`w-10 h-6 rounded-full relative transition-colors ${devolverEstoque ? 'bg-primary' : 'bg-muted'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${devolverEstoque ? 'left-5' : 'left-1'}`} /></div>
                <span className="text-sm font-bold">Retornar ao estoque?</span>
              </div>
              <div onClick={() => setGerarCredito(!gerarCredito)} className="flex items-center gap-3 p-4 rounded-xl border cursor-pointer bg-secondary/50">
                <div className={`w-10 h-6 rounded-full relative transition-colors ${gerarCredito ? 'bg-primary' : 'bg-muted'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${gerarCredito ? 'left-5' : 'left-1'}`} /></div>
                <span className="text-sm font-bold">Gerar Crédito?</span>
              </div>
            </div>
            <div className="pt-6 border-t">
              <div className="flex justify-between items-center mb-6">
                <span className="text-sm font-bold text-muted-foreground uppercase">Total</span>
                <span className="text-2xl font-mono font-black text-primary">R$ {totalGeral.toFixed(2)}</span>
              </div>
              <button onClick={salvarRegistro} disabled={loading || itens.length === 0} className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"><Save className="h-5 w-5" /> CONFIRMAR</button>
            </div>
          </div>
        </div>
      )}

      {aba === 'historico' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-secondary/20 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="bg-transparent text-xs font-bold uppercase outline-none">
              <option value="todos">Todas Naturezas</option>
              <option value="troca">Trocas</option>
              <option value="devolucao">Devoluções</option>
              <option value="estorno">Estornos</option>
            </select>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 text-[10px] font-black uppercase">
              <tr>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Natureza</th>
                <th className="px-6 py-4">Valor Total</th>
                <th className="px-6 py-4">Estoque</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {historico.filter(h => filtroTipo === 'todos' || h.tipo === filtroTipo).map((h) => (
                <tr key={h.id} className="hover:bg-secondary/30 group transition-colors">
                  <td className="px-6 py-4 font-mono text-xs">{new Date(h.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-[10px] font-black uppercase bg-primary/10 text-primary">{h.tipo}</span></td>
                  <td className="px-6 py-4 font-bold text-primary">R$ {Number(h.total_valor).toFixed(2)}</td>
                  <td className="px-6 py-4 text-[10px] font-bold uppercase">
                    {h.devolver_estoque ? '✓ Reposto' : '⚠ Secundário'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => imprimirComprovante(h)} className="p-2 border rounded-lg hover:bg-background"><Printer className="h-4 w-4" /></button>
                      <button onClick={() => setRegistroSelecionado(h)} className="p-2 border rounded-lg hover:bg-background text-primary"><FileText className="h-4 w-4" /></button>
                      <button onClick={() => excluirRegistro(h.id)} className="p-2 border rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === 'secundario' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 bg-orange-500/10 border-b border-border">
            <p className="text-xs font-bold text-orange-600 uppercase flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Produtos em análise ou avaria (Fora de Venda)
            </p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 text-[10px] font-black uppercase">
              <tr>
                <th className="px-6 py-4">Cód</th>
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">Qtd</th>
                <th className="px-6 py-4">Data Entrada</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {estoqueSecundario.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">Estoque secundário vazio.</td></tr>
              )}
              {estoqueSecundario.map((item) => (
                <tr key={item.id} className="hover:bg-secondary/30">
                  <td className="px-6 py-4 font-mono text-xs">{item.produtos?.codigo}</td>
                  <td className="px-6 py-4 font-medium">{item.produtos?.nome}</td>
                  <td className="px-6 py-4 font-bold text-orange-500">{item.quantidade}</td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(item.data_entrada).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => retornarAoEstoqueNormal(item)}
                      className="text-[10px] font-bold uppercase bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 transition-all flex items-center gap-1 ml-auto"
                    >
                      <ArrowRight className="h-3 w-3" /> Voltar p/ Vendas
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE DETALHES */}
      {registroSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border w-full max-w-lg rounded-2xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold uppercase">Detalhes da {registroSelecionado.tipo}</h2>
              <button onClick={() => setRegistroSelecionado(null)}><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-secondary/30 rounded-xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Crédito Gerado</p>
                  <p className="text-sm font-bold text-primary font-mono">R$ {Number(registroSelecionado.credito_gerado).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Operador</p>
                  <p className="text-sm font-bold">{registroSelecionado.usuario_id}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-widest">Motivo</p>
                <div className="p-4 bg-secondary/10 border rounded-xl text-sm italic">
                  "{registroSelecionado.motivo || 'Nenhum motivo registrado.'}"
                </div>
              </div>
            </div>
            <button onClick={() => setRegistroSelecionado(null)} className="mt-8 w-full py-3 bg-primary text-white rounded-xl font-bold uppercase text-xs tracking-widest">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}