import { useState, useEffect } from 'react';
import { Search, X, Eye, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ValueDisplay } from '@/components/ValueDisplay';
import { useVisibility } from '@/contexts/VisibilityContext';

interface Venda {
  id: string;
  cliente_id: string;
  usuario_id: string;
  subtotal: number;
  desconto: number;
  custo_adicional: number;
  total: number;
  forma_pagamento_id: string;
  troco: number;
  observacao: string;
  criado_em: string;

  cliente_nome?: string;
  forma_nome?: string;
}

interface VendaItem {
  id: string;
  produto_nome: string;
  quantidade: number;
  preco: number;
  desconto: number;
  total: number;
}

export default function Vendas() {
  const { toggleGlobal } = useVisibility();

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedVenda, setSelectedVenda] = useState<Venda | null>(null);
  const [itens, setItens] = useState<VendaItem[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    let query = supabase
      .from('vendas')
      .select('*')
      .order('criado_em', { ascending: false });

    if (startDate) query = query.gte('criado_em', startDate);
    if (endDate) query = query.lte('criado_em', endDate + 'T23:59:59');

    const { data: vendasData, error } = await query;

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const { data: clientes } = await supabase
      .from('pessoas')
      .select('id, nome');

    const { data: formas } = await supabase
      .from('formas_pagamento')
      .select('id, nome');

    const mapped = (vendasData || []).map((v: any) => ({
      ...v,
      cliente_nome:
        clientes?.find(c => c.id === v.cliente_id)?.nome || 'Consumidor final',

      forma_nome:
        formas?.find(f => f.id === v.forma_pagamento_id)?.nome || 'Não informado',
    }));

    setVendas(mapped);
    setLoading(false);
  }

  useEffect(() => {
    if (startDate || endDate) load();
  }, [startDate, endDate]);

  async function openDetail(v: Venda) {
    setSelectedVenda(v);

    const { data } = await supabase
      .from('vendas_itens')
      .select('*')
      .eq('venda_id', v.id);

    setItens(data || []);
  }

  function imprimirVenda(venda: Venda, itens: VendaItem[]) {
    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Venda</title>
          <style>
            body { font-family: Arial; padding:20px }
            h2 { margin-bottom:10px }
            .linha { display:flex; justify-content:space-between; margin-bottom:5px }
            .total { margin-top:10px; font-size:18px; font-weight:bold }
          </style>
        </head>
        <body>
          <h2>Comprovante de Venda</h2>

          <p><b>Data:</b> ${new Date(venda.criado_em).toLocaleString('pt-BR')}</p>
          <p><b>Cliente:</b> ${venda.cliente_nome}</p>
          <p><b>Pagamento:</b> ${venda.forma_nome}</p>

          <hr/>

          ${itens.map(i => `
            <div class="linha">
              <span>${i.produto_nome} x${i.quantidade}</span>
              <span>R$ ${Number(i.total).toFixed(2)}</span>
            </div>
          `).join('')}

          <hr/>

          <div class="total">
            Total: R$ ${Number(venda.total).toFixed(2)}
          </div>

        </body>
      </html>
    `);

    win.document.close();
    win.print();
  }

  const filtered = vendas.filter((v) =>
    v.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
    v.forma_nome?.toLowerCase().includes(search.toLowerCase())
  );

  const totalVendas = filtered.reduce(
    (s, v) => s + (Number(v.total) || 0),
    0
  );

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">
          Histórico de Vendas
        </h1>

        <ValueDisplay
          id="total-vendas-hist"
          value={`R$ ${totalVendas.toFixed(2).replace('.', ',')}`}
          className="font-bold text-primary"
        />
      </div>

      {/* FILTROS */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-secondary text-foreground"
          />
        </div>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-secondary"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-secondary"
        />
      </div>

      {/* TABELA */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50 border-b border-border">
              <th className="p-3 text-left">Data</th>
              <th className="p-3 text-left">Cliente</th>
              <th className="p-3 text-left hidden md:table-cell">Pagamento</th>
              <th className="p-3 text-right">Valor</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((v) => (
              <tr
                key={v.id}
                onClick={() => openDetail(v)}
                className="border-b border-border hover:bg-accent/30 cursor-pointer"
              >
                <td className="p-3 text-xs">
                  {new Date(v.criado_em).toLocaleString('pt-BR')}
                </td>

                <td className="p-3">{v.cliente_nome}</td>

                <td className="p-3 hidden md:table-cell">
                  {v.forma_nome}
                </td>

                <td className="p-3 text-right">
                  <ValueDisplay
                    id={`venda-${v.id}`}
                    value={`R$ ${Number(v.total).toFixed(2).replace('.', ',')}`}
                    className="font-bold text-primary"
                    showToggle={false}
                  />
                </td>

                <td className="p-3 text-right flex justify-end gap-2">

                  {/* VER */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(v);
                    }}
                    className="p-1.5 rounded hover:bg-accent"
                  >
                    <Eye className="h-4 w-4" />
                  </button>

                  {/* IMPRIMIR */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();

                      const { data } = await supabase
                        .from('vendas_itens')
                        .select('*')
                        .eq('venda_id', v.id);

                      imprimirVenda(v, data || []);
                    }}
                    className="p-1.5 rounded hover:bg-accent"
                  >
                    <Printer className="h-4 w-4" />
                  </button>

                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {selectedVenda && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">

          <div className="bg-card p-6 rounded-lg w-full max-w-lg space-y-3">

            <div className="flex justify-between">
              <h2 className="font-bold">Detalhes</h2>

              <button onClick={() => setSelectedVenda(null)}>
                <X />
              </button>
            </div>

            <p>Cliente: {selectedVenda.cliente_nome}</p>
            <p>Pagamento: {selectedVenda.forma_nome}</p>

            <div>
              {itens.map(i => (
                <div key={i.id} className="flex justify-between">
                  <span>{i.produto_nome} x{i.quantidade}</span>
                  <span>R$ {i.total}</span>
                </div>
              ))}
            </div>

            <div className="font-bold text-lg">
              Total: R$ {selectedVenda.total}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}