import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, User, Percent, DollarSign,
  FileText, CreditCard, X, Check, AlertCircle, Wallet
} from 'lucide-react';
import { supabase, logAction } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CartItem {
  id: string;
  nome: string;
  codigo: string;
  price: number;
  preco_custo: number; // Adicionado para cálculo de lucro
  quantity: number;
  stock: number;
  discount: number;
  discountType: 'percent' | 'fixed';
}

interface Produto {
  id: string;
  nome: string;
  codigo: string;
  preco_venda: number;
  preco_custo: number; // Adicionado para consulta
  estoque_atual: number;
}

interface Pessoa {
  id: string;
  nome: string;
  credito: number;
  limite_compra: number;
  limite_usado: number;
  observacoes?: string;
}

interface FormaPagamento {
  id: string;
  nome: string;
}

export default function PDV() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clienteManual, setClienteManual] = useState('');
  const [clienteObj, setClienteObj] = useState<Pessoa | null>(null);
  const [observacao, setObservacao] = useState('');
  const [custoAdicional, setCustoAdicional] = useState(0);
  const [descCusto, setDescCusto] = useState('');
  const [custoNoLucro, setCustoNoLucro] = useState(true);
  const [descontoGeral, setDescontoGeral] = useState(0);
  const [descontoGeralTipo, setDescontoGeralTipo] = useState<'percent' | 'fixed'>('percent');
  const [showResults, setShowResults] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Pessoa[]>([]);
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [showFinalize, setShowFinalize] = useState(false);
  const [valorRecebido, setValorRecebido] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [promocoes, setPromocoes] = useState<Record<string, number>>({});
  const [usarCredito, setUsarCredito] = useState(false);

  useEffect(() => {
    loadFormas();
    loadClientes();
    loadPromocoes();
  }, []);

  async function loadFormas() {
    const { data } = await supabase.from('formas_pagamento').select('id, nome').eq('ativo', true);
    setFormas(data || []);
  }

  async function loadClientes() {
    const { data } = await supabase.from('pessoas').select('*').eq('categoria', 'cliente');
    setClientes(data || []);
  }

  async function loadPromocoes() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('promocoes').select('produto_id, preco_promocional')
      .lte('data_inicio', today).gte('data_fim', today);
    const map: Record<string, number> = {};
    (data || []).forEach(p => { map[p.produto_id] = Number(p.preco_promocional); });
    setPromocoes(map);
  }

  const searchProducts = useCallback(async (term: string) => {
    if (!term) { setProdutos([]); return; }
    // Adicionado preco_custo na busca para levar ao carrinho
    const { data } = await supabase.from('produtos').select('id, nome, codigo, preco_venda, preco_custo, estoque_atual')
      .or(`nome.ilike.%${term}%,codigo.ilike.%${term}%`).limit(10);
    setProdutos(data || []);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (search) searchProducts(search); }, 300);
    return () => clearTimeout(timer);
  }, [search, searchProducts]);

  const addToCart = (product: Produto) => {
    if (product.estoque_atual <= 0) {
      toast.error('Produto sem estoque disponível');
      return;
    }
    
    const promoPrice = promocoes[product.id];
    const price = promoPrice || Number(product.preco_venda);
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (existing.quantity >= product.estoque_atual) {
          toast.error('Limite de estoque atingido');
          return prev;
        }
        return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: product.id, nome: product.nome, codigo: product.codigo,
        price, preco_custo: product.preco_custo || 0, quantity: 1, stock: product.estoque_atual,
        discount: 0, discountType: 'percent' as const,
      }];
    });
    setSearch('');
    setShowResults(false);
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const newQty = i.quantity + delta;
        if (newQty <= 0) return null as any;
        if (newQty > i.stock) {
          toast.error('Estoque insuficiente');
          return i;
        }
        return { ...i, quantity: newQty };
      }).filter(Boolean)
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItemDiscount = (id: string, value: number, type: 'percent' | 'fixed') => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, discount: value, discountType: type } : i));
  };

  const getItemTotal = (item: CartItem) => {
    const base = item.price * item.quantity;
    if (item.discount <= 0) return base;
    if (item.discountType === 'percent') return base * (1 - item.discount / 100);
    return Math.max(0, base - item.discount);
  };

  // Cálculos de Totais e Lucro
  const subtotal = cart.reduce((sum, item) => sum + getItemTotal(item), 0);
  const totalCustoItens = cart.reduce((sum, item) => sum + (item.preco_custo * item.quantity), 0);
  const descontoGeralVal = descontoGeralTipo === 'percent' ? subtotal * (descontoGeral / 100) : descontoGeral;
  const totalBruto = Math.max(0, subtotal - descontoGeralVal + custoAdicional);
  const creditoDisponivel = clienteObj?.credito || 0;
  const valorAbatidoCredito = usarCredito ? Math.min(totalBruto, creditoDisponivel) : 0;
  const total = totalBruto - valorAbatidoCredito;
  const troco = valorRecebido > total ? valorRecebido - total : 0;
  
  // Lucro: Total da venda menos o custo dos produtos e custo adicional (se marcado)
  const lucroLiquido = total - totalCustoItens - (custoNoLucro ? custoAdicional : 0);

  const selectedForma = formas.find(f => f.id === formaPagamentoId);

  function selectCliente(id: string) {
    const c = clientes.find(x => x.id === id);
    if (c) {
      setClienteObj(c);
      setClienteManual('');
      setUsarCredito(false);
      if (c.limite_compra > 0 && Number(c.limite_usado) >= c.limite_compra) {
        toast.warning(`Atenção: ${c.nome} atingiu o limite de compras`);
      }
    } else {
      setClienteObj(null);
    }
  }

  async function finalizeSale() {
    if (cart.length === 0) return;
    if (!formaPagamentoId) { toast.error('Selecione a forma de pagamento'); return; }
    setSaving(true);

    try {
      // 1. REGISTRAR A VENDA (COM CAMPOS DE CUSTO/LUCRO)
      const { data: venda, error: vendaErr } = await supabase.from('vendas').insert({
        cliente_id: clienteObj?.id || null,
        cliente_nome_manual: clienteObj ? null : clienteManual,
        usuario_id: user?.id || user?.name || '',
        subtotal,
        desconto: descontoGeralVal,
        custo_adicional: custoAdicional,
        total,
        total_custo: totalCustoItens, // Implementação Relatório
        lucro_liquido: lucroLiquido, // Implementação Relatório
        valor_credito_usado: valorAbatidoCredito,
        forma_pagamento_id: formaPagamentoId,
        troco,
        observacao,
      }).select('id').single();

      if (vendaErr) throw vendaErr;

      const items = cart.map(item => ({
        venda_id: venda.id,
        produto_id: item.id,
        produto_nome: item.nome,
        quantidade: item.quantity,
        preco: item.price,
        desconto: item.discount,
        total: getItemTotal(item),
      }));
      await supabase.from('vendas_itens').insert(items);

      if (usarCredito && clienteObj && valorAbatidoCredito > 0) {
        await supabase.from('pessoas')
          .update({ credito: clienteObj.credito - valorAbatidoCredito })
          .eq('id', clienteObj.id);
      }

      // 2. PROCESSAR ITENS (ESTOQUE E MOVIMENTAÇÃO)
      for (const item of cart) {
        // Baixa no estoque principal
        await supabase.from('produtos')
          .update({ estoque_atual: item.stock - item.quantity })
          .eq('id', item.id);

        // Registro detalhado para Relatório de Estoque
        await supabase.from('movimentacao_estoque').insert({
          produto_id: item.id,
          tipo: 'saida',
          quantidade: item.quantity,
          valor_unitario: item.price,
          referencia: `Venda #${venda.id.slice(0, 8)}`,
          motivo: 'Venda PDV',
          usuario_nome: user?.name || 'Operador'
        });
      }

      // 3. REGISTRAR ENTRADA NO CAIXA (Para Relatório de Fechamento)
      await supabase.from('caixa_movimentacoes').insert({
        tipo: 'entrada',
        valor: total,
        descricao: `Venda #${venda.id.slice(0, 8)}${clienteObj ? ' - ' + clienteObj.nome : ''}`,
        categoria: 'Venda de Produtos',
        usuario_nome: user?.name || 'Operador'
      });

      await logAction(user?.name || '', 'finalizar_venda', `Venda #${venda.id.slice(0, 8)} - R$ ${total.toFixed(2)}`);

      setShowSuccess(true);
      setShowFinalize(false);

      setTimeout(() => {
        setCart([]);
        setClienteManual('');
        setClienteObj(null);
        setObservacao('');
        setCustoAdicional(0);
        setDescCusto('');
        setDescontoGeral(0);
        setFormaPagamentoId('');
        setValorRecebido(0);
        setUsarCredito(false);
        setShowSuccess(false);
      }, 2000);
    } catch (err: any) {
      toast.error('Erro ao finalizar venda: ' + err.message);
    }
    setSaving(false);
  }

  // --- O RESTANTE DO JSX PERMANECE EXATAMENTE IGUAL ---
  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col lg:flex-row animate-fade-in">
      {/* Esquerda: Carrinho */}
      <div className="flex-1 flex flex-col border-r border-border min-w-0">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setShowResults(e.target.value.length > 0); }}
              onFocus={() => search.length > 0 && setShowResults(true)}
              placeholder="Buscar produto por nome ou código..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            {showResults && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-xl z-50 max-h-60 overflow-auto">
                {produtos.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado</p>
                ) : (
                  produtos.map((p) => (
                    <button key={p.id} onClick={() => addToCart(p)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-accent/50 text-left transition-colors border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">Cód: {p.codigo} • Estoque: {p.estoque_atual}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-mono font-semibold text-primary">R$ {Number(p.preco_venda).toFixed(2).replace('.', ',')}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-30">
              <ShoppingCart className="h-12 w-12 mb-3" />
              <p className="text-sm">Carrinho vazio</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-card p-3 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      Estoque: <span className={item.stock - item.quantity <= 2 ? 'text-red-500 font-bold' : ''}>{item.stock - item.quantity}</span> restantes
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-lg border border-border">
                    <Percent className="h-3 w-3 text-muted-foreground ml-1" />
                    <input type="number" value={item.discount || ''} placeholder="0"
                      onChange={(e) => updateItemDiscount(item.id, Number(e.target.value), item.discountType)}
                      className="w-12 bg-transparent text-xs font-mono focus:outline-none" />
                    <select value={item.discountType} onChange={(e) => updateItemDiscount(item.id, item.discount, e.target.value as any)}
                      className="bg-transparent text-[10px] uppercase font-bold text-muted-foreground border-none focus:ring-0 p-0">
                      <option value="percent">%</option>
                      <option value="fixed">$</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-border bg-secondary">
                      <button onClick={() => updateQty(item.id, -1)} className="h-8 w-8 flex items-center justify-center hover:bg-background transition-colors rounded-l-lg"><Minus className="h-3 w-3" /></button>
                      <span className="h-8 w-10 flex items-center justify-center text-sm font-mono font-semibold border-x border-border">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} disabled={item.quantity >= item.stock}
                        className="h-8 w-8 flex items-center justify-center hover:bg-background transition-colors rounded-r-lg disabled:opacity-30"><Plus className="h-3 w-3" /></button>
                    </div>
                    <span className="text-sm font-mono font-bold text-foreground w-24 text-right">R$ {getItemTotal(item).toFixed(2).replace('.', ',')}</span>
                    <button onClick={() => removeItem(item.id)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="w-full lg:w-80 xl:w-96 flex flex-col border-t lg:border-t-0 border-border bg-card/50">
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><User className="h-3 w-3" /> Cliente</label>
            <select value={clienteObj?.id || ''} onChange={(e) => selectCliente(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-input bg-secondary text-foreground text-sm">
              <option value="">-- Buscar no cadastro --</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            
            {!clienteObj && (
              <input type="text" value={clienteManual} onChange={(e) => setClienteManual(e.target.value)} 
                placeholder="Ou nome manual..."
                className="w-full h-9 px-3 rounded-lg border border-input bg-secondary text-foreground text-sm mt-2" />
            )}

            {clienteObj?.observacoes && (
              <div className="mt-2 p-2 rounded border border-yellow-500/50 bg-yellow-500/10 flex gap-2 animate-pulse">
                <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                <p className="text-xs text-yellow-200 font-medium">{clienteObj.observacoes}</p>
              </div>
            )}

            {clienteObj && clienteObj.credito > 0 && (
              <div className={`mt-2 p-3 rounded-lg border transition-all ${usarCredito ? 'border-primary bg-primary/5' : 'border-border bg-secondary/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Crédito</p>
                      <p className="text-sm font-bold text-primary">R$ {clienteObj.credito.toFixed(2)}</p>
                    </div>
                  </div>
                  <button onClick={() => setUsarCredito(!usarCredito)}
                    className={`h-7 px-3 rounded-md text-[10px] font-bold uppercase transition ${usarCredito ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    {usarCredito ? 'Usando' : 'Usar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Percent className="h-3 w-3" /> Desconto Geral</label>
            <div className="flex gap-2">
              <input type="number" min={0} value={descontoGeral || ''} onChange={(e) => setDescontoGeral(Number(e.target.value))}
                className="flex-1 h-9 px-3 rounded-lg border border-input bg-secondary text-foreground text-sm font-mono focus:outline-none" />
              <select value={descontoGeralTipo} onChange={(e) => setDescontoGeralTipo(e.target.value as any)}
                className="h-9 px-2 rounded-lg border border-input bg-secondary text-foreground text-sm">
                <option value="percent">%</option>
                <option value="fixed">R$</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> Custo Adicional</label>
            <input type="number" value={custoAdicional || ''} onChange={(e) => setCustoAdicional(Number(e.target.value))}
              className="w-full h-9 px-3 rounded-lg border border-input bg-secondary text-foreground text-sm font-mono" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><FileText className="h-3 w-3" /> Observação</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Notas da venda..." rows={2}
              className="w-full px-3 py-2 rounded-lg border border-input bg-secondary text-foreground text-sm resize-none" />
          </div>
        </div>

        <div className="border-t border-border p-4 space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            {valorAbatidoCredito > 0 && (
              <div className="flex justify-between text-primary font-medium">
                <span>Crédito Aplicado</span>
                <span className="font-mono">- R$ {valorAbatidoCredito.toFixed(2).replace('.', ',')}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-base font-bold">Total</span>
            <span className="text-xl font-bold font-mono text-primary">R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setCart([]); setClienteObj(null); setClienteManual(''); setUsarCredito(false); }}
              className="h-10 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition flex items-center justify-center gap-1.5">
              <X className="h-3.5 w-3.5" /> Limpar
            </button>
            <button disabled={cart.length === 0} onClick={() => setShowFinalize(true)}
              className="h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-30 flex items-center justify-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Finalizar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Finalização */}
      {showFinalize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold">Finalizar Venda</h2>
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground">Forma de Pagamento *</label>
              <select value={formaPagamentoId} onChange={(e) => setFormaPagamentoId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-input bg-secondary text-sm">
                <option value="">Selecione...</option>
                {formas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>

              {selectedForma?.nome?.toLowerCase().includes('dinheiro') && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Recebido (R$)</label>
                  <input type="number" value={valorRecebido || ''} onChange={(e) => setValorRecebido(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-secondary font-mono text-sm" />
                </div>
              )}

              <div className="p-3 rounded-lg bg-secondary border border-border space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground uppercase">
                  <span>Total Bruto</span>
                  <span className="font-mono">R$ {totalBruto.toFixed(2)}</span>
                </div>
                {valorAbatidoCredito > 0 && (
                  <div className="flex justify-between text-[10px] text-primary uppercase font-bold">
                    <span>Abatido (Crédito)</span>
                    <span className="font-mono">- R$ {valorAbatidoCredito.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-border/50">
                  <span>Saldo a Receber</span>
                  <span className="font-mono text-primary">R$ {total.toFixed(2)}</span>
                </div>
              </div>

              {troco > 0 && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Troco</p>
                  <p className="text-lg font-bold font-mono text-primary">R$ {troco.toFixed(2).replace('.', ',')}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFinalize(false)} className="h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
              <button onClick={finalizeSale} disabled={saving}
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50">
                <Check className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-xl bg-card border border-primary p-8 text-center shadow-xl animate-in zoom-in-95">
            <Check className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-1">Venda Finalizada!</h2>
            <p className="text-sm text-muted-foreground">Estoque e crédito atualizados.</p>
          </div>
        </div>
      )}
    </div>
  );
}