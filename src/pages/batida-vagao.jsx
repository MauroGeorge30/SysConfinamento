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
  const [realizadoData, setRealizadoData] = useState(hoje);
  const [realizadoInputs, setRealizadoInputs] = useState({}); // { ingId: valorDigitado }
  const [salvandoRealizado, setSalvandoRealizado] = useState(false);
  const [entregaInputs, setEntregaInputs] = useState({}); // { batidaId: { qty_kg, cocho_note } }
  const [mostrarEntrega, setMostrarEntrega] = useState(false); // controla visibilidade da Seção 2
  const [toleranciaEntregaPct, setToleranciaEntregaPct] = useState(10); // % tolerância para alerta de diferença
  const [modalAjuste, setModalAjuste] = useState(null); // { totalFab, totalEntregue, delta, batidasDia, entregaParaSalvar }
  const [baiaSelecionada, setBaiaSelecionada] = useState(''); // batidaId escolhida para receber o ajuste
  const [batidas, setBatidas]       = useState([]);
  const [lotes, setLotes]           = useState([]);
  const [racoes, setRacoes]         = useState([]);
  const [pesagens, setPesagens]     = useState([]);
  const [compositions, setCompositions] = useState([]);
  const [ingredientes, setIngredientes] = useState([]); // com stock_qty_kg
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
        { data: ingsData },
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
        supabase.from('feed_ingredients').select('id, name, stock_qty_kg').eq('farm_id', currentFarm.id),
      ]);
      setBatidas(batidasData || []);
      setLotes(lotesData || []);
      setRacoes(racoesData || []);
      setPesagens(pesagensData || []);
      setCompositions(compData || []);
      setIngredientes(ingsData || []);
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

  // ── Valida estoque antes de registrar ────────────────────────
  // Recebe array de { feedTypeId, totalKg } e retorna array de alertas
  const validarEstoque = (itens) => {
    // Soma necessária por ingrediente em todos os itens
    const necessario = {};
    itens.forEach(({ feedTypeId, totalKg }) => {
      calcIngredientes(feedTypeId, totalKg).forEach(ing => {
        if (!ing.ingId) return;
        necessario[ing.ingId] = (necessario[ing.ingId] || { nome: ing.nome, qtd: 0 });
        necessario[ing.ingId].qtd += ing.qtdMN;
      });
    });
    // Compara com saldo
    const alertas = [];
    Object.entries(necessario).forEach(([ingId, { nome, qtd }]) => {
      const ing = ingredientes.find(i => i.id === ingId);
      const saldo = Number(ing?.stock_qty_kg || 0);
      if (saldo < qtd) {
        alertas.push({
          nome,
          necessario: qtd,
          saldo,
          falta: qtd - saldo,
        });
      }
    });
    return alertas;
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

  // ── Aba Realizado: calcula insumos previstos para o dia ──────
  const calcInsumosPrevistosDia = (data) => {
    const batidasDia = batidas.filter(b => b.batch_date === data);
    // Agrupa por insumo: soma o previsto de todas as batidas do dia
    const mapa = {}; // { ingId: { nome, qtdPrevistaDia, batidas: [{batidaId, feedTypeId, qtdPrevistaBatida, ingQtdBatida}] } }
    batidasDia.forEach(batida => {
      const ings = calcIngredientes(batida.feed_type_id, Number(batida.total_qty_kg));
      ings.forEach(ing => {
        if (!ing.ingId) return;
        if (!mapa[ing.ingId]) mapa[ing.ingId] = { ingId: ing.ingId, nome: ing.nome, qtdPrevistaDia: 0, batidas: [] };
        mapa[ing.ingId].qtdPrevistaDia += ing.qtdMN;
        mapa[ing.ingId].batidas.push({
          batidaId:        batida.id,
          feedTypeId:      batida.feed_type_id,
          qtdPrevistaBatida: Number(batida.total_qty_kg),
          ingQtdBatida:    ing.qtdMN, // quanto deste insumo estava previsto nesta batida específica
        });
      });
    });
    return Object.values(mapa).sort((a, b) => b.qtdPrevistaDia - a.qtdPrevistaDia);
  };

  // ── Aba Realizado: salva realizado proporcional ──────────────
  const handleSalvarRealizadoDia = async () => {
    const insumos = calcInsumosPrevistosDia(realizadoData);
    if (!insumos.length) return alert('Nenhuma batida encontrada para esta data.');

    // Verifica se todos os insumos com previsto > 0 têm realizado informado
    const faltando = insumos.filter(ing => {
      const v = parseFloat(String(realizadoInputs[ing.ingId] || '').replace(',', '.'));
      return isNaN(v) || v < 0;
    });
    if (faltando.length) return alert(`Informe o realizado de todos os insumos:\n${faltando.map(i => i.nome).join(', ')}`);

    // Para cada batida do dia, calcula o qty_realizada_kg proporcional
    const batidasDia = batidas.filter(b => b.batch_date === realizadoData);

    // Monta mapa de realizado por batida:
    // Para cada batida, soma os insumos realizados proporcionalmente
    const realizadoPorBatida = {}; // { batidaId: qtdRealizadaKg }
    batidasDia.forEach(b => { realizadoPorBatida[b.id] = 0; });

    insumos.forEach(ing => {
      const totalRealizado = parseFloat(String(realizadoInputs[ing.ingId] || '0').replace(',', '.'));
      const totalPrevisto  = ing.qtdPrevistaDia;
      if (totalPrevisto <= 0) return;

      ing.batidas.forEach(({ batidaId, ingQtdBatida }) => {
        const proporcao = ingQtdBatida / totalPrevisto; // % desta batida no total deste insumo
        realizadoPorBatida[batidaId] = (realizadoPorBatida[batidaId] || 0) + (proporcao * totalRealizado);
      });
    });

    // Confirmação com diff
    const linhas = batidasDia.map(b => {
      const lote    = lotes.find(l => l.id === b.lot_id);
      const prev    = Number(b.total_qty_kg);
      const real    = realizadoPorBatida[b.id] || 0;
      const delta   = real - prev;
      const deltaPct = prev > 0 ? ((delta / prev) * 100).toFixed(1) : 0;
      return `${lote?.lot_code || b.id}: prev ${fmtKg(prev)} → real ${fmtKg(real)} (${delta >= 0 ? '+' : ''}${deltaPct}%)`;
    });
    const ok = confirm(`Confirma lançamento do realizado para ${batidasDia.length} batida(s) em ${new Date(realizadoData + 'T00:00:00').toLocaleDateString('pt-BR')}?\n\n${linhas.join('\n')}`);
    if (!ok) return;

    setSalvandoRealizado(true);
    try {
      for (const batida of batidasDia) {
        const qtdRealizada = realizadoPorBatida[batida.id] || 0;
        const previsto     = Number(batida.total_qty_kg);
        const delta        = qtdRealizada - previsto;

        // 1. Atualiza qty_realizada_kg na batida
        const { error: errBatida } = await supabase
          .from('wagon_batches')
          .update({ qty_realizada_kg: qtdRealizada, realizado_at: new Date().toISOString() })
          .eq('id', batida.id);
        if (errBatida) throw errBatida;

        // 2. Ajuste de estoque por insumo (delta direto por insumo)
        if (Math.abs(delta) > 0.001) {
          const ingsBase = calcIngredientes(batida.feed_type_id, Math.abs(delta));
          const sinal    = delta > 0 ? -1 : 1;
          for (const ing of ingsBase) {
            if (!ing.ingId) continue;
            const qtdAjuste = ing.qtdMN * sinal;
            const { error: errMov } = await supabase.from('ingredient_stock_movements').insert([{
              ingredient_id: ing.ingId,
              farm_id:       currentFarm.id,
              movement_type: 'ajuste_batida',
              quantity_kg:   qtdAjuste,
              entry_date:    batida.batch_date,
              registered_by: user.id,
              notes: `Ajuste realizado proporcional — prev: ${fmtKg(previsto)}, real: ${fmtKg(qtdRealizada)} — ${new Date(batida.batch_date + 'T00:00:00').toLocaleDateString('pt-BR')}`,
            }]);
            if (errMov) throw errMov;
          }
        }
      }

      alert('✅ Realizado de fabricação lançado! Preencha agora a Seção 2 — Entrega no Cocho.');
      setMostrarEntrega(true);
      loadDados();
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSalvandoRealizado(false);
    }
  };

  // ── Aba Realizado: salva entrega no cocho por lote ─────────
  const handleSalvarEntregaCocho = async () => {
    const batidasDia = batidas.filter(b => b.batch_date === realizadoData);
    const comEntrega = batidasDia.filter(b => {
      const v = parseFloat(String(entregaInputs[b.id]?.qty_kg || '').replace(',', '.'));
      return !isNaN(v) && v > 0;
    });
    if (!comEntrega.length) return alert('Informe a entrega de ao menos um lote.');

    // Calcula totais fabricado x entregue
    const totalFab      = comEntrega.reduce((s, b) => s + (b.qty_realizada_kg != null ? Number(b.qty_realizada_kg) : Number(b.total_qty_kg)), 0);
    const totalEntregue = comEntrega.reduce((s, b) => s + parseFloat(String(entregaInputs[b.id].qty_kg).replace(',', '.')), 0);
    const delta         = totalEntregue - totalFab;
    const deltaPct      = totalFab > 0 ? Math.abs(delta / totalFab) * 100 : 0;

    // Se diferença acima da tolerância → abrir modal de ajuste
    if (deltaPct > toleranciaEntregaPct) {
      setBaiaSelecionada('');
      setModalAjuste({ totalFab, totalEntregue, delta, batidasDia: comEntrega, entregaParaSalvar: entregaInputs });
      return;
    }

    // Sem diferença relevante → salvar direto
    await _executarSalvarEntrega(comEntrega, entregaInputs);
  };

  const _executarSalvarEntrega = async (comEntrega, inputsParaSalvar, batidaAjusteId = null, deltaAjuste = 0) => {
    setSalvandoRealizado(true);
    try {
      for (const batida of comEntrega) {
        let entrega = parseFloat(String(inputsParaSalvar[batida.id].qty_kg).replace(',', '.'));
        // Se esta é a baia escolhida para absorver o ajuste, aplica a diferença
        if (batidaAjusteId && batida.id === batidaAjusteId) {
          entrega = parseFloat((entrega - deltaAjuste).toFixed(3));
        }
        const cochoNote = inputsParaSalvar[batida.id].cocho_note ?? null;
        const { error } = await supabase
          .from('wagon_batches')
          .update({
            qty_entregue_cocho_kg: entrega,
            cocho_note: cochoNote !== null ? cochoNote : undefined,
            entregue_at: new Date().toISOString(),
          })
          .eq('id', batida.id);
        if (error) throw error;
      }
      alert('✅ Entrega no cocho registrada!\n\nNao esqueca de registrar os tratos na aba Tratos Diarios.');
      setEntregaInputs({});
      setRealizadoInputs({});
      setMostrarEntrega(false);
      setModalAjuste(null);
      setBaiaSelecionada('');
      loadDados();
    } catch (e) {
      alert('Erro ao salvar entrega: ' + e.message);
    } finally {
      setSalvandoRealizado(false);
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
    const maxTratos = lotes.length > 0 ? Math.min(...lotes.map(l => parseInt(l.daily_feeding_count) || 1)) : 99;
    const maxExistente = lotes.reduce((max, l) => {
      const ex = batidas.filter(b => b.lot_id === l.id && b.batch_date === loteData && b.batch_type === 'feeding');
      const m  = ex.length ? Math.max(...ex.map(b => b.feeding_order || 1)) : 0;
      return Math.max(max, m);
    }, 0);
    const proximoTrato = Math.min(maxExistente + 1, maxTratos);
    setLoteOrdem(proximoTrato);
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

  // ── Mensagem de alerta de estoque ──────────────────────────
  const msgAlertaEstoque = (alertas) => {
    const linhas = alertas.map(a =>
      '\u2022 ' + a.nome + '\n  Necess\u00e1rio: ' + fmtKg(a.necessario) + '  |  Saldo: ' + fmtKg(a.saldo) + '  |  Falta: ' + fmtKg(a.falta)
    ).join('\n\n');
    return '\u26a0\ufe0f Estoque insuficiente:\n\n' + linhas + '\n\nRegistre uma entrada de estoque antes de continuar.';
  };

  // ── Salvar batida individual ─────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const total = parseFloat(String(form.total_qty_kg).replace(',', '.'));
    if (!total || total <= 0) return alert('Informe a quantidade total.');
    if (!form.lot_id)         return alert('Selecione o lote.');
    if (!form.feed_type_id)   return alert('Selecione a ração.');
    // Valida estoque
    const alertasEst = validarEstoque([{ feedTypeId: form.feed_type_id, totalKg: total }]);
    if (alertasEst.length) return alert(msgAlertaEstoque(alertasEst));

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
    const batida = batidas.find(b => b.id === id);
    const lote   = lotes.find(l => l.id === batida?.lot_id);
    const temRealizado = batida?.qty_realizada_kg != null;

    const msg = [
      'Confirma exclusao desta batida?',
      '',
      'Lote: ' + (lote?.lot_code || '—'),
      'Data: ' + (batida?.batch_date || '—'),
      'Previsto: ' + fmtKg(batida?.total_qty_kg),
      '',
      'O estoque do PREVISTO sera estornado automaticamente pelo banco.',
      temRealizado
        ? 'ATENCAO: Esta batida tem realizado lancado (' + fmtKg(batida.qty_realizada_kg) + '). O ajuste do realizado NAO sera estornado — verifique o saldo dos insumos apos excluir.'
        : 'Nenhum realizado lancado — sem impacto adicional no estoque.',
    ].join('\n');

    if (!confirm(msg)) return;
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
      // Valida estoque consolidado de todos os lotes selecionados
      const itensParaValidar = selecionados.map(l => ({
        feedTypeId: loteLinhas[l.id].feed_type_id,
        totalKg: parseFloat(String(loteLinhas[l.id].qty_kg).replace(',', '.')),
      }));
      const alertasEst = validarEstoque(itensParaValidar);
      if (alertasEst.length) { setSalvando(false); return alert(msgAlertaEstoque(alertasEst)); }

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
  const totalSelecionado = lotes.filter(l => loteLinhas[l.id]?.checked).reduce((acc, l) => {
    const d = loteLinhas[l.id];
    if (!d) return acc;
    const digitado = parseFloat(String(d.qty_kg).replace(',', '.'));
    if (!isNaN(digitado) && digitado > 0) return acc + digitado;
    if (d.mn_base) {
      const feedD = d.feedingsPerDay || 1;
      return acc + (loteTipo === 'feeding' ? d.mn_base.mnTotalDia / feedD : d.mn_base.mnTotalDia);
    }
    return acc;
  }, 0);
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
          <button className={`${styles.aba} ${aba === 'realizado' ? styles.abaAtiva : ''}`} onClick={() => setAba('realizado')}>✅ Lançar Realizado</button>
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
                    const alertasEst = validarEstoque([{ feedTypeId: form.feed_type_id, totalKg: parseFloat(String(form.total_qty_kg).replace(',', '.')) }]);
                    return (
                      <div className={styles.previewIngs}>
                        <div className={styles.previewIngsTitle}>📋 Ordem de fabricação (previsto) — {fmtKg(parseFloat(String(form.total_qty_kg).replace(',', '.')))}</div>
                        {alertasEst.length > 0 && (
                          <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: '0.83rem', color: '#c62828' }}>
                            <strong>⚠️ Estoque insuficiente:</strong>
                            {alertasEst.map(a => (
                              <div key={a.nome} style={{ marginTop: 3 }}>
                                • <strong>{a.nome}</strong> — necessário {fmtKg(a.necessario)}, saldo {fmtKg(a.saldo)} <span style={{ fontWeight: 700 }}>(falta {fmtKg(a.falta)})</span>
                              </div>
                            ))}
                          </div>
                        )}
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
                      <span className={styles.tratoOrdemNum}>
                      {loteOrdem}º Trato
                      <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 400, marginLeft: 4 }}>
                        / {lotes.length > 0 ? Math.min(...lotes.map(l => parseInt(l.daily_feeding_count) || 1)) : '?'}
                      </span>
                    </span>
                      <div className={styles.tratoOrdemBtns}>
                        <button type="button" onClick={() => setLoteOrdem(o => Math.max(1, o - 1))}>−</button>
                        <button type="button" onClick={() => {
                          const maxTratos = lotes.length > 0 ? Math.min(...lotes.map(l => parseInt(l.daily_feeding_count) || 1)) : 99;
                          setLoteOrdem(o => Math.min(o + 1, maxTratos));
                        }}>+</button>
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

            {/* Alerta de estoque insuficiente para lotes selecionados */}
            {(() => {
              const selecionados = lotes.filter(l => loteLinhas[l.id]?.checked && loteLinhas[l.id]?.feed_type_id && parseFloat(String(loteLinhas[l.id]?.qty_kg).replace(',','.')) > 0);
              const alertasEst = validarEstoque(selecionados.map(l => ({ feedTypeId: loteLinhas[l.id].feed_type_id, totalKg: parseFloat(String(loteLinhas[l.id].qty_kg).replace(',','.')) })));
              if (!alertasEst.length) return null;
              return (
                <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: '0.83rem', color: '#c62828' }}>
                  <strong>⚠️ Estoque insuficiente para registrar:</strong>
                  {alertasEst.map(a => (
                    <div key={a.nome} style={{ marginTop: 3 }}>
                      • <strong>{a.nome}</strong> — necessário {fmtKg(a.necessario)}, saldo {fmtKg(a.saldo)} <span style={{ fontWeight: 700 }}>(falta {fmtKg(a.falta)})</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className={styles.formAcoes}>
              <span style={{ fontSize: '0.85rem', color: '#888' }}>{qtdSelecionados} lote(s) selecionado(s)</span>
              <button type="button" className={styles.btnSecundario} onClick={gerarOrdemFabricacao}>🖨️ Ordem de Fabricação</button>
              <button type="button" className={styles.btnAdd} onClick={handleSalvarLote} disabled={salvando}>
                {salvando ? 'Salvando...' : `💾 Registrar ${qtdSelecionados} Batida(s)`}
              </button>
            </div>
          </div>
        )}

        {/* ═══ ABA LANÇAR REALIZADO ═══ */}
        {aba === 'realizado' && (() => {
          const batidasDia   = batidas.filter(b => b.batch_date === realizadoData);
          const insumos      = calcInsumosPrevistosDia(realizadoData);
          const totalBatidas = batidasDia.length;
          const todasFabricadas  = totalBatidas > 0 && batidasDia.every(b => b.qty_realizada_kg != null);
          const todasEntregues   = totalBatidas > 0 && batidasDia.every(b => b.qty_entregue_cocho_kg != null);
          const algumaSemFab     = batidasDia.some(b => b.qty_realizada_kg == null);
          const algumaSemEntrega = batidasDia.some(b => b.qty_entregue_cocho_kg == null);

          // Calcula MN e MS por batida para o histórico
          const calcMSBatida = (b, qtdKg) => {
            const comp = compositions.find(c => c.feed_type_id === b.feed_type_id);
            if (!comp) return null;
            return (comp.feed_composition_items || []).reduce((acc, item) => {
              const ing = item.feed_ingredients;
              if (!ing?.dry_matter_pct) return acc;
              const propPct = Number(item.quantity_kg) / Number(comp.base_qty_kg);
              return acc + (propPct * qtdKg * (ing.dry_matter_pct / 100));
            }, 0);
          };

          return (
            <div className={styles.formCard}>
              <h2>✅ Lançar Realizado do Dia</h2>

              {/* Loading overlay */}
              {salvandoRealizado && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: '#fff', borderRadius: 16, padding: '2rem 3rem', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1a1a2e', marginBottom: 4 }}>Processando...</div>
                    <div style={{ fontSize: '0.88rem', color: '#666' }}>Aguarde, atualizando estoque e batidas.</div>
                  </div>
                </div>
              )}

              {/* Controle de data */}
              <div className={styles.loteControles}>
                <div className={styles.loteControlesRow}>
                  <div>
                    <label>Data</label>
                    <input type="date" value={realizadoData}
                      onChange={e => { setRealizadoData(e.target.value); setRealizadoInputs({}); setEntregaInputs({}); setMostrarEntrega(false); }}
                      className={styles.inputData} />
                  </div>
                  <div style={{ alignSelf: 'flex-end', fontSize: '0.85rem', color: '#666' }}>
                    {totalBatidas === 0
                      ? <span style={{ color: '#aaa' }}>Nenhuma batida nesta data</span>
                      : <span>
                          {totalBatidas} batida(s) —{' '}
                          <span style={{ color: todasFabricadas ? '#2e7d32' : '#e65100', fontWeight: 700 }}>
                            {todasFabricadas ? '✅ Fabricação ok' : `⏳ ${batidasDia.filter(b => b.qty_realizada_kg != null).length}/${totalBatidas} fabricadas`}
                          </span>
                          {' · '}
                          <span style={{ color: todasEntregues ? '#2e7d32' : '#e65100', fontWeight: 700 }}>
                            {todasEntregues ? '✅ Entrega ok' : `⏳ ${batidasDia.filter(b => b.qty_entregue_cocho_kg != null).length}/${totalBatidas} entregues`}
                          </span>
                        </span>
                    }
                  </div>
                </div>
              </div>

              {insumos.length === 0 ? (
                <div className={styles.vazio}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
                  <p>Nenhuma batida registrada para {new Date(realizadoData + 'T00:00:00').toLocaleDateString('pt-BR')}.</p>
                  <p style={{ fontSize: '0.85rem', color: '#aaa', marginTop: 4 }}>Registre as batidas primeiro na aba "Todos os Lotes".</p>
                </div>
              ) : (
                <>
                  {/* ── HISTÓRICO DE BATIDAS DO DIA ── */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a2e', marginBottom: 8 }}>
                      📋 Resumo das batidas — {new Date(realizadoData + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </div>
                    <div className={styles.loteTabela}>
                      <table className={styles.tabelaRealizado}>
                        <thead>
                          <tr>
                            <th>Lote</th>
                            <th>Trato</th>
                            <th style={{ textAlign: 'right' }}>Previsto MN</th>
                            <th style={{ textAlign: 'right', color: '#1565c0' }}>Fabricado</th>
                            <th style={{ textAlign: 'right', color: '#2e7d32' }}>Entregue Cocho</th>
                            <th style={{ textAlign: 'right', color: '#2e7d32' }}>MS Entregue</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batidasDia.map(b => {
                            const lote     = lotes.find(l => l.id === b.lot_id);
                            const racao    = racoes.find(r => r.id === b.feed_type_id);
                            const prev     = Number(b.total_qty_kg);
                            const fab      = b.qty_realizada_kg != null ? Number(b.qty_realizada_kg) : null;
                            const entregue = b.qty_entregue_cocho_kg != null ? Number(b.qty_entregue_cocho_kg) : null;
                            const prevMS   = calcMSBatida(b, prev);
                            const fabMS    = fab != null ? calcMSBatida(b, fab) : null;
                            const cochoEntry = b.cocho_note != null ? COCHO_NOTES.find(n => n.nota === b.cocho_note) : null;
                            const status =
                              entregue != null ? { label: '✅ Completo', cor: '#2e7d32', bg: '#e8f5e9' } :
                              fab != null      ? { label: '🐄 Aguarda entrega', cor: '#1565c0', bg: '#e3f2fd' } :
                                                 { label: '⏳ Sem fabricado', cor: '#e65100', bg: '#fff3e0' };
                            return (
                              <tr key={b.id} style={{ background: status.bg + '55' }}>
                                <td>
                                  <strong>{lote?.lot_code || '—'}</strong>
                                  <div style={{ fontSize: '0.75rem', color: '#888' }}>{racao?.name || '—'}</div>
                                </td>
                                <td style={{ fontSize: '0.82rem', color: '#666' }}>
                                  {b.batch_type === 'day' ? 'Dia' : b.feeding_order + 'º trato'}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <strong>{fmtKg(prev)}</strong>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {fab != null
                                    ? <><strong style={{ color: '#1565c0' }}>{fmtKg(fab)}</strong>
                                        <div style={{ fontSize: '0.72rem', color: fab > prev ? '#e65100' : '#1565c0' }}>
                                          {fab > prev ? '+' : ''}{fmtKg(fab - prev)}
                                        </div>
                                      </>
                                    : <span style={{ color: '#bbb', fontSize: '0.82rem' }}>— não lançado</span>
                                  }
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {entregue != null
                                    ? <><strong style={{ color: '#2e7d32' }}>{fmtKg(entregue)}</strong>
                                        {cochoEntry && <div style={{ fontSize: '0.72rem', color: cochoEntry.cor, fontWeight: 700 }}>{cochoEntry.label}</div>}
                                        <div style={{ fontSize: '0.72rem', color: entregue > (fab ?? prev) ? '#e65100' : '#1565c0' }}>
                                          {entregue > (fab ?? prev) ? '+' : ''}{fmtKg(entregue - (fab ?? prev))}
                                        </div>
                                      </>
                                    : <span style={{ color: '#bbb', fontSize: '0.82rem' }}>— não lançado</span>
                                  }
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {entregue != null
                                    ? <strong style={{ color: '#2e7d32' }}>{calcMSBatida(b, entregue) != null ? fmtKg(calcMSBatida(b, entregue)) : '—'}</strong>
                                    : <span style={{ color: '#bbb', fontSize: '0.82rem' }}>—</span>
                                  }
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{ background: status.bg, color: status.cor, padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {status.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2}><strong>TOTAL</strong></td>
                            <td style={{ textAlign: 'right' }}><strong>{fmtKg(batidasDia.reduce((s, b) => s + Number(b.total_qty_kg), 0))}</strong></td>
                            <td style={{ textAlign: 'right', color: '#1565c0' }}>
                              <strong>{fmtKg(batidasDia.filter(b => b.qty_realizada_kg != null).reduce((s, b) => s + Number(b.qty_realizada_kg), 0))}</strong>
                            </td>
                            <td style={{ textAlign: 'right', color: '#2e7d32' }}>
                              <strong>{fmtKg(batidasDia.filter(b => b.qty_entregue_cocho_kg != null).reduce((s, b) => s + Number(b.qty_entregue_cocho_kg), 0))}</strong>
                            </td>
                            <td style={{ textAlign: 'right', color: '#2e7d32' }}>
                              <strong>{fmtKg(batidasDia.filter(b => b.qty_entregue_cocho_kg != null).reduce((s, b) => s + (calcMSBatida(b, Number(b.qty_entregue_cocho_kg)) || 0), 0))}</strong>
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* ── SEÇÃO 1: Lançar Fabricação — só se há batidas sem fabricado ── */}
                  {algumaSemFab && (
                    <div style={{ marginBottom: 20, border: '1px solid #90caf9', borderRadius: 10, padding: '1rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1565c0', marginBottom: 8 }}>
                        🏭 Seção 1 — Realizado de Fabricação (por insumo)
                      </div>
                      <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.85rem', color: '#1565c0' }}>
                        Informe o total de cada insumo usado no dia. O sistema distribui proporcionalmente entre as batidas com base no previsto.
                      </div>
                      <div className={styles.loteTabela}>
                        <table className={styles.tabelaRealizado}>
                          <thead>
                            <tr>
                              <th>Insumo</th>
                              <th style={{ textAlign: 'right' }}>Previsto Total</th>
                              <th style={{ textAlign: 'right', color: '#1565c0' }}>Realizado Total</th>
                              <th style={{ textAlign: 'right' }}>Diferença</th>
                              <th style={{ textAlign: 'right' }}>Dif. %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {insumos.map(ing => {
                              const rawVal   = realizadoInputs[ing.ingId] ?? '';
                              const realVal  = parseFloat(String(rawVal).replace(',', '.'));
                              const temValor = !isNaN(realVal) && realVal >= 0;
                              const delta    = temValor ? realVal - ing.qtdPrevistaDia : null;
                              const deltaPct = delta != null && ing.qtdPrevistaDia > 0 ? (delta / ing.qtdPrevistaDia) * 100 : null;
                              const corDelta = delta == null ? '#aaa' : delta > 0 ? '#e65100' : delta < 0 ? '#1565c0' : '#2e7d32';
                              const alertaTol = deltaPct != null && Math.abs(deltaPct) > TOLERANCIA_PCT;
                              return (
                                <tr key={ing.ingId} style={{ background: alertaTol ? '#fff8e1' : undefined }}>
                                  <td>
                                    <strong>{ing.nome}</strong>
                                    {alertaTol && <span style={{ marginLeft: 6, fontSize: '0.72rem', color: '#e65100', fontWeight: 700 }}>⚠️ &gt;{TOLERANCIA_PCT}%</span>}
                                  </td>
                                  <td style={{ textAlign: 'right', color: '#555' }}>{fmtKg(ing.qtdPrevistaDia)}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div className={styles.realizadoEdit} style={{ justifyContent: 'flex-end' }}>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={rawVal}
                                        placeholder={fmtN(ing.qtdPrevistaDia, 2)}
                                        onChange={e => setRealizadoInputs(p => ({ ...p, [ing.ingId]: e.target.value }))}
                                        className={styles.inputRealizado}
                                        style={{ width: 120 }}
                                      />
                                      <span style={{ fontSize: '0.8rem', color: '#888' }}>kg</span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: corDelta }}>
                                    {delta != null ? `${delta >= 0 ? '+' : ''}${fmtKg(delta)}` : '—'}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: corDelta }}>
                                    {deltaPct != null ? `${deltaPct >= 0 ? '+' : ''}${fmtPct(deltaPct)}` : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td><strong>TOTAL</strong></td>
                              <td style={{ textAlign: 'right' }}><strong>{fmtKg(insumos.reduce((s, i) => s + i.qtdPrevistaDia, 0))}</strong></td>
                              <td style={{ textAlign: 'right' }}>
                                <strong style={{ color: '#1565c0' }}>
                                  {fmtKg(insumos.reduce((s, i) => {
                                    const v = parseFloat(String(realizadoInputs[i.ingId] || '0').replace(',', '.'));
                                    return s + (isNaN(v) ? 0 : v);
                                  }, 0))}
                                </strong>
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Preview distribuição */}
                      {Object.keys(realizadoInputs).length > 0 && (() => {
                        const realizadoPorBatida = {};
                        batidasDia.forEach(b => { realizadoPorBatida[b.id] = 0; });
                        insumos.forEach(ing => {
                          const totalRealizado = parseFloat(String(realizadoInputs[ing.ingId] || '0').replace(',', '.'));
                          if (isNaN(totalRealizado)) return;
                          const totalPrevisto = ing.qtdPrevistaDia;
                          if (totalPrevisto <= 0) return;
                          ing.batidas.forEach(({ batidaId, ingQtdBatida }) => {
                            const proporcao = ingQtdBatida / totalPrevisto;
                            realizadoPorBatida[batidaId] = (realizadoPorBatida[batidaId] || 0) + (proporcao * totalRealizado);
                          });
                        });
                        return (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#333', marginBottom: 6 }}>📊 Distribuição por batida (preview)</div>
                            <div className={styles.loteTabela}>
                              <table className={styles.tabelaLotes}>
                                <thead>
                                  <tr>
                                    <th>Lote</th><th>Trato</th>
                                    <th style={{ textAlign: 'right' }}>Previsto</th>
                                    <th style={{ textAlign: 'right', color: '#1565c0' }}>Fabricado</th>
                                    <th style={{ textAlign: 'right' }}>Δ %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {batidasDia.filter(b => b.qty_realizada_kg == null).map(b => {
                                    const lote = lotes.find(l => l.id === b.lot_id);
                                    const prev = Number(b.total_qty_kg);
                                    const real = realizadoPorBatida[b.id] || 0;
                                    const delta = real - prev;
                                    const deltaPct = prev > 0 ? (delta / prev) * 100 : 0;
                                    const corD = delta > 0.5 ? '#e65100' : delta < -0.5 ? '#1565c0' : '#2e7d32';
                                    return (
                                      <tr key={b.id}>
                                        <td><strong>{lote?.lot_code || '—'}</strong></td>
                                        <td style={{ fontSize: '0.82rem', color: '#888' }}>{b.batch_type === 'day' ? 'Dia' : b.feeding_order + 'º trato'}</td>
                                        <td style={{ textAlign: 'right', color: '#555' }}>{fmtKg(prev)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#1565c0' }}>{fmtKg(real)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: corD, fontSize: '0.82rem' }}>{(deltaPct >= 0 ? '+' : '') + fmtPct(deltaPct)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                      <div className={styles.formAcoes}>
                        <button type="button" className={styles.btnCancelar} onClick={() => { setRealizadoInputs({}); setEntregaInputs({}); setMostrarEntrega(false); }}>Limpar</button>
                        <button type="button" className={styles.btnAdd} onClick={handleSalvarRealizadoDia}
                          disabled={salvandoRealizado || Object.keys(realizadoInputs).length === 0}>
                          💾 1. Confirmar Realizado Fabricação
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── SEÇÃO 2: Entrega no Cocho — aparece se fabricação ok e há batidas sem entrega ── */}
                  {(algumaSemEntrega && (todasFabricadas || mostrarEntrega)) && (() => {
                    const getBase = (b) => b.qty_realizada_kg != null ? Number(b.qty_realizada_kg) : Number(b.total_qty_kg);
                    return (
                      <div style={{ border: '1px solid #a5d6a7', borderRadius: 10, padding: '1rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2e7d32', marginBottom: 8 }}>
                          🐄 Seção 2 — Entrega no Cocho por Lote
                        </div>
                        <div style={{ fontSize: '0.83rem', color: '#666', marginBottom: 12 }}>
                          Informe o peso jogado de fato no cocho de cada lote e a nota de cocho lida no momento da entrega.
                        </div>
                        <div className={styles.loteTabela}>
                          <table className={styles.tabelaRealizado}>
                            <thead>
                              <tr>
                                <th>Lote</th>
                                <th>Trato</th>
                                <th style={{ textAlign: 'right' }}>Base (fab.)</th>
                                <th style={{ textAlign: 'right', color: '#2e7d32' }}>Entregue no Cocho (kg)</th>
                                <th style={{ textAlign: 'right' }}>Δ</th>
                                <th>Nota Cocho</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batidasDia.filter(b => b.qty_entregue_cocho_kg == null).map(b => {
                                const lote     = lotes.find(l => l.id === b.lot_id);
                                const base     = getBase(b);
                                const rawQty   = entregaInputs[b.id]?.qty_kg ?? '';
                                const entrega  = parseFloat(String(rawQty).replace(',', '.'));
                                const temVal   = !isNaN(entrega) && entrega > 0;
                                const delta    = temVal ? entrega - base : null;
                                const deltaPct = delta != null && base > 0 ? (delta / base) * 100 : null;
                                const corD     = delta == null ? '#aaa' : delta > 0.5 ? '#e65100' : delta < -0.5 ? '#1565c0' : '#2e7d32';
                                const cochoAtual = entregaInputs[b.id]?.cocho_note ?? null;
                                return (
                                  <tr key={b.id}>
                                    <td><strong>{lote?.lot_code || '—'}</strong></td>
                                    <td style={{ fontSize: '0.82rem', color: '#888' }}>{b.batch_type === 'day' ? 'Dia' : b.feeding_order + 'º trato'}</td>
                                    <td style={{ textAlign: 'right', color: '#555' }}>{fmtKg(base)}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <input type="text" inputMode="decimal" value={rawQty}
                                        placeholder={fmtN(base, 2)}
                                        onChange={e => setEntregaInputs(p => ({ ...p, [b.id]: { ...p[b.id], qty_kg: e.target.value } }))}
                                        className={styles.inputRealizado} style={{ width: 120 }} />
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: corD, fontSize: '0.82rem', minWidth: 90 }}>
                                      {delta != null ? (delta >= 0 ? '+' : '') + fmtKg(delta) : '—'}
                                      {deltaPct != null && <span style={{ display: 'block', fontSize: '0.72rem' }}>{(deltaPct >= 0 ? '+' : '') + fmtPct(deltaPct)}</span>}
                                    </td>
                                    <td>
                                      <div className={styles.cochoNotasInline}>
                                        {COCHO_NOTES.map(n => (
                                          <button key={n.nota} type="button"
                                            className={styles.cochoBtnInline + (cochoAtual === n.nota ? ' ' + styles.cochoBtnInlineActive : '')}
                                            style={cochoAtual === n.nota ? { background: n.bgCor, borderColor: n.cor, color: n.cor } : {}}
                                            onClick={() => setEntregaInputs(p => ({
                                              ...p,
                                              [b.id]: { ...p[b.id], cocho_note: p[b.id]?.cocho_note === n.nota ? null : n.nota }
                                            }))}>
                                            {n.label}
                                          </button>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {/* Campo de tolerância configurável */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 8, fontSize: '0.85rem', color: '#555' }}>
                          <span>⚙️ Tolerância para alerta de diferença:</span>
                          <input
                            type="number" min="0" max="100" step="0.5"
                            value={toleranciaEntregaPct}
                            onChange={e => setToleranciaEntregaPct(parseFloat(e.target.value) || 0)}
                            style={{ width: 60, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 6, textAlign: 'center' }}
                          />
                          <span>%</span>
                          <span style={{ marginLeft: 4, color: '#999', fontSize: '0.78rem' }}>(diferença acima deste % abre alerta de ajuste)</span>
                        </div>

                        <div className={styles.formAcoes} style={{ marginTop: 10 }}>
                          <button type="button" className={styles.btnCancelar} onClick={() => setEntregaInputs({})}>Limpar entrega</button>
                          <button type="button" className={styles.btnAdd}
                            onClick={handleSalvarEntregaCocho}
                            disabled={salvandoRealizado || Object.keys(entregaInputs).length === 0}>
                            🐄 2. Confirmar Entrega no Cocho
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          );
        })()}

        {/* ═══ MODAL AJUSTE ENTREGA COCHO ═══ */}
        {modalAjuste && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem 2rem', width: '100%', maxWidth: 560, boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#b71c1c', marginBottom: 4 }}>⚠️ Diferença acima da tolerância</div>
              <div style={{ fontSize: '0.9rem', color: '#555', marginBottom: 16 }}>
                O total entregue é diferente do total fabricado. Verifique os valores e, se estiver correto, selecione a baia que deve absorver a diferença.
              </div>

              {/* Resumo da diferença */}
              <div style={{ background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: '0.88rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                  <div>
                    <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: 2 }}>Total Fabricado</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1565c0' }}>{fmtKg(modalAjuste.totalFab)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: 2 }}>Total Entregue</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#2e7d32' }}>{fmtKg(modalAjuste.totalEntregue)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: 2 }}>Diferença</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: modalAjuste.delta < 0 ? '#b71c1c' : '#e65100' }}>
                      {modalAjuste.delta >= 0 ? '+' : ''}{fmtKg(modalAjuste.delta)}
                      <span style={{ fontSize: '0.75rem', marginLeft: 4 }}>
                        ({modalAjuste.totalFab > 0 ? ((modalAjuste.delta / modalAjuste.totalFab) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detalhes por lote */}
              <div style={{ fontSize: '0.83rem', color: '#555', marginBottom: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px', color: '#888', fontWeight: 600 }}>Lote</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', color: '#888', fontWeight: 600 }}>Fabricado</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', color: '#888', fontWeight: 600 }}>Digitado</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', color: '#888', fontWeight: 600 }}>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalAjuste.batidasDia.map(b => {
                      const lote    = lotes.find(l => l.id === b.lot_id);
                      const fab     = b.qty_realizada_kg != null ? Number(b.qty_realizada_kg) : Number(b.total_qty_kg);
                      const digit   = parseFloat(String(modalAjuste.entregaParaSalvar[b.id]?.qty_kg || '0').replace(',', '.'));
                      const d       = digit - fab;
                      return (
                        <tr key={b.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '5px 8px' }}>
                            <strong>{lote?.lot_code || '—'}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#999', marginLeft: 4 }}>{b.batch_type === 'day' ? 'Dia' : b.feeding_order + 'º trato'}</span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '5px 8px', color: '#1565c0' }}>{fmtKg(fab)}</td>
                          <td style={{ textAlign: 'right', padding: '5px 8px', color: '#2e7d32', fontWeight: 700 }}>{fmtKg(digit)}</td>
                          <td style={{ textAlign: 'right', padding: '5px 8px', color: d < 0 ? '#b71c1c' : d > 0 ? '#e65100' : '#888', fontWeight: 700 }}>
                            {d >= 0 ? '+' : ''}{fmtKg(d)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Seleção da baia para ajuste */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#333', marginBottom: 8 }}>
                  Em qual lote/baia aplicar o ajuste de <strong style={{ color: modalAjuste.delta < 0 ? '#b71c1c' : '#e65100' }}>{modalAjuste.delta >= 0 ? '+' : ''}{fmtKg(modalAjuste.delta)}</strong>?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {modalAjuste.batidasDia.map(b => {
                    const lote    = lotes.find(l => l.id === b.lot_id);
                    const fab     = b.qty_realizada_kg != null ? Number(b.qty_realizada_kg) : Number(b.total_qty_kg);
                    const digit   = parseFloat(String(modalAjuste.entregaParaSalvar[b.id]?.qty_kg || '0').replace(',', '.'));
                    const ajustado = parseFloat((digit - modalAjuste.delta).toFixed(3));
                    const selected = baiaSelecionada === b.id;
                    return (
                      <label key={b.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '2px solid ' + (selected ? '#2e7d32' : '#e0e0e0'), background: selected ? '#e8f5e9' : '#fafafa', cursor: 'pointer' }}>
                        <input type="radio" name="baiaAjuste" value={b.id} checked={selected}
                          onChange={() => setBaiaSelecionada(b.id)} style={{ accentColor: '#2e7d32' }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700 }}>{lote?.lot_code || '—'}</span>
                          <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: 6 }}>{b.batch_type === 'day' ? 'Dia' : b.feeding_order + 'º trato'}</span>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                          <span style={{ color: '#555' }}>{fmtKg(digit)}</span>
                          <span style={{ color: '#aaa', margin: '0 4px' }}>→</span>
                          <span style={{ fontWeight: 700, color: '#2e7d32' }}>{fmtKg(ajustado)}</span>
                          <span style={{ fontSize: '0.72rem', color: '#888', display: 'block' }}>fab: {fmtKg(fab)}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Ações do modal */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button"
                  style={{ padding: '8px 18px', border: '1px solid #ccc', borderRadius: 8, background: '#f5f5f5', cursor: 'pointer', fontSize: '0.9rem' }}
                  onClick={() => { setModalAjuste(null); setBaiaSelecionada(''); }}>
                  ← Voltar e corrigir
                </button>
                <button type="button"
                  style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: '#2e7d32', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, opacity: baiaSelecionada ? 1 : 0.5 }}
                  disabled={!baiaSelecionada || salvandoRealizado}
                  onClick={() => _executarSalvarEntrega(modalAjuste.batidasDia, modalAjuste.entregaParaSalvar, baiaSelecionada, modalAjuste.delta)}>
                  {salvandoRealizado ? 'Salvando...' : '✅ Confirmar com ajuste'}
                </button>
              </div>
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
