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

function TabelaIngredientes({ ings, fmtKg }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
      <thead>
        <tr style={{ background: '#f5f5f5' }}>
          {['Ingrediente','Proporção','Qtd MN','Qtd MS'].map(h => (
            <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #ddd' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ings.map((ing, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
            <td style={{ padding: '7px 10px' }}>{ing.nome}</td>
            <td style={{ padding: '7px 10px' }}>{ing.propPct}%</td>
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

  const [form, setForm] = useState({
    lot_id: '', feed_type_id: '', batch_date: hoje,
    batch_type: 'feeding', feeding_order: 1,
    total_qty_kg: '', cocho_note: null, notes: '',
  });

  const [loteData, setLoteData]   = useState(hoje);
  const [loteTipo, setLoteTipo]   = useState('feeding');
  const [loteOrdem, setLoteOrdem] = useState(1);
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

  const fmtKg = (v) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg' : '—';
  const fmtN  = (v, d=2) => v != null ? Number(v).toFixed(d) : '—';

  const calcMNBase = (lote, racao, dataRef) => {
    if (!lote || !racao) return null;
    const msPvPct    = parseFloat(lote.carcass_yield_pct);
    const msDietaPct = parseFloat(racao.dry_matter_pct);
    const gmd        = parseFloat(lote.target_gmd) || 0;
    const headCount  = parseInt(lote.head_count) || 0;
    if (!msPvPct || !msDietaPct || !headCount) return null;
    const pesagensLote = pesagens.filter(p => p.lot_id === lote.id && p.weighing_date <= dataRef)
      .sort((a, b) => b.weighing_date.localeCompare(a.weighing_date));
    let pesoBase, dataBase;
    if (pesagensLote.length > 0) { pesoBase = parseFloat(pesagensLote[0].avg_weight_kg); dataBase = pesagensLote[0].weighing_date; }
    else { pesoBase = parseFloat(lote.avg_entry_weight) || 0; dataBase = lote.entry_date; }
    if (!pesoBase || !dataBase) return null;
    const dias = Math.max(0, Math.floor((new Date(dataRef) - new Date(dataBase)) / 86400000));
    const pesoEstimado = pesoBase + (dias * gmd);
    const msCab = pesoEstimado * (msPvPct / 100);
    const mnCab = msCab / (msDietaPct / 100);
    const mnTotalDia = mnCab * headCount;
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
      return { nome: ing?.name || '—', propPct: (propPct * 100).toFixed(3), qtdMN: qtdKg, qtdMS: ing?.dry_matter_pct ? qtdKg * (ing.dry_matter_pct / 100) : null };
    }).sort((a, b) => b.qtdMN - a.qtdMN);
  };

  // Individual computed
  const loteAtual      = lotes.find(l => l.id === form.lot_id);
  const racaoAtual     = racoes.find(r => r.id === form.feed_type_id);
  const feedingsPerDay = parseInt(loteAtual?.daily_feeding_count) || 1;
  const mnBase         = form.lot_id && form.feed_type_id ? calcMNBase(loteAtual, racaoAtual, form.batch_date) : null;
  const ajusteCocho    = form.cocho_note !== null && loteAtual ? calcAjusteCocho(form.cocho_note, parseInt(loteAtual.head_count) || 0) : 0;
  const mnSugeridoDia  = mnBase ? Math.max(0, mnBase.mnTotalDia + ajusteCocho) : 0;
  const mnSugeridoTrato = form.batch_type === 'feeding' ? mnSugeridoDia / feedingsPerDay : mnSugeridoDia;

  // Inicializa linhas do modo lote
  useEffect(() => {
    if (aba !== 'lote' || !lotes.length) return;
    setLoteLinhas(prev => {
      const novo = {};
      lotes.forEach(l => {
        const faseAtiva = (l.lot_phases || []).find(f => loteData >= f.start_date && (!f.end_date || loteData <= f.end_date));
        const feedTypeId = faseAtiva?.feed_types?.id || prev[l.id]?.feed_type_id || '';
        const racao      = racoes.find(r => r.id === feedTypeId);
        const mn         = racao ? calcMNBase(l, racao, loteData) : null;
        const feedD      = parseInt(l.daily_feeding_count) || 1;
        const mnTrato    = mn ? (loteTipo === 'feeding' ? mn.mnTotalDia / feedD : mn.mnTotalDia) : 0;
        novo[l.id] = {
          checked:      prev[l.id]?.checked !== undefined ? prev[l.id].checked : true,
          cocho_note:   null,
          feed_type_id: feedTypeId,
          qty_kg:       mnTrato > 0 ? mnTrato.toFixed(1) : '',
          mn_base:      mn,
          feedingsPerDay: feedD,
        };
      });
      return novo;
    });
  }, [aba, loteData, loteTipo, loteOrdem, lotes.length, racoes.length]);

  const handleCochoLote = (lotId, nota) => {
    setLoteLinhas(prev => {
      const atual  = prev[lotId];
      const lote   = lotes.find(l => l.id === lotId);
      const novaNote = atual.cocho_note === nota ? null : nota;
      const adj    = novaNote !== null ? calcAjusteCocho(novaNote, parseInt(lote?.head_count) || 0) : 0;
      const mnDia  = atual.mn_base ? Math.max(0, atual.mn_base.mnTotalDia + adj) : 0;
      const qty    = loteTipo === 'feeding' ? mnDia / (atual.feedingsPerDay || 1) : mnDia;
      return { ...prev, [lotId]: { ...atual, cocho_note: novaNote, qty_kg: qty > 0 ? qty.toFixed(1) : atual.qty_kg } };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const total = parseFloat(form.total_qty_kg);
    if (!total || total <= 0) return alert('Informe a quantidade total.');
    if (!form.lot_id)       return alert('Selecione o lote.');
    if (!form.feed_type_id) return alert('Selecione a ração.');
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
    resetForm(); loadDados();
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta batida?')) return;
    const { error } = await supabase.from('wagon_batches').delete().eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    loadDados();
  };

  const resetForm = () => {
    setForm({ lot_id: '', feed_type_id: '', batch_date: hoje, batch_type: 'feeding', feeding_order: 1, total_qty_kg: '', cocho_note: null, notes: '' });
    setShowForm(false);
  };

  const [showPrint, setShowPrint] = useState(false);

  const gerarOrdemFabricacao = () => {
    const selecionados = lotes.filter(l => loteLinhas[l.id]?.checked && loteLinhas[l.id]?.feed_type_id && parseFloat(loteLinhas[l.id]?.qty_kg) > 0);
    if (!selecionados.length) return alert('Nenhum lote selecionado com quantidade válida.');
    setShowPrint(true);
  };

  const handleImprimir = () => {
    const el = document.getElementById('ordem-fabricacao-print');
    if (!el) return;
    const janela = window.open('', '_blank', 'width=800,height=900');
    janela.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Ordem de Fabricação — ${loteData}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .sub { font-size: 12px; color: #555; margin-bottom: 20px; }
        .lote-bloco { margin-bottom: 24px; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
        .lote-header { background: #1a1a2e; color: #fff; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; }
        .lote-header h2 { font-size: 14px; }
        .lote-header span { font-size: 12px; opacity: 0.8; }
        .lote-meta { padding: 6px 14px; background: #f5f5f5; font-size: 11px; color: #555; display: flex; gap: 20px; border-bottom: 1px solid #ddd; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 7px 12px; text-align: left; background: #f0f0f0; border-bottom: 1px solid #ddd; font-size: 12px; }
        td { padding: 7px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        tfoot td { background: #e8f5e9; font-weight: bold; border-top: 2px solid #c8e6c9; }
        .total-geral { margin-top: 16px; padding: 10px 14px; background: #e8f5e9; border-radius: 6px; font-weight: bold; text-align: right; font-size: 14px; }
        .nota-badge { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: bold; }
        @media print { body { padding: 10px; } }
      </style>
      </head><body>
      ${el.innerHTML}
      <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>
    `);
    janela.document.close();
  };

  const handleSalvarLote = async () => {
    const selecionados = lotes.filter(l => loteLinhas[l.id]?.checked);
    if (!selecionados.length) return alert('Selecione ao menos um lote.');
    const invalidos = selecionados.filter(l => !loteLinhas[l.id]?.feed_type_id || !parseFloat(loteLinhas[l.id]?.qty_kg));
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
          total_qty_kg: parseFloat(d.qty_kg),
          cocho_note: d.cocho_note, cocho_adjustment_kg: adj !== 0 ? adj : null,
        };
      });
      const { error } = await supabase.from('wagon_batches').insert(payloads);
      if (error) throw error;
      alert(`✅ ${payloads.length} batida(s) registrada(s)!`);
      loadDados();
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setSalvando(false); }
  };

  const toggleTodos = (val) => setLoteLinhas(prev => {
    const novo = { ...prev };
    lotes.forEach(l => { if (novo[l.id]) novo[l.id] = { ...novo[l.id], checked: val }; });
    return novo;
  });

  const batidasFiltradas = batidas.filter(b => (!filtroData || b.batch_date === filtroData) && (!filtroLote || b.lot_id === filtroLote));
  const totalSelecionado = lotes.filter(l => loteLinhas[l.id]?.checked).reduce((acc, l) => acc + (parseFloat(loteLinhas[l.id]?.qty_kg) || 0), 0);
  const qtdSelecionados  = lotes.filter(l => loteLinhas[l.id]?.checked).length;

  if (authLoading || loading) return <Layout><div style={{ padding: '2rem' }}>Carregando...</div></Layout>;

  return (
    <Layout>
      <div className={styles.container}>

        <div className={styles.header}>
          <h1>🚜 Batida de Vagão</h1>
          {aba === 'individual' && canCreate('wagon_batches') && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(true); }}>+ Nova Batida</button>
          )}
        </div>

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
                      <input type="date" value={form.batch_date}
                        onChange={e => {
                      const d = e.target.value;
                      const lote = lotes.find(l => l.id === form.lot_id);
                      const faseAtiva = (lote?.lot_phases || []).find(f =>
                        d >= f.start_date && (!f.end_date || d <= f.end_date)
                      );
                      const feedTypeId = faseAtiva?.feed_types?.id || form.feed_type_id;
                      setForm(p => ({ ...p, batch_date: d, feeding_order: detectarProximoTrato(p.lot_id, d), feed_type_id: feedTypeId }));
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
                        const faseAtiva = (lote?.lot_phases || []).find(f =>
                          form.batch_date >= f.start_date && (!f.end_date || form.batch_date <= f.end_date)
                        );
                        const feedTypeId = faseAtiva?.feed_types?.id || '';
                        setForm(p => ({ ...p, lot_id: id, feed_type_id: feedTypeId, feeding_order: detectarProximoTrato(id, p.batch_date) }));
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
                          const fase = (loteAtual.lot_phases || []).find(f =>
                            form.batch_date >= f.start_date && (!f.end_date || form.batch_date <= f.end_date)
                          );
                          return fase ? <span style={{ marginLeft: 8, background: '#e8f5e9', color: '#2e7d32', padding: '1px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600 }}>Fase: {fase.phase_name}</span> : null;
                        })()}
                      </label>
                      <select value={form.feed_type_id} onChange={e => setForm(p => ({ ...p, feed_type_id: e.target.value }))} required>
                        <option value="">Selecione a ração</option>
                        {racoes.map(r => <option key={r.id} value={r.id}>{r.name} — R$ {Number(r.cost_per_kg).toFixed(2)}/kg{r.dry_matter_pct ? ` | MS: ${r.dry_matter_pct}%` : ''}</option>)}
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
                          Peso est. {fmtN(mnBase.pesoEstimado, 1)} kg ({mnBase.dias}d) → MS {fmtN(mnBase.msCab, 2)} kg/cab → MN base {fmtKg(mnBase.mnTotalDia)}
                        </div>
                        {ajusteCocho !== 0 && (
                          <div style={{ fontSize: '0.8rem', color: ajusteCocho > 0 ? '#c62828' : '#e65100', marginTop: '2px', fontWeight: 600 }}>
                            Ajuste nota {form.cocho_note}: {ajusteCocho > 0 ? '+' : ''}{fmtKg(ajusteCocho)} → total {fmtKg(mnSugeridoDia)}
                          </div>
                        )}
                      </div>
                      <button type="button" className={styles.btnUsarSugestao} onClick={() => setForm(p => ({ ...p, total_qty_kg: mnSugeridoTrato.toFixed(1) }))}>Usar sugestão</button>
                    </div>
                  )}
                  <div className={styles.row}>
                    <div>
                      <label>{form.batch_type === 'feeding' ? `Total a fabricar — ${form.feeding_order}º trato (kg) *` : 'Total a fabricar — dia completo (kg) *'}</label>
                      <input type="number" value={form.total_qty_kg} onChange={e => setForm(p => ({ ...p, total_qty_kg: e.target.value }))} placeholder="Ex: 432.0" step="0.1" min="0" required />
                    </div>
                    <div>
                      <label>Observações</label>
                      <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Opcional" />
                    </div>
                  </div>
                  {form.feed_type_id && parseFloat(form.total_qty_kg) > 0 && (() => {
                    const ings = calcIngredientes(form.feed_type_id, parseFloat(form.total_qty_kg));
                    if (!ings.length) return null;
                    return (
                      <div className={styles.previewIngs}>
                        <div className={styles.previewIngsTitle}>📋 Ordem de fabricação — {fmtKg(parseFloat(form.total_qty_kg))}</div>
                        <TabelaIngredientes ings={ings} fmtKg={fmtKg} />
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

            {batidasFiltradas.length === 0 ? (
              <div className={styles.vazio}><div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚜</div><p>Nenhuma batida registrada para este filtro.</p></div>
            ) : (() => {
              // Agrupa por trato (feeding_order) ou dia
              const grupos = {};
              batidasFiltradas.forEach(b => {
                const chave = b.batch_type === 'day' ? 'dia' : `t${b.feeding_order}`;
                if (!grupos[chave]) grupos[chave] = { label: b.batch_type === 'day' ? '📅 Dia Completo' : `🕐 ${b.feeding_order}º Trato`, ordem: b.batch_type === 'day' ? 0 : b.feeding_order, batidas: [] };
                grupos[chave].batidas.push(b);
              });
              const gruposOrdenados = Object.values(grupos).sort((a, b) => a.ordem - b.ordem);
              return (
                <div className={styles.batidasList}>
                  {gruposOrdenados.map(grupo => (
                    <div key={grupo.label} className={styles.tratoGrupo}>
                      {/* Cabeçalho do trato */}
                      <div className={styles.tratoGrupoHeader}>
                        <span>{grupo.label}</span>
                        <span style={{ fontSize: '0.82rem', opacity: 0.8 }}>
                          {grupo.batidas.length} lote(s) — {fmtKg(grupo.batidas.reduce((s, b) => s + Number(b.total_qty_kg), 0))} total
                        </span>
                      </div>
                      {/* Cards dos lotes neste trato */}
                      <div className={styles.tratoGrupoLotes}>
                        {grupo.batidas.map(b => {
                          const lote  = lotes.find(l => l.id === b.lot_id);
                          const racao = racoes.find(r => r.id === b.feed_type_id);
                          const ings  = calcIngredientes(b.feed_type_id, Number(b.total_qty_kg));
                          const expanded   = expandedId === b.id;
                          const cochoEntry = b.cocho_note != null ? COCHO_NOTES.find(n => n.nota === b.cocho_note) : null;
                          const faseAtiva  = (lote?.lot_phases || []).find(f =>
                            b.batch_date >= f.start_date && (!f.end_date || b.batch_date <= f.end_date)
                          );
                          return (
                            <div key={b.id} className={styles.batidaCard}>
                              <div className={styles.batidaHeader} onClick={() => setExpandedId(expanded ? null : b.id)}>
                                <div className={styles.batidaHeaderLeft}>
                                  <strong style={{ fontSize: '1rem' }}>{lote?.lot_code || '—'}</strong>
                                  <span style={{ color: '#666', fontSize: '0.88rem' }}>{racao?.name || '—'}</span>
                                  {faseAtiva && (
                                    <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600 }}>
                                      {faseAtiva.phase_name}
                                    </span>
                                  )}
                                  {cochoEntry && (
                                    <span className={styles.cochoBadge} style={{ background: cochoEntry.bgCor, color: cochoEntry.cor }}>
                                      {cochoEntry.label}{b.cocho_adjustment_kg != null ? ` (${Number(b.cocho_adjustment_kg) > 0 ? '+' : ''}${fmtKg(b.cocho_adjustment_kg)})` : ''}
                                    </span>
                                  )}
                                </div>
                                <div className={styles.batidaHeaderRight}>
                                  <span className={styles.batidaTotal}>{fmtKg(b.total_qty_kg)}</span>
                                  <span className={styles.expandToggle}>{expanded ? '▲' : '▼'}</span>
                                </div>
                              </div>
                              {expanded && (
                                <div className={styles.batidaBody}>
                                  {ings.length > 0
                                    ? <><div className={styles.batidaBodyTitle}>📋 Ingredientes para {fmtKg(b.total_qty_kg)}</div><TabelaIngredientes ings={ings} fmtKg={fmtKg} /></>
                                    : <p style={{ color: '#888', fontSize: '0.88rem' }}>⚠️ Composição vigente não encontrada.</p>
                                  }
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
                  ))}
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
                    <th>Ração</th>
                    <th>Nota Cocho</th>
                    <th>Qtd MN (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map(l => {
                    const d = loteLinhas[l.id];
                    if (!d) return null;
                    return (
                      <tr key={l.id} className={d.checked ? styles.linhaChecked : styles.linhaUnchecked}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={d.checked}
                            onChange={e => setLoteLinhas(p => ({ ...p, [l.id]: { ...p[l.id], checked: e.target.checked } }))} />
                        </td>
                        <td><strong>{l.lot_code}</strong></td>
                        <td>{l.head_count}</td>
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
                          <input type="number" value={d.qty_kg} step="0.1" min="0" disabled={!d.checked}
                            className={styles.inputInline}
                            onChange={e => setLoteLinhas(p => ({ ...p, [l.id]: { ...p[l.id], qty_kg: e.target.value } }))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ padding: '10px 12px', fontWeight: 700 }}>Total selecionado ({qtdSelecionados} lotes)</td>
                    <td style={{ padding: '10px 12px' }}><strong style={{ color: '#2e7d32', fontSize: '1.05rem' }}>{fmtKg(totalSelecionado)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className={styles.formAcoes}>
              <span style={{ fontSize: '0.85rem', color: '#888' }}>{qtdSelecionados} lote(s) selecionado(s)</span>
              <button type="button" className={styles.btnSecundario} onClick={gerarOrdemFabricacao}>
                🖨️ Ordem de Fabricação
              </button>
              <button type="button" className={styles.btnAdd} onClick={handleSalvarLote} disabled={salvando}>
                {salvando ? 'Salvando...' : `💾 Registrar ${qtdSelecionados} Batida(s)`}
              </button>
            </div>
          </div>
        )}

        {/* ═══ MODAL ORDEM DE FABRICAÇÃO ═══ */}
        {showPrint && (() => {
          const selecionados = lotes.filter(l => loteLinhas[l.id]?.checked && loteLinhas[l.id]?.feed_type_id && parseFloat(loteLinhas[l.id]?.qty_kg) > 0);
          const totalGeral   = selecionados.reduce((s, l) => s + parseFloat(loteLinhas[l.id].qty_kg), 0);
          const dataFmt      = new Date(loteData + 'T00:00:00').toLocaleDateString('pt-BR');
          const tipoLabel    = loteTipo === 'day' ? 'Dia completo' : `${loteOrdem}º Trato`;

          return (
            <div className={styles.modalOverlay} onClick={() => setShowPrint(false)}>
              <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <div>
                    <h2>🖨️ Ordem de Fabricação</h2>
                    <span>{dataFmt} — {tipoLabel} — {selecionados.length} lote(s)</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={styles.btnAdd} onClick={handleImprimir}>Imprimir / Salvar PDF</button>
                    <button className={styles.btnCancelar} onClick={() => setShowPrint(false)}>✕ Fechar</button>
                  </div>
                </div>

                {/* Conteúdo imprimível */}
                <div className={styles.modalBody}>
                  <div id="ordem-fabricacao-print">
                    <h1 style={{ fontFamily: 'Arial', fontSize: 18, marginBottom: 4 }}>Ordem de Fabricação</h1>
                    <div className="sub" style={{ fontFamily: 'Arial', fontSize: 12, color: '#555', marginBottom: 20 }}>
                      {currentFarm?.name} — {dataFmt} — {tipoLabel}
                    </div>

                    {selecionados.map(l => {
                      const d    = loteLinhas[l.id];
                      const ings = calcIngredientes(d.feed_type_id, parseFloat(d.qty_kg));
                      const racao = racoes.find(r => r.id === d.feed_type_id);
                      const faseAtiva = (l.lot_phases || []).find(f => loteData >= f.start_date && (!f.end_date || loteData <= f.end_date));
                      const cochoEntry = d.cocho_note !== null ? COCHO_NOTES.find(n => n.nota === d.cocho_note) : null;
                      return (
                        <div key={l.id} className="lote-bloco">
                          <div className="lote-header">
                            <h2>{l.lot_code} — {racao?.name || '—'}</h2>
                            <span>{fmtKg(parseFloat(d.qty_kg))} total</span>
                          </div>
                          <div className="lote-meta">
                            <span>🐂 {l.head_count} cab.</span>
                            {faseAtiva && <span>📋 Fase: {faseAtiva.phase_name}</span>}
                            {cochoEntry && <span style={{ color: cochoEntry.cor }}>Nota Cocho: {cochoEntry.label} — {cochoEntry.desc}</span>}
                          </div>
                          {ings.length > 0 ? (
                            <table>
                              <thead>
                                <tr><th>#</th><th>Ingrediente</th><th>Proporção</th><th>Qtd MN</th><th>Qtd MS</th></tr>
                              </thead>
                              <tbody>
                                {ings.map((ing, i) => (
                                  <tr key={i}>
                                    <td style={{ color: '#888', width: 30 }}>{i+1}</td>
                                    <td><strong>{ing.nome}</strong></td>
                                    <td>{ing.propPct}%</td>
                                    <td><strong>{fmtKg(ing.qtdMN)}</strong></td>
                                    <td style={{ color: '#1565c0' }}>{ing.qtdMS != null ? fmtKg(ing.qtdMS) : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={3}><strong>TOTAL</strong></td>
                                  <td><strong>{fmtKg(parseFloat(d.qty_kg))}</strong></td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          ) : (
                            <div style={{ padding: '10px 14px', color: '#e65100', fontSize: 12 }}>⚠️ Composição não encontrada para esta ração.</div>
                          )}
                        </div>
                      );
                    })}

                    <div className="total-geral">
                      Total Geral de Fabricação: {fmtKg(totalGeral)}
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
