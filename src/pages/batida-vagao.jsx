import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/BatidaVagao.module.css';

const COCHO_NOTES = [
  { nota: 0, label: 'Nota 0', desc: 'Cocho zerado',    cor: '#c62828', bgCor: '#ffebee', sinal: +1 },
  { nota: 1, label: 'Nota 1', desc: 'Resíduo ideal',   cor: '#2e7d32', bgCor: '#e8f5e9', sinal:  0 },
  { nota: 2, label: 'Nota 2', desc: 'Sobra moderada',  cor: '#e65100', bgCor: '#fff3e0', sinal: -1 },
  { nota: 3, label: 'Nota 3', desc: 'Sobra excessiva', cor: '#6a1b9a', bgCor: '#f3e5f5', sinal: -2 },
];

const TOLERANCIA_PCT = 10; // % máximo sem alerta

// ── Formatação BR ────────────────────────────────────────────
const fmtKg  = (v) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg' : '—';
const fmtN   = (v, d = 2) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fmtPct = (v) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '—';

function TabelaIngredientes({ ings }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
      <thead>
        <tr style={{ background: '#f5f5f5' }}>
          {['Ingrediente', 'Proporção', 'Qtd MN', 'Qtd MS'].map(h => (
            <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #ddd' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ings.map((ing, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
            <td style={{ padding: '7px 10px' }}>{ing.nome}</td>
            <td style={{ padding: '7px 10px' }}>{fmtN(parseFloat(ing.propPct), 3)}%</td>
            <td style={{ padding: '7px 10px' }}><strong>{fmtKg(ing.qtdMN)}</strong></td>
            <td style={{ padding: '7px 10px', color: '#1565c0' }}>{ing.qtdMS != null ? fmtKg(ing.qtdMS) : '—'}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ background: '#e8f5e9', borderTop: '2px solid #c8e6c9' }}>
          <td colSpan={2} style={{ padding: '8px 10px', fontWeight: 700 }}>TOTAL</td>
          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{fmtKg(ings.reduce((a, i) => a + i.qtdMN, 0))}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  );
}

// ── Componente: Badge de Realizado ───────────────────────────
function BadgeRealizado({ batida, onSalvar }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor]       = useState('');

  const temRealizado = batida.qty_realizada_kg != null;
  const previsto     = Number(batida.total_qty_kg);
  const realizado    = Number(batida.qty_realizada_kg);
  const delta        = temRealizado ? realizado - previsto : null;
  const deltaPct     = temRealizado && previsto > 0 ? (delta / previsto) * 100 : null;

  const handleSalvar = async () => {
    const v = parseFloat(valor.replace(',', '.'));
    if (!v || v <= 0) return alert('Informe um peso válido.');
    const diffPct = Math.abs(((v - previsto) / previsto) * 100);
    if (diffPct > TOLERANCIA_PCT) {
      const ok = confirm(
        `⚠️ Atenção: o peso realizado (${fmtKg(v)}) difere ${fmtPct(diffPct)} do previsto (${fmtKg(previsto)}).\n` +
        `Diferença: ${v > previsto ? '+' : ''}${fmtKg(v - previsto)}\n\nDeseja confirmar mesmo assim?`
      );
      if (!ok) return;
    }
    await onSalvar(batida.id, v);
    setEditando(false);
    setValor('');
  };

  if (editando) {
    return (
      <div className={styles.realizadoEdit}>
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          placeholder={fmtN(previsto, 2)}
          onChange={e => setValor(e.target.value)}
          className={styles.inputRealizado}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSalvar(); if (e.key === 'Escape') setEditando(false); }}
        />
        <button className={styles.btnSalvarRealizado} onClick={handleSalvar}>✓</button>
        <button className={styles.btnCancelarRealizado} onClick={() => setEditando(false)}>✕</button>
      </div>
    );
  }

  if (temRealizado) {
    const corDelta = delta > 0 ? '#e65100' : delta < 0 ? '#1565c0' : '#2e7d32';
    return (
      <div className={styles.realizadoBadge} onClick={() => { setValor(fmtN(realizado, 2).replace(' kg', '')); setEditando(true); }}>
        <span className={styles.realizadoValor}>✅ {fmtKg(realizado)}</span>
        {delta !== 0 && (
          <span style={{ color: corDelta, fontSize: '0.72rem', fontWeight: 600 }}>
            {delta > 0 ? '+' : ''}{fmtKg(delta)} ({delta > 0 ? '+' : ''}{fmtPct(deltaPct)})
          </span>
        )}
        {delta === 0 && <span style={{ color: '#2e7d32', fontSize: '0.72rem' }}>= previsto</span>}
      </div>
    );
  }

  return (
    <button className={styles.btnLancarRealizado} onClick={() => { setValor(''); setEditando(true); }}>
      ⏳ Lançar Realizado
    </button>
  );
}

export default function BatidaVagao() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canDelete } = usePermissions();

  const hoje = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [aba, setAba]               = useState('individual');
  const [batidas, setBatidas]       = useState([]);
  const [lotes, setLotes]           = useState([]);
  const [racoes, setRacoes]         = useState([]);
  const [pesagens, setPesagens]     = useState([]);
  const [compositions, setCompositions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [salvando, setSalvando]     = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [filtroData, setFiltroData] = useState(hoje);
  const [filtroLote, setFiltroLote] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showPrint, setShowPrint]   = useState(false);

  const [form, setForm] = useState({
    lot_id: '', feed_type_id: '', batch_date: hoje,
    batch_type: 'feeding', feeding_order: 1,
    total_qty_kg: '', cocho_note: null, notes: '',
  });

  const [loteData, setLoteData]     = useState(hoje);
  const [loteTipo, setLoteTipo]     = useState('feeding');
  const [loteOrdem, setLoteOrdem]   = useState(1);
  const [loteLinhas, setLoteLinhas] = useState({});

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    if (!authLoading && currentFarm) loadDados();
  }, [authLoading, user, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [
        { data: batidasData },
        { data: lotesData },
        { data: racoesData },
        { data: pesagensData },
        { data: compData },
      ] = await Promise.all([
        supabase.from('wagon_batches').select('*').eq('farm_id', currentFarm.id)
          .order('batch_date', { ascending: false }).order('feeding_order', { ascending: true }),
        supabase.from('lots')
          .select('id, lot_code, pen_id, head_count, avg_entry_weight, entry_date, target_gmd, carcass_yield_pct, daily_feeding_count, lot_phases(id, phase_name, start_date, end_date, feed_types(id, name))')
          .eq('farm_id', currentFarm.id).eq('status', 'active').order('lot_code'),
        supabase.from('feed_types').select('id, name, cost_per_kg, dry_matter_pct').eq('farm_id', currentFarm.id).order('name'),
        supabase.from('lot_weighings').select('id, lot_id, weighing_date, avg_weight_kg').eq('farm_id', currentFarm.id).order('weighing_date', { ascending: false }),
        supabase.from('feed_compositions')
          .select('*, feed_composition_items(*, feed_ingredients(id, name, unit, dry_matter_pct))')
          .eq('farm_id', currentFarm.id).eq('is_current', true),
      ]);
      setBatidas(batidasData || []);
      setLotes(lotesData || []);
      setRacoes(racoesData || []);
      setPesagens(pesagensData || []);
      setCompositions(compData || []);
    } catch (e) {
      alert('Erro ao carregar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers de cálculo ───────────────────────────────────────
  const calcMNBase = (lote, racao, dataRef) => {
    if (!lote || !racao) return null;
    const msPvPct    = parseFloat(lote.carcass_yield_pct);
    const msDietaPct = parseFloat(racao.dry_matter_pct);
    const gmd        = parseFloat(lote.target_gmd) || 0;
    const headCount  = parseInt(lote.head_count) || 0;
    if (!msPvPct || !msDietaPct || !headCount) return null;
    const pesagensLote = pesagens
      .filter(p => p.lot_id === lote.id && p.weighing_date <= dataRef)
      .sort((a, b) => b.weighing_date.localeCompare(a.weighing_date));
    let pesoBase, dataBase;
    if (pesagensLote.length > 0) { pesoBase = parseFloat(pesagensLote[0].avg_weight_kg); dataBase = pesagensLote[0].weighing_date; }
    else { pesoBase = parseFloat(lote.avg_entry_weight) || 0; dataBase = lote.entry_date; }
    if (!pesoBase || !dataBase) return null;
    const dias         = Math.max(0, Math.floor((new Date(dataRef) - new Date(dataBase)) / 86400000));
    const pesoEstimado = pesoBase + (dias * gmd);
    const msCab        = pesoEstimado * (msPvPct / 100);
    const mnCab        = msCab / (msDietaPct / 100);
    const mnTotalDia   = mnCab * headCount;
    return { pesoEstimado, msCab, mnCab, mnTotalDia, dias, headCount };
  };

  const calcAjusteCocho = (nota, headCount) => {
    const entry = COCHO_NOTES.find(n => n.nota === nota);
    if (!entry || entry.sinal === 0) return 0;
    return entry.sinal * 0.450 * headCount;
  };

  const detectarProximoTrato = (lotId, data) => {
    if (!lotId || !data) return 1;
    const ex = batidas.filter(b => b.lot_id === lotId && b.batch_date === data && b.batch_type === 'feeding');
    if (!ex.length) return 1;
    return Math.max(...ex.map(b => b.feeding_order || 1)) + 1;
  };

  const calcIngredientes = (feedTypeId, totalKg) => {
    const comp = compositions.find(c => c.feed_type_id === feedTypeId);
    if (!comp) return [];
    return (comp.feed_composition_items || []).map(item => {
      const propPct = Number(item.quantity_kg) / Number(comp.base_qty_kg);
      const qtdKg   = propPct * totalKg;
      const ing     = item.feed_ingredients;
      return {
        nome: ing?.name || '—',
        ingId: ing?.id,
        propPct: (propPct * 100).toFixed(3),
        qtdMN: qtdKg,
        qtdMS: ing?.dry_matter_pct ? qtdKg * (ing.dry_matter_pct / 100) : null,
      };
    }).sort((a, b) => b.qtdMN - a.qtdMN);
  };

  // ── Salvar realizado + ajuste de estoque ────────────────────
  const handleSalvarRealizado = async (batidaId, qtdRealizada) => {
    const batida  = batidas.find(b => b.id === batidaId);
    if (!batida)  return alert('Batida não encontrada.');
    const previsto = Number(batida.total_qty_kg);
    const delta    = qtdRealizada - previsto;

    try {
      // 1. Atualiza a batida com o realizado
      const { error: errBatida } = await supabase
        .from('wagon_batches')
        .update({ qty_realizada_kg: qtdRealizada, realizado_at: new Date().toISOString() })
        .eq('id', batidaId);
      if (errBatida) throw errBatida;

      // 2. Se há diferença, ajusta estoque por ingrediente
      if (Math.abs(delta) > 0.001) {
        const ingsBase   = calcIngredientes(batida.feed_type_id, Math.abs(delta));
        const sinal      = delta > 0 ? -1 : 1; // positivo → usou mais → desconta; negativo → sobrou → devolve

        for (const ing of ingsBase) {
          if (!ing.ingId) continue;
          const qtdAjuste = ing.qtdMN * sinal; // negativo = desconto extra, positivo = devolução

          // Insere movimentação — a trigger do banco atualiza stock_qty_kg automaticamente
          const { error: errMov } = await supabase.from('ingredient_stock_movements').insert([{
            ingredient_id:  ing.ingId,
            farm_id:        currentFarm.id,
            movement_type:  'ajuste_batida',
            quantity_kg:    qtdAjuste,
            entry_date:     batida.batch_date,
            registered_by:  user.id,
            notes: `Ajuste batida ${qtdAjuste < 0 ? '(desconto extra)' : '(devolução)'} — prev: ${fmtKg(previsto)}, real: ${fmtKg(qtdRealizada)} — ${new Date(batida.batch_date + 'T00:00:00').toLocaleDateString('pt-BR')}`,
          }]);
          if (errMov) throw errMov;
        }
      }

      alert(`✅ Realizado salvo! ${delta !== 0 ? `Estoque ajustado em ${delta > 0 ? '' : '+'}${fmtKg(-delta)} por ingrediente.` : 'Sem diferença de estoque.'}`);
      loadDados();
    } catch (e) {
      alert('Erro ao salvar realizado: ' + e.message);
    }
  };

  // ── Individual: valores computados ──────────────────────────
  const loteAtual       = lotes.find(l => l.id === form.lot_id);
  const racaoAtual      = racoes.find(r => r.id === form.feed_type_id);
  const feedingsPerDay  = parseInt(loteAtual?.daily_feeding_count) || 1;
  const mnBase          = form.lot_id && form.feed_type_id ? calcMNBase(loteAtual, racaoAtual, form.batch_date) : null;
  const ajusteCocho     = form.cocho_note !== null && loteAtual ? calcAjusteCocho(form.cocho_note, parseInt(loteAtual.head_count) || 0) : 0;
  const mnSugeridoDia   = mnBase ? Math.max(0, mnBase.mnTotalDia + ajusteCocho) : 0;
  const mnSugeridoTrato = form.batch_type === 'feeding' ? mnSugeridoDia / feedingsPerDay : mnSugeridoDia;

  // ── Detecta próximo trato automático modo lote ───────────────
  useEffect(() => {
    if (aba !== 'lote') return;
    const maxExistente = lotes.reduce((max, l) => {
      const ex = batidas.filter(b => b.lot_id === l.id && b.batch_date === loteData && b.batch_type === 'feeding');
      const m  = ex.length ? Math.max(...ex.map(b => b.feeding_order || 1)) : 0;
      return Math.max(max, m);
    }, 0);
    setLoteOrdem(maxExistente + 1);
  }, [aba, loteData, batidas.length]);

  // ── Inicializa linhas do modo lote ───────────────────────────
  useEffect(() => {
    if (aba !== 'lote' || !lotes.length) return;
    setLoteLinhas(prev => {
      const novo = {};
      lotes.forEach(l => {
        const faseAtiva  = (l.lot_phases || []).find(f => loteData >= f.start_date && (!f.end_date || loteData <= f.end_date));
        const feedTypeId = faseAtiva?.feed_types?.id || prev[l.id]?.feed_type_id || '';
        const racao      = racoes.find(r => r.id === feedTypeId);
        const mn         = racao ? calcMNBase(l, racao, loteData) : null;
        const feedD      = parseInt(l.daily_feeding_count) || 1;
        const mnTrato    = mn ? (loteTipo === 'feeding' ? mn.mnTotalDia / feedD : mn.mnTotalDia) : 0;
        const batidasLote  = batidas.filter(b => b.lot_id === l.id && b.batch_date === loteData);
        const batidasTrato = batidasLote.filter(b => b.batch_type === 'feeding' && b.feeding_order === loteOrdem);
        const jaRegistrado = loteTipo === 'day'
          ? batidasLote.some(b => b.batch_type === 'day')
          : batidasTrato.length > 0;
        novo[l.id] = {
          checked:        prev[l.id]?.checked !== undefined ? prev[l.id].checked : !jaRegistrado,
          cocho_note:     null,
          feed_type_id:   feedTypeId,
          qty_kg:         mnTrato > 0 ? fmtN(mnTrato, 2).replace(',', '.') : '',
          mn_base:        mn,
          feedingsPerDay: feedD,
          jaRegistrado,
          // batidasLote calculado fresh no render, não guardado no estado
        };
      });
      return novo;
    });
  }, [aba, loteData, loteTipo, loteOrdem, lotes.length, racoes.length, batidas.length]);

  const handleCochoLote = (lotId, nota) => {
    setLoteLinhas(prev => {
      const atual    = prev[lotId];
      const lote     = lotes.find(l => l.id === lotId);
      const novaNote = atual.cocho_note === nota ? null : nota;
      const adj      = novaNote !== null ? calcAjusteCocho(novaNote, parseInt(lote?.head_count) || 0) : 0;
      const mnDia    = atual.mn_base ? Math.max(0, atual.mn_base.mnTotalDia + adj) : 0;
      const qty      = loteTipo === 'feeding' ? mnDia / (atual.feedingsPerDay || 1) : mnDia;
      return { ...prev, [lotId]: { ...atual, cocho_note: novaNote, qty_kg: qty > 0 ? fmtN(qty, 2).replace(',', '.') : atual.qty_kg } };
    });
  };

  // ── Salvar batida individual ─────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const total = parseFloat(String(form.total_qty_kg).replace(',', '.'));
    if (!total || total <= 0) return alert('Informe a quantidade total.');
    if (!form.lot_id)         return alert('Selecione o lote.');
    if (!form.feed_type_id)   return alert('Selecione a ração.');
    const payload = {
      farm_id: currentFarm.id, lot_id: form.lot_id, feed_type_id: form.feed_type_id,
      batch_date: form.batch_date, batch_type: form.batch_type,
      feeding_order: form.batch_type === 'feeding' ? parseInt(form.feeding_order) : null,
      total_qty_kg: total, cocho_note: form.cocho_note,
      cocho_adjustment_kg: ajusteCocho !== 0 ? ajusteCocho : null,
      notes: form.notes || null,
    };
    const { error } = await supabase.from('wagon_batches').insert([payload]);
    if (error) return alert('Erro: ' + error.message);
    resetForm();
    loadDados();
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta batida? O ajuste de estoque do realizado NÃO será estornado automaticamente.')) return;
    const { error } = await supabase.from('wagon_batches').delete().eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    loadDados();
  };

  const resetForm = () => {
    setForm({ lot_id: '', feed_type_id: '', batch_date: hoje, batch_type: 'feeding', feeding_order: 1, total_qty_kg: '', cocho_note: null, notes: '' });
    setShowForm(false);
  };

  // ── Salvar batidas em lote ───────────────────────────────────
  const handleSalvarLote = async () => {
    const selecionados = lotes.filter(l => loteLinhas[l.id]?.checked);
    if (!selecionados.length) return alert('Selecione ao menos um lote.');
    const invalidos = selecionados.filter(l => !loteLinhas[l.id]?.feed_type_id || !parseFloat(String(loteLinhas[l.id]?.qty_kg).replace(',', '.')));
    if (invalidos.length) return alert(`Lotes sem ração ou quantidade:\n${invalidos.map(l => l.lot_code).join(', ')}`);
    setSalvando(true);
    try {
      const payloads = selecionados.map(l => {
        const d   = loteLinhas[l.id];
        const adj = d.cocho_note !== null ? calcAjusteCocho(d.cocho_note, parseInt(l.head_count) || 0) : 0;
        return {
          farm_id: currentFarm.id, lot_id: l.id, feed_type_id: d.feed_type_id,
          batch_date: loteData, batch_type: loteTipo,
          feeding_order: loteTipo === 'feeding' ? loteOrdem : null,
          total_qty_kg: parseFloat(String(d.qty_kg).replace(',', '.')),
          cocho_note: d.cocho_note, cocho_adjustment_kg: adj !== 0 ? adj : null,
        };
      });
      const { error } = await supabase.from('wagon_batches').insert(payloads);
      if (error) throw error;
      alert(`✅ ${payloads.length} batida(s) registrada(s)! Lembre-se de lançar o peso realizado após a fabricação.`);
      loadDados();
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setSalvando(false); }
  };

  const toggleTodos = (val) => setLoteLinhas(prev => {
    const novo = { ...prev };
    lotes.forEach(l => { if (novo[l.id]) novo[l.id] = { ...novo[l.id], checked: val }; });
    return novo;
  });

  // ── Ordem de fabricação ──────────────────────────────────────
  const gerarOrdemFabricacao = () => {
    const selecionados = lotes.filter(l => loteLinhas[l.id]?.checked && loteLinhas[l.id]?.feed_type_id && parseFloat(String(loteLinhas[l.id]?.qty_kg).replace(',', '.')) > 0);
    if (!selecionados.length) return alert('Nenhum lote selecionado com quantidade válida.');
    // Verifica fresh do estado batidas, não do loteLinhas stale
    const semBatida = selecionados.filter(l => {
      const bDia = batidas.filter(b => b.lot_id === l.id && b.batch_date === loteData);
      return loteTipo === 'day'
        ? !bDia.some(b => b.batch_type === 'day')
        : !bDia.some(b => b.batch_type === 'feeding' && b.feeding_order === loteOrdem);
    });
    if (semBatida.length) {
      return alert(`Para gerar a ordem de fabricação, todos os lotes precisam ter a batida registrada.\n\nPendentes:\n${semBatida.map(l => l.lot_code).join(', ')}\n\nRegistre as batidas primeiro.`);
    }
    setShowPrint(true);
  };

  const handleImprimir = () => {
    const el = document.getElementById('ordem-fabricacao-print');
    if (!el) return;
    const janela = window.open('', '_blank', 'width=820,height=960');
    janela.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Ordem de Fabricação — ${loteData}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .sub { font-size: 12px; color: #555; margin-bottom: 22px; }
        .bloco { margin-bottom: 22px; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
        .bloco-header { background: #1a1a2e; color: #fff; padding: 9px 14px; display: flex; justify-content: space-between; align-items: center; }
        .bloco-header h2 { font-size: 14px; }
        .bloco-header span { font-size: 12px; opacity: 0.8; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 8px 12px; text-align: left; background: #f0f0f0; border-bottom: 1px solid #ddd; font-size: 12px; font-weight: 600; }
        td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        tfoot td { background: #e8f5e9; font-weight: bold; border-top: 2px solid #c8e6c9; }
        .total-geral { margin-top: 16px; padding: 12px 16px; background: #e8f5e9; border-radius: 6px; font-weight: bold; text-align: right; font-size: 15px; color: #1b5e20; border: 1px solid #a5d6a7; }
        .assinaturas { margin-top: 32px; display: flex; gap: 60px; justify-content: flex-end; }
        .assinatura { text-align: center; }
        .linha-assinatura { border-top: 1px solid #999; width: 200px; margin-bottom: 5px; }
        .label-assinatura { font-size: 11px; color: #666; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      ${el.innerHTML}
      <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>`);
    janela.document.close();
  };

  // ── Dados derivados ──────────────────────────────────────────
  const batidasFiltradas = batidas.filter(b =>
    (!filtroData || b.batch_date === filtroData) && (!filtroLote || b.lot_id === filtroLote)
  );
  const totalSelecionado = lotes.filter(l => loteLinhas[l.id]?.checked)
    .reduce((acc, l) => acc + (parseFloat(String(loteLinhas[l.id]?.qty_kg).replace(',', '.')) || 0), 0);
  const qtdSelecionados  = lotes.filter(l => loteLinhas[l.id]?.checked).length;

  if (authLoading || loading) return <Layout><div style={{ padding: '2rem' }}>Carregando...</div></Layout>;

  return (
    <Layout>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <h1>🚜 Batida de Vagão</h1>
          {aba === 'individual' && canCreate('wagon_batches') && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(true); }}>+ Nova Batida</button>
          )}
        </div>

        {/* Abas */}
        <div className={styles.abas}>
          <button className={`${styles.aba} ${aba === 'individual' ? styles.abaAtiva : ''}`} onClick={() => { setAba('individual'); setShowForm(false); }}>📋 Individual</button>
          <button className={`${styles.aba} ${aba === 'lote' ? styles.abaAtiva : ''}`} onClick={() => setAba('lote')}>⚡ Todos os Lotes</button>
        </div>

        {/* ═══ ABA INDIVIDUAL ═══ */}
        {aba === 'individual' && (
          <>
            {showForm && (
              <div className={styles.formCard}>
                <h2>Nova Batida de Vagão</h2>
                <form onSubmit={handleSubmit}>
                  <div className={styles.row}>
                    <div>
                      <label>Data *</label>
                      <input type="date" value={form.batch_date} onChange={e => {
                        const d = e.target.value;
                        const lote = lotes.find(l => l.id === form.lot_id);
                        const fase = (lote?.lot_phases || []).find(f => d >= f.start_date && (!f.end_date || d <= f.end_date));
                        setForm(p => ({ ...p, batch_date: d, feeding_order: detectarProximoTrato(p.lot_id, d), feed_type_id: fase?.feed_types?.id || p.feed_type_id }));
                      }} required />
                    </div>
                    <div>
                      <label>Tipo de Batida *</label>
                      <select value={form.batch_type} onChange={e => setForm(p => ({ ...p, batch_type: e.target.value }))}>
                        <option value="feeding">Por Trato</option>
                        <option value="day">Por Dia (todos os tratos)</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.row}>
                    <div>
                      <label>Lote *</label>
                      <select value={form.lot_id} onChange={e => {
                        const id   = e.target.value;
                        const lote = lotes.find(l => l.id === id);
                        const fase = (lote?.lot_phases || []).find(f => form.batch_date >= f.start_date && (!f.end_date || form.batch_date <= f.end_date));
                        setForm(p => ({ ...p, lot_id: id, feed_type_id: fase?.feed_types?.id || '', feeding_order: detectarProximoTrato(id, p.batch_date) }));
                      }}>
                        <option value="">Selecione o lote</option>
                        {lotes.map(l => <option key={l.id} value={l.id}>{l.lot_code} ({l.head_count} cab.)</option>)}
                      </select>
                    </div>
                    {form.batch_type === 'feeding' && (
                      <div>
                        <label>Nº do Trato *</label>
                        <div className={styles.tratoOrdemBox}>
                          <span className={styles.tratoOrdemNum}>{form.feeding_order}º Trato</span>
                          <div className={styles.tratoOrdemBtns}>
                            <button type="button" onClick={() => setForm(p => ({ ...p, feeding_order: Math.max(1, p.feeding_order - 1) }))}>−</button>
                            <button type="button" onClick={() => setForm(p => ({ ...p, feeding_order: p.feeding_order + 1 }))}>+</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={styles.row}>
                    <div>
                      <label>Ração *
                        {loteAtual && (() => {
                          const fase = (loteAtual.lot_phases || []).find(f => form.batch_date >= f.start_date && (!f.end_date || form.batch_date <= f.end_date));
                          return fase ? <span style={{ marginLeft: 8, background: '#e8f5e9', color: '#2e7d32', padding: '1px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600 }}>Fase: {fase.phase_name}</span> : null;
                        })()}
                      </label>
                      <select value={form.feed_type_id} onChange={e => setForm(p => ({ ...p, feed_type_id: e.target.value }))} required>
                        <option value="">Selecione a ração</option>
                        {racoes.map(r => <option key={r.id} value={r.id}>{r.name} — R$ {Number(r.cost_per_kg).toLocaleString('pt-BR', {minimumFractionDigits:2})}/kg{r.dry_matter_pct ? ` | MS: ${r.dry_matter_pct}%` : ''}</option>)}
                      </select>
                    </div>
                  </div>
                  {loteAtual && (
                    <div className={styles.cochoBox}>
                      <label>Nota de Cocho <span style={{ color: '#888', fontWeight: 400 }}>— leitura antes do trato</span></label>
                      <div className={styles.cochoNotas}>
                        {COCHO_NOTES.map(n => {
                          const adj = calcAjusteCocho(n.nota, parseInt(loteAtual.head_count) || 0);
                          const sel = form.cocho_note === n.nota;
                          return (
                            <button key={n.nota} type="button"
                              className={`${styles.cochoBtn} ${sel ? styles.cochoBtnActive : ''}`}
                              style={sel ? { background: n.bgCor, borderColor: n.cor, color: n.cor } : {}}
                              onClick={() => setForm(p => ({ ...p, cocho_note: p.cocho_note === n.nota ? null : n.nota }))}>
                              <span className={styles.cochoBtnNota}>{n.label}</span>
                              <span className={styles.cochoBtnDesc}>{n.desc}</span>
                              <span className={styles.cochoBtnAdj} style={{ color: n.sinal === 0 ? '#2e7d32' : n.cor }}>
                                {n.sinal === 0 ? 'sem ajuste' : `${adj > 0 ? '+' : ''}${fmtKg(adj)}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {mnBase && (
                    <div className={styles.sugestaoBox}>
                      <div className={styles.sugestaoInfo}>
                        <strong>🌿 Sugerido: {fmtKg(mnSugeridoTrato)}</strong>
                        <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '2px' }}>
                          Peso est. {fmtN(mnBase.pesoEstimado, 2)} kg ({mnBase.dias}d) → MS {fmtN(mnBase.msCab, 2)} kg/cab → MN base {fmtKg(mnBase.mnTotalDia)}
                        </div>
                        {ajusteCocho !== 0 && (
                          <div style={{ fontSize: '0.8rem', color: ajusteCocho > 0 ? '#c62828' : '#e65100', marginTop: '2px', fontWeight: 600 }}>
                            Ajuste nota {form.cocho_note}: {ajusteCocho > 0 ? '+' : ''}{fmtKg(ajusteCocho)} → total {fmtKg(mnSugeridoDia)}
                          </div>
                        )}
                      </div>
                      <button type="button" className={styles.btnUsarSugestao}
                        onClick={() => setForm(p => ({ ...p, total_qty_kg: fmtN(mnSugeridoTrato, 2).replace(',', '.') }))}>
                        Usar sugestão
                      </button>
                    </div>
                  )}
                  <div className={styles.row}>
                    <div>
                      <label>{form.batch_type === 'feeding' ? `Previsto — ${form.feeding_order}º trato (kg) *` : 'Previsto — dia completo (kg) *'}</label>
                      <input type="text" inputMode="decimal" value={form.total_qty_kg}
                        onChange={e => setForm(p => ({ ...p, total_qty_kg: e.target.value }))}
                        placeholder="Ex: 432,00" required />
                    </div>
                    <div>
                      <label>Observações</label>
                      <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Opcional" />
                    </div>
                  </div>
                  {form.feed_type_id && parseFloat(String(form.total_qty_kg).replace(',', '.')) > 0 && (() => {
                    const ings = calcIngredientes(form.feed_type_id, parseFloat(String(form.total_qty_kg).replace(',', '.')));
                    if (!ings.length) return null;
                    return (
                      <div className={styles.previewIngs}>
                        <div className={styles.previewIngsTitle}>📋 Ordem de fabricação (previsto) — {fmtKg(parseFloat(String(form.total_qty_kg).replace(',', '.')))}</div>
                        <TabelaIngredientes ings={ings} />
                      </div>
                    );
                  })()}
                  <div className={styles.formAcoes}>
                    <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                    <button type="submit">💾 Registrar Batida</button>
                  </div>
                </form>
              </div>
            )}

            {/* Filtros */}
            <div className={styles.filtros}>
              <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} className={styles.inputData} />
              <select value={filtroLote} onChange={e => setFiltroLote(e.target.value)}>
                <option value="">Todos os lotes</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.lot_code}</option>)}
              </select>
              {(filtroData !== hoje || filtroLote) && (
                <button className={styles.btnLimpar} onClick={() => { setFiltroData(hoje); setFiltroLote(''); }}>✕ Limpar</button>
              )}
              <span style={{ fontSize: '0.83rem', color: '#888' }}>{batidasFiltradas.length} batida(s)</span>
            </div>

            {/* Lista agrupada por trato */}
            {batidasFiltradas.length === 0 ? (
              <div className={styles.vazio}><div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚜</div><p>Nenhuma batida registrada para este filtro.</p></div>
            ) : (() => {
              const grupos = {};
              batidasFiltradas.forEach(b => {
                const chave = b.batch_type === 'day' ? 'dia' : `t${b.feeding_order}`;
                if (!grupos[chave]) grupos[chave] = { label: b.batch_type === 'day' ? '📅 Dia Completo' : `🕐 ${b.feeding_order}º Trato`, ordem: b.batch_type === 'day' ? 0 : b.feeding_order, batidas: [] };
                grupos[chave].batidas.push(b);
              });
              const gruposOrdenados = Object.values(grupos).sort((a, b) => a.ordem - b.ordem);
              return (
                <div className={styles.batidasList}>
                  {gruposOrdenados.map(grupo => {
                    const totalPrevisto  = grupo.batidas.reduce((s, b) => s + Number(b.total_qty_kg), 0);
                    const totalRealizado = grupo.batidas.reduce((s, b) => s + (b.qty_realizada_kg ? Number(b.qty_realizada_kg) : 0), 0);
                    const semRealizado   = grupo.batidas.filter(b => b.qty_realizada_kg == null).length;
                    return (
                      <div key={grupo.label} className={styles.tratoGrupo}>
                        <div className={styles.tratoGrupoHeader}>
                          <span>{grupo.label}</span>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: '0.82rem' }}>
                            <span style={{ opacity: 0.8 }}>Previsto: {fmtKg(totalPrevisto)}</span>
                            {totalRealizado > 0 && <span style={{ color: '#a5d6a7', fontWeight: 700 }}>Realizado: {fmtKg(totalRealizado)}</span>}
                            {semRealizado > 0 && <span style={{ color: '#ffcc80' }}>⏳ {semRealizado} sem realizado</span>}
                          </div>
                        </div>
                        <div className={styles.tratoGrupoLotes}>
                          {grupo.batidas.map(b => {
                            const lote       = lotes.find(l => l.id === b.lot_id);
                            const racao      = racoes.find(r => r.id === b.feed_type_id);
                            const qtdExib    = b.qty_realizada_kg ?? b.total_qty_kg;
                            const ings       = calcIngredientes(b.feed_type_id, Number(qtdExib));
                            const expanded   = expandedId === b.id;
                            const cochoEntry = b.cocho_note != null ? COCHO_NOTES.find(n => n.nota === b.cocho_note) : null;
                            const faseAtiva  = (lote?.lot_phases || []).find(f => b.batch_date >= f.start_date && (!f.end_date || b.batch_date <= f.end_date));
                            return (
                              <div key={b.id} className={styles.batidaCard}>
                                <div className={styles.batidaHeader}>
                                  <div className={styles.batidaHeaderLeft} onClick={() => setExpandedId(expanded ? null : b.id)} style={{ cursor: 'pointer', flex: 1 }}>
                                    <strong style={{ fontSize: '1rem' }}>{lote?.lot_code || '—'}</strong>
                                    <span style={{ color: '#666', fontSize: '0.88rem' }}>{racao?.name || '—'}</span>
                                    {faseAtiva && <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600 }}>{faseAtiva.phase_name}</span>}
                                    {cochoEntry && <span className={styles.cochoBadge} style={{ background: cochoEntry.bgCor, color: cochoEntry.cor }}>{cochoEntry.label}{b.cocho_adjustment_kg != null ? ` (${Number(b.cocho_adjustment_kg) > 0 ? '+' : ''}${fmtKg(b.cocho_adjustment_kg)})` : ''}</span>}
                                  </div>
                                  <div className={styles.batidaHeaderRight}>
                                    {/* Previsto */}
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: '0.72rem', color: '#aaa' }}>previsto</div>
                                      <div style={{ fontWeight: 600, color: '#555' }}>{fmtKg(b.total_qty_kg)}</div>
                                    </div>
                                    {/* Realizado */}
                                    <BadgeRealizado batida={b} onSalvar={handleSalvarRealizado} />
                                    <span className={styles.expandToggle} onClick={() => setExpandedId(expanded ? null : b.id)} style={{ cursor: 'pointer' }}>{expanded ? '▲' : '▼'}</span>
                                  </div>
                                </div>
                                {expanded && (
                                  <div className={styles.batidaBody}>
                                    {ings.length > 0 ? (
                                      <>
                                        <div className={styles.batidaBodyTitle}>
                                          📋 Ingredientes — {b.qty_realizada_kg ? `baseado no REALIZADO (${fmtKg(b.qty_realizada_kg)})` : `baseado no PREVISTO (${fmtKg(b.total_qty_kg)})`}
                                        </div>
                                        <TabelaIngredientes ings={ings} />
                                      </>
                                    ) : (
                                      <p style={{ color: '#888', fontSize: '0.88rem' }}>⚠️ Composição vigente não encontrada.</p>
                                    )}
                                    {b.notes && <div className={styles.batidaNotes}>📝 {b.notes}</div>}
                                    {canDelete('wagon_batches') && (
                                      <div style={{ marginTop: '0.8rem', textAlign: 'right' }}>
                                        <button className={styles.btnDeletar} onClick={() => handleDelete(b.id)}>Excluir</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}

        {/* ═══ ABA TODOS OS LOTES ═══ */}
        {aba === 'lote' && (
          <div className={styles.formCard}>
            <div className={styles.loteControles}>
              <div className={styles.loteControlesRow}>
                <div>
                  <label>Data</label>
                  <input type="date" value={loteData} onChange={e => setLoteData(e.target.value)} className={styles.inputData} />
                </div>
                <div>
                  <label>Tipo</label>
                  <select value={loteTipo} onChange={e => setLoteTipo(e.target.value)}>
                    <option value="feeding">Por Trato</option>
                    <option value="day">Por Dia</option>
                  </select>
                </div>
                {loteTipo === 'feeding' && (
                  <div>
                    <label>Nº do Trato</label>
                    <div className={styles.tratoOrdemBox}>
                      <span className={styles.tratoOrdemNum}>{loteOrdem}º Trato</span>
                      <div className={styles.tratoOrdemBtns}>
                        <button type="button" onClick={() => setLoteOrdem(o => Math.max(1, o - 1))}>−</button>
                        <button type="button" onClick={() => setLoteOrdem(o => o + 1)}>+</button>
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <button type="button" className={styles.btnSecundario} onClick={() => toggleTodos(true)}>Marcar todos</button>
                  <button type="button" className={styles.btnSecundario} onClick={() => toggleTodos(false)}>Desmarcar</button>
                </div>
              </div>
            </div>

            <div className={styles.loteTabela}>
              <table className={styles.tabelaLotes}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Lote</th>
                    <th>Cab.</th>
                    <th>Status</th>
                    <th>Ração</th>
                    <th>Nota Cocho</th>
                    <th>Qtd Prevista (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map(l => {
                    const d = loteLinhas[l.id];
                    if (!d) return null;
                    // Calcula SEMPRE fresh de batidas+loteData — nunca do estado loteLinhas (evita stale)
                    const batidasDia  = batidas.filter(b => b.lot_id === l.id && b.batch_date === loteData);
                    const batidasFeed = batidasDia.filter(b => b.batch_type === 'feeding');
                    const tratos      = batidasFeed.map(b => b.feeding_order).sort((a, b) => a - b);
                    const esteTratoOk = loteTipo === 'feeding' ? tratos.includes(loteOrdem) : batidasDia.some(b => b.batch_type === 'day');
                    // "próximo" = sequência contínua até loteOrdem-1 e este ainda não foi
                    const maxTrato    = tratos.length > 0 ? Math.max(...tratos) : 0;
                    const ehProximo   = loteTipo === 'feeding' && !esteTratoOk && tratos.length > 0 && loteOrdem === maxTrato + 1;
                    let statusEl;
                    if (esteTratoOk) {
                      statusEl = <div className={styles.statusOk}><span>✅ Registrado</span>{tratos.length > 0 && <span className={styles.statusTratos}>{tratos.map(t => `${t}º`).join(' · ')}</span>}</div>;
                    } else if (ehProximo) {
                      // Tratos anteriores todos feitos, este é o próximo na sequência — normal
                      statusEl = <div className={styles.statusProximo}><span>🕐 Próximo</span><span className={styles.statusTratos}>feito: {tratos.map(t => `${t}º`).join(' · ')}</span></div>;
                    } else if (tratos.length > 0) {
                      // Há tratos feitos mas pulou um (gap na sequência) — realmente pendente
                      statusEl = <div className={styles.statusParcial}><span>⚠️ Falta {loteOrdem}º</span><span className={styles.statusTratos}>feito: {tratos.map(t => `${t}º`).join(' · ')}</span></div>;
                    } else {
                      statusEl = <span className={styles.statusNenhum}>— Nenhum</span>;
                    }
                    return (
                      <tr key={l.id} className={`${d.checked ? styles.linhaChecked : styles.linhaUnchecked} ${esteTratoOk ? styles.linhaJaFeita : ''}`}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={d.checked} onChange={e => setLoteLinhas(p => ({ ...p, [l.id]: { ...p[l.id], checked: e.target.checked } }))} />
                        </td>
                        <td><strong>{l.lot_code}</strong></td>
                        <td>{l.head_count}</td>
                        <td>{statusEl}</td>
                        <td>
                          <select value={d.feed_type_id} disabled={!d.checked} className={styles.selectInline}
                            onChange={e => setLoteLinhas(p => ({ ...p, [l.id]: { ...p[l.id], feed_type_id: e.target.value } }))}>
                            <option value="">— Selecione —</option>
                            {racoes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <div className={styles.cochoNotasInline}>
                            {COCHO_NOTES.map(n => (
                              <button key={n.nota} type="button" disabled={!d.checked}
                                className={`${styles.cochoBtnInline} ${d.cocho_note === n.nota ? styles.cochoBtnInlineActive : ''}`}
                                style={d.cocho_note === n.nota ? { background: n.bgCor, borderColor: n.cor, color: n.cor } : {}}
                                onClick={() => handleCochoLote(l.id, n.nota)}>
                                {n.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <input type="text" inputMode="decimal" value={d.qty_kg} disabled={!d.checked}
                            className={styles.inputInline}
                            onChange={e => setLoteLinhas(p => ({ ...p, [l.id]: { ...p[l.id], qty_kg: e.target.value } }))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} style={{ padding: '10px 12px', fontWeight: 700 }}>Total selecionado ({qtdSelecionados} lotes)</td>
                    <td style={{ padding: '10px 12px' }}><strong style={{ color: '#2e7d32', fontSize: '1.05rem' }}>{fmtKg(totalSelecionado)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className={styles.legendaStatus}>
              <span className={styles.statusOk}>✅ Registrado</span> — batida salva neste trato &nbsp;·&nbsp;
              <span className={styles.statusProximo}>🕐 Próximo</span> — tratos anteriores feitos, este é o próximo &nbsp;·&nbsp;
              <span className={styles.statusParcial}>⚠️ Falta Nº</span> — trato faltando no meio &nbsp;·&nbsp;
              <span className={styles.statusNenhum}>— Nenhum</span> — nada registrado hoje
            </div>

            <div className={styles.formAcoes}>
              <span style={{ fontSize: '0.85rem', color: '#888' }}>{qtdSelecionados} lote(s) selecionado(s)</span>
              <button type="button" className={styles.btnSecundario} onClick={gerarOrdemFabricacao}>🖨️ Ordem de Fabricação</button>
              <button type="button" className={styles.btnAdd} onClick={handleSalvarLote} disabled={salvando}>
                {salvando ? 'Salvando...' : `💾 Registrar ${qtdSelecionados} Batida(s)`}
              </button>
            </div>
          </div>
        )}

        {/* ═══ MODAL ORDEM DE FABRICAÇÃO ═══ */}
        {showPrint && (() => {
          const selecionados = lotes.filter(l => loteLinhas[l.id]?.checked && loteLinhas[l.id]?.feed_type_id && parseFloat(String(loteLinhas[l.id]?.qty_kg).replace(',', '.')) > 0);
          const totalGeral   = selecionados.reduce((s, l) => s + parseFloat(String(loteLinhas[l.id].qty_kg).replace(',', '.')), 0);
          const dataFmt      = new Date(loteData + 'T00:00:00').toLocaleDateString('pt-BR');
          const tipoLabel    = loteTipo === 'day' ? 'Dia completo' : `${loteOrdem}º Trato`;
          const mapa = {};
          selecionados.forEach(l => {
            calcIngredientes(loteLinhas[l.id].feed_type_id, parseFloat(String(loteLinhas[l.id].qty_kg).replace(',', '.'))).forEach(ing => {
              if (!mapa[ing.nome]) mapa[ing.nome] = { nome: ing.nome, qtdMN: 0, qtdMS: 0, temMS: ing.qtdMS != null };
              mapa[ing.nome].qtdMN += ing.qtdMN;
              if (ing.qtdMS != null) mapa[ing.nome].qtdMS += ing.qtdMS;
            });
          });
          const ingsConsolidados = Object.values(mapa).sort((a, b) => b.qtdMN - a.qtdMN);
          return (
            <div className={styles.modalOverlay} onClick={() => setShowPrint(false)}>
              <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <div>
                    <h2>🖨️ Ordem de Fabricação</h2>
                    <span>{dataFmt} — {tipoLabel} — {selecionados.length} lote(s) — {fmtKg(totalGeral)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={styles.btnAdd} onClick={handleImprimir}>Imprimir / Salvar PDF</button>
                    <button className={styles.btnCancelar} onClick={() => setShowPrint(false)}>✕ Fechar</button>
                  </div>
                </div>
                <div className={styles.modalBody}>
                  <div id="ordem-fabricacao-print">
                    <h1 style={{ fontSize: 20, marginBottom: 2 }}>Ordem de Fabricação</h1>
                    <div className="sub"><strong>{currentFarm?.name}</strong> · {dataFmt} · {tipoLabel}</div>
                    <div className="bloco" style={{ marginBottom: 22 }}>
                      <div className="bloco-header"><h2>📋 Lotes incluídos</h2><span>{selecionados.length} lote(s)</span></div>
                      <table>
                        <thead><tr><th>Lote</th><th>Cabeças</th><th>Fase</th><th>Ração</th><th>Nota Cocho</th><th>Qtd Prevista</th></tr></thead>
                        <tbody>
                          {selecionados.map(l => {
                            const d         = loteLinhas[l.id];
                            const racao     = racoes.find(r => r.id === d.feed_type_id);
                            const faseAtiva = (l.lot_phases || []).find(f => loteData >= f.start_date && (!f.end_date || loteData <= f.end_date));
                            const cochoEntry = d.cocho_note !== null ? COCHO_NOTES.find(n => n.nota === d.cocho_note) : null;
                            return (
                              <tr key={l.id}>
                                <td><strong>{l.lot_code}</strong></td>
                                <td>{l.head_count}</td>
                                <td>{faseAtiva?.phase_name || '—'}</td>
                                <td>{racao?.name || '—'}</td>
                                <td>{cochoEntry ? <span style={{ color: cochoEntry.cor, fontWeight: 700 }}>{cochoEntry.label} — {cochoEntry.desc}</span> : '—'}</td>
                                <td><strong>{fmtKg(parseFloat(String(d.qty_kg).replace(',', '.')))}</strong></td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot><tr><td colSpan={5}><strong>TOTAL PREVISTO</strong></td><td><strong>{fmtKg(totalGeral)}</strong></td></tr></tfoot>
                      </table>
                    </div>
                    <div className="bloco">
                      <div className="bloco-header"><h2>🏭 Composição — Ordem de Adição ao Vagão</h2><span>{fmtKg(totalGeral)} previsto</span></div>
                      {ingsConsolidados.length > 0 ? (
                        <table>
                          <thead><tr><th style={{ width: 36 }}>#</th><th>Ingrediente</th><th>Qtd MN (kg)</th><th>Qtd MS (kg)</th><th>Realizado (kg)</th></tr></thead>
                          <tbody>
                            {ingsConsolidados.map((ing, i) => (
                              <tr key={i}>
                                <td style={{ color: '#888', fontWeight: 700 }}>{i + 1}</td>
                                <td style={{ fontSize: 14 }}><strong>{ing.nome}</strong></td>
                                <td style={{ fontSize: 15, fontWeight: 700 }}>{fmtKg(ing.qtdMN)}</td>
                                <td style={{ color: '#1565c0' }}>{ing.temMS ? fmtKg(ing.qtdMS) : '—'}</td>
                                <td style={{ color: '#999', fontStyle: 'italic' }}>_____________</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr><td colSpan={2}><strong>TOTAL</strong></td><td><strong>{fmtKg(totalGeral)}</strong></td><td></td><td style={{ fontWeight: 700 }}>_____________</td></tr></tfoot>
                        </table>
                      ) : (
                        <div style={{ padding: '12px 14px', color: '#e65100' }}>⚠️ Composições não encontradas.</div>
                      )}
                    </div>
                    <div className="assinaturas">
                      <div className="assinatura"><div className="linha-assinatura"></div><div className="label-assinatura">Responsável</div></div>
                      <div className="assinatura"><div className="linha-assinatura"></div><div className="label-assinatura">Tratador</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </Layout>
  );
}
