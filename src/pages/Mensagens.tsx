import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/contexts/AuthContext";
import { 
  Send, CheckCircle2, Circle, StickyNote, 
  ClipboardCheck, Trash2, AlertCircle, User, Palette, Users
} from 'lucide-react';

// Opções de cores para os cards
const CORES_DISPONIVEIS = [
  { id: 'padrao', bg: 'bg-[#141414]', border: 'border-white/5', nome: 'Padrão' },
  { id: 'urgente', bg: 'bg-red-500/10', border: 'border-red-500/30', nome: 'Urgente' },
  { id: 'sucesso', bg: 'bg-[#00e676]/10', border: 'border-[#00e676]/30', nome: 'Concluído' },
  { id: 'info', bg: 'bg-blue-500/10', border: 'border-blue-500/30', nome: 'Aviso' },
  { id: 'alerta', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', nome: 'Atenção' },
];

export default function Mensagens() {
  const { user } = useAuth();
  const [itens, setItens] = useState<any[]>([]);
  const [novoItem, setNovoItem] = useState('');
  const [tipo, setTipo] = useState<'mensagem' | 'tarefa'>('mensagem');
  const [prioridade, setPrioridade] = useState('media');
  
  // Agora o destinatário é um campo de texto manual
  const [destinatarioManual, setDestinatarioManual] = useState('');
  const [corSelecionada, setCorSelecionada] = useState(CORES_DISPONIVEIS[0]);

  // Captura o nome do autor logado com segurança (correção do erro 'Property nome does not exist')
  const nomeUsuario = (user as any)?.nome || (user as any)?.full_name || (user as any)?.email || 'Admin';

  useEffect(() => {
    buscarMural();
    
    const channel = supabase
      .channel('mural_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mural_comunicacao' }, () => {
        buscarMural();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function buscarMural() {
    const { data } = await supabase
      .from('mural_comunicacao')
      .select('*')
      .order('criado_em', { ascending: false });
    
    setItens(data || []);
  }

  async function enviarItem() {
    if (!novoItem.trim()) return;

    // Se o campo manual estiver vazio, define como 'Equipe' ou 'Todos'
    const finalDest = destinatarioManual.trim() || 'Todos';

    const { error } = await supabase.from('mural_comunicacao').insert([{
      autor: nomeUsuario, 
      destinatario: finalDest,
      conteudo: novoItem,
      tipo: tipo,
      prioridade: prioridade,
      cor: corSelecionada.id,
      concluida: false
    }]);

    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      setNovoItem('');
      setDestinatarioManual('');
      setCorSelecionada(CORES_DISPONIVEIS[0]);
      buscarMural();
    }
  }

  async function alternarTarefa(id: string, estadoAtual: boolean) {
    await supabase
      .from('mural_comunicacao')
      .update({ 
        concluida: !estadoAtual, 
        finalizada_por: nomeUsuario 
      })
      .eq('id', id);
    buscarMural();
  }

  async function excluirItem(id: string) {
    await supabase.from('mural_comunicacao').delete().eq('id', id);
    buscarMural();
  }

  const getEstiloCor = (corId: string) => {
    const cor = CORES_DISPONIVEIS.find(c => c.id === corId);
    return cor ? `${cor.bg} ${cor.border}` : 'bg-[#141414] border-white/5';
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">Central de Comunicação</h1>
        <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Poste avisos ou direcione tarefas para a equipe.</p>
      </header>

      {/* Box de Criação */}
      <div className={`border p-6 rounded-[32px] shadow-2xl transition-all duration-300 ${corSelecionada.bg} ${corSelecionada.border}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-3">
            <textarea 
              value={novoItem}
              onChange={(e) => setNovoItem(e.target.value)}
              placeholder="Descreva a tarefa ou o comunicado..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-white/20 transition-all resize-none h-24 text-white"
            />
          </div>
          
          <div className="space-y-3">
            {/* Input Manual de Destinatário */}
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input 
                type="text"
                value={destinatarioManual}
                onChange={(e) => setDestinatarioManual(e.target.value)}
                placeholder="Para: (Ex: João ou Todos)"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-[11px] font-bold uppercase text-white outline-none focus:border-[#00e676]"
              />
            </div>

            <select 
              value={tipo} 
              onChange={(e: any) => setTipo(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase text-white outline-none"
            >
              <option value="mensagem" className="bg-[#0a0a0a]">✉️ Recado</option>
              <option value="tarefa" className="bg-[#0a0a0a]">✅ Tarefa</option>
            </select>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-muted-foreground">Cor do Card:</span>
            <div className="flex gap-1.5 bg-black/20 p-1.5 rounded-xl border border-white/5">
              {CORES_DISPONIVEIS.map((cor) => (
                <button
                  key={cor.id}
                  onClick={() => setCorSelecionada(cor)}
                  className={`w-6 h-6 rounded-lg border transition-all ${cor.bg} ${cor.border} ${corSelecionada.id === cor.id ? 'scale-125 ring-2 ring-white/40' : 'opacity-40 hover:opacity-100'}`}
                />
              ))}
            </div>
          </div>

          <button 
            onClick={enviarItem}
            className="bg-[#00e676] text-black font-black px-8 py-3 rounded-2xl text-[11px] uppercase hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,230,118,0.2)] flex items-center gap-2"
          >
            Publicar Mural <Send className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coluna de Recados */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-2">
             <StickyNote className="h-4 w-4" /> Recados Recentes
          </h3>
          <div className="space-y-3">
            {itens.filter(i => i.tipo === 'mensagem').map((msg) => (
              <div key={msg.id} className={`p-5 rounded-3xl border transition-all relative group ${getEstiloCor(msg.cor)}`}>
                <button onClick={() => excluirItem(msg.id)} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-red-500/50 hover:text-red-500 transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 mb-3 text-[9px] font-black uppercase italic">
                  <span className="bg-white/10 px-2 py-1 rounded text-white">{msg.autor}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-[#00e676]">{msg.destinatario}</span>
                </div>
                <p className="text-sm text-white/90 leading-relaxed font-medium">{msg.conteudo}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Coluna de Tarefas */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-2">
            <ClipboardCheck className="h-4 w-4" /> Checklist da Equipe
          </h3>
          <div className="space-y-3">
            {itens.filter(i => i.tipo === 'tarefa').map((task) => (
              <div key={task.id} className={`p-5 rounded-3xl border flex gap-4 items-start transition-all ${task.concluida ? 'opacity-20 grayscale' : getEstiloCor(task.cor)}`}>
                <button onClick={() => alternarTarefa(task.id, task.concluida)} className="mt-1">
                  {task.concluida ? <CheckCircle2 className="h-6 w-6 text-[#00e676]" /> : <Circle className="h-6 w-6 text-white/10" />}
                </button>
                <div className="flex-1">
                  <p className={`text-sm font-bold uppercase tracking-tighter ${task.concluida ? 'line-through text-muted-foreground' : 'text-white'}`}>
                    {task.conteudo}
                  </p>
                  <div className="flex items-center gap-2 text-[8px] font-black uppercase text-muted-foreground mt-2 italic">
                    <span>De: {task.autor}</span> • <span>Para: {task.destinatario}</span>
                    {task.concluida && <span className="text-[#00e676] not-italic ml-2 tracking-normal">✓ CONCLUÍDO POR {task.finalizada_por}</span>}
                  </div>
                </div>
                <button onClick={() => excluirItem(task.id)} className="text-white/5 hover:text-red-500 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
