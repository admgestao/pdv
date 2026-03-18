import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Minus, Trash2, ShoppingCart
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface CartItem {
  id: string;
  nome: string;
  codigo: string;
  price: number;
  quantity: number;
  stock: number;
}

interface Produto {
  id: string;
  nome: string;
  codigo: string;
  preco_venda: number;
  estoque_atual: number;
}

interface Pessoa {
  id: string;
  nome: string;
}

export default function Orcamentos() {

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [clienteNome, setClienteNome] = useState('');
  const [clienteObj, setClienteObj] = useState<Pessoa | null>(null);

  const [observacao, setObservacao] = useState('');
  const [valorExtra, setValorExtra] = useState(0);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Pessoa[]>([]);
  const [showResults, setShowResults] = useState(false);

  const [orcamentos, setOrcamentos] = useState<any[]>([]);

  // 🔥 LOAD INICIAL
  useEffect(() => {
    loadClientes();

    const saved = localStorage.getItem('orcamentos');
    if (saved) setOrcamentos(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('orcamentos', JSON.stringify(orcamentos));
  }, [orcamentos]);

  async function loadClientes() {
    const { data } = await supabase
      .from('pessoas')
      .select('id, nome')
      .eq('categoria', 'cliente');

    setClientes(data || []);
  }

  const searchProducts = useCallback(async (term: string) => {
    if (!term) { setProdutos([]); return; }

    const { data } = await supabase
      .from('produtos')
      .select('id, nome, codigo, preco_venda, estoque_atual')
      .or(`nome.ilike.%${term}%,codigo.ilike.%${term}%`)
      .limit(10);

    setProdutos(data || []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search) searchProducts(search);
    }, 300);

    return () => clearTimeout(t);
  }, [search]);

  function addToCart(p: Produto) {
    setCart(prev => {
      const exist = prev.find(i => i.id === p.id);

      if (exist) {
        return prev.map(i =>
          i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }

      return [
        ...prev,
        {
          id: p.id,
          nome: p.nome,
          codigo: p.codigo,
          price: Number(p.preco_venda),
          quantity: 1,
          stock: p.estoque_atual
        }
      ];
    });

    setSearch('');
    setShowResults(false);
  }

  function updateQty(id: string, delta: number) {
    setCart(prev =>
      prev
        .map(i => {
          if (i.id !== id) return i;
          const q = i.quantity + delta;
          if (q <= 0) return null;
          if (q > i.stock) {
            toast.error('Estoque insuficiente');
            return i;
          }
          return { ...i, quantity: q };
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(i => i.id !== id));
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal + valorExtra;

  function salvarOrcamento() {
    if (cart.length === 0) {
      toast.error('Adicione produtos');
      return;
    }

    const novo = {
      id: Date.now(),
      cliente: clienteNome || clienteObj?.nome || 'Consumidor final',
      itens: cart,
      total,
      observacao,
      valorExtra,
      criadoEm: new Date().toLocaleString(),
    };

    const updated = [novo, ...orcamentos];

    setOrcamentos(updated);
    localStorage.setItem('orcamentos', JSON.stringify(updated));

    // RESET
    setCart([]);
    setClienteNome('');
    setClienteObj(null);
    setObservacao('');
    setValorExtra(0);

    toast.success('Orçamento salvo!');
  }

  function excluirOrcamento(id: number) {
    const updated = orcamentos.filter(o => o.id !== id);
    setOrcamentos(updated);
    localStorage.setItem('orcamentos', JSON.stringify(updated));
  }

  function carregarOrcamento(orc: any) {
    setCart(orc.itens);
    setClienteNome(orc.cliente);
    setObservacao(orc.observacao);
    setValorExtra(orc.valorExtra || 0);

    toast.success('Orçamento carregado!');
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex">

      {/* ESQUERDA */}
      <div className="flex-1 flex flex-col border-r border-border">

        {/* BUSCA */}
        <div className="p-3 border-b border-border relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowResults(true);
            }}
            placeholder="Buscar produto..."
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-secondary text-foreground"
          />

          {showResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow z-50">
              {produtos.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="w-full text-left px-3 py-2 hover:bg-accent"
                >
                  {p.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CARRINHO */}
        <div className="flex-1 p-3 space-y-2 overflow-auto">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground mt-10">
              <ShoppingCart className="mx-auto opacity-30" />
              Carrinho vazio
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-card border rounded-lg p-3 flex justify-between">
                <div>
                  <p>{item.nome}</p>
                  <p className="text-sm">R$ {item.price}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.id, -1)}>
                    <Minus size={16}/>
                  </button>

                  {item.quantity}

                  <button onClick={() => updateQty(item.id, 1)}>
                    <Plus size={16}/>
                  </button>

                  <button onClick={() => removeItem(item.id)}>
                    <Trash2 size={16}/>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DIREITA */}
      <div className="w-80 p-4 space-y-3 bg-card">

        <input
          value={clienteNome}
          onChange={(e) => {
            setClienteNome(e.target.value);
            setClienteObj(null);
          }}
          placeholder="Nome do cliente"
          className="w-full h-9 px-3 rounded border bg-secondary"
        />

        <select
          value={clienteObj?.id || ''}
          onChange={(e) =>
            setClienteObj(clientes.find(c => c.id === e.target.value) || null)
          }
          className="w-full h-9 px-3 rounded border bg-secondary"
        >
          <option value="">Selecionar cliente</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        <input
          type="number"
          value={valorExtra}
          onChange={(e) => setValorExtra(Number(e.target.value))}
          placeholder="Valor extra"
          className="w-full h-9 px-3 rounded border bg-secondary"
        />

        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Observação"
          className="w-full px-3 py-2 rounded border bg-secondary"
        />

        <div className="text-xl font-bold">
          Total: R$ {total.toFixed(2)}
        </div>

        <button
          onClick={salvarOrcamento}
          className="w-full h-10 bg-primary text-white rounded"
        >
          Salvar Orçamento
        </button>

        {/* GRID */}
        <div className="border-t pt-3 space-y-2 max-h-60 overflow-auto">
          {orcamentos.map(o => (
            <div key={o.id} className="border rounded p-2">
              <p className="font-semibold">{o.cliente}</p>
              <p className="text-sm">R$ {o.total.toFixed(2)}</p>

              <div className="flex gap-2 mt-2">
                <button onClick={() => carregarOrcamento(o)}>Abrir</button>
                <button onClick={() => excluirOrcamento(o.id)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}