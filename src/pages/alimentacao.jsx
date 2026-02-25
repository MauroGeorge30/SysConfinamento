import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Alimentacao.module.css';

export default function Alimentacao() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canDelete, isViewer } = usePermissions();

  const [registros, setRegistros] = useState([]);
  const [baias, setBaias] = useState([]);
  const [racoes, setRacoes] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [pesagens, setPesagens] = useState([]);
  const [batidasVagao, setBatidasVagao] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba]         = useState('individual');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Estado do modo em lote
  const [tratoLoteData, setTratoLoteData]   = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [tratoLoteOrdem, setTratoLoteOrdem] = useState(1);
  const [tratoLinhas, setTratoLinhas]       = useState({});
  const [salvandoLote, setSalvandoLote]     = useState(false);
  const [filtroBaia, setFiltroBaia] = useState('');
  const [filtroData, setFiltroData] = useState('');
  const [expandedBaias, setExpandedBaias] = useState({});
  const [alturaTabela, setAlturaTabela] = useState(410); // ~10 linhas

  const toggleBaia = (penId) => {
    setExpandedBaias(prev => ({ ...prev, [penId]: !prev[penId] }));
  };

  // Detecta a fase do lote em uma data específica
  const getFasePorData = (lotId, data) => {
    const lote = lotes.find(l => l.id === lotId);
    if (!lote || !lote.lot_phases) return null;
    return lote.lot_phases.find(f => {
      const inicio = f.start_date;
      const fim = f.end_date;
      return data >= inicio && (!fim || data <= fim);
    }) || null;
  };

  // Calculado uma única vez fora do ciclo de render para não causar loops em useEffect
  const [hoje] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

  const [formData, setFormData] = useState({
    pen_id: '', lot_id: '', feed_type_id: '',
    quantity_kg: '', leftover_kg: '', feeding_date: hoje, notes: '', feeding_order: 1,
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: regData, error: regError }, { data: baiasData }, { data: racoesData }, { data: lotesData }, { data: pesagensData }, { data: batidasData }] = await Promise.all([
        supabase.from('feeding_records')
          .select('*, pens(pen_number), feed_types(name, cost_per_kg, dry_matter_pct), lots(lot_code)')
          .eq('farm_id', currentFarm.id)
          .order('feeding_date', { ascending: false })
          .limit(200),
        supabase.from('pens').select('id, pen_number, min_feed_kg, max_feed_kg, min_leftover_kg, max_leftover_kg').eq('farm_id', currentFarm.id).eq('status', 'active').order('pen_number'),
        supabase.from('feed_types').select('id, name, cost_per_kg, dry_matter_pct').eq('farm_id', currentFarm.id).order('name'),
        supabase.from('lots').select('id, lot_code, pen_id, head_count, avg_entry_weight, entry_date, target_gmd, carcass_yield_pct, daily_feeding_count, lot_phases(id, phase_name, start_date, end_date, feed_types(name))').eq('farm_id', currentFarm.id).eq('status', 'active').order('lot_code'),
        supabase.from('lot_weighings').select('id, lot_id, weighing_date, avg_weight_kg').eq('farm_id', currentFarm.id).order('weighing_date', { ascending: false }),
        supabase.from('wagon_batches').select('id, lot_id, feed_type_id, batch_date, batch_type, feeding_order, total_qty_kg, qty_realizada_kg').eq('farm_id', currentFarm.id).order('batch_date', { ascending: false }),
      ]);
      if (regError) throw regError;
      setRegistros(regData || []);
      setBaias(baiasData || []);
      setRacoes(racoesData || []);
      setLotes(lotesData || []);
      setPesagens(pesagensData || []);
      setBatidasVagao(batidasData || []);
    } catch (error) {
      alert('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ pen_id: '', lot_id: '', feed_type_id: '', quantity_kg: '', leftover_kg: '', feeding_date: hoje, notes: '', feeding_order: 1 });
    setEditingId(null);
    setShowForm(false);
  };

  // Busca o próximo número de trato da baia na data selecionada
  const detectarProximoTrato = async (penId, data) => {
    if (!penId || !data) return 1;
    try {
      const { data: existentes } = await supabase
        .from('feeding_records')
        .select('feeding_order')
        .eq('pen_id', penId)
        .eq('feeding_date', data)
        .eq('farm_id', currentFarm.id);
      if (!existentes || existentes.length === 0) return 1;
      const max = Math.max(...existentes.map(r => r.feeding_order || 1));
      return max + 1;
    } catch { return 1; }
  };

  // Detecta ração da fase ativa
  const getRacaoDaFase = (lotId, data) => {
    const lote = lotes.find(l => l.id === lotId);
    if (!lote) return '';
    const fase = (lote.lot_phases || []).find(f =>
      data >= f.start_date && (!f.end_date || data <= f.end_date)
    );
    return fase?.feed_types?.id || '';
  };

  // Ao selecionar baia → filtra e auto-preenche lote da baia
  const handleBaiaChange = async (penId) => {
    const lotesNaBaia = lotes.filter(l => l.pen_id === penId);
    const loteAuto    = lotesNaBaia.length === 1 ? lotesNaBaia[0].id : '';
    const proximoTrato = await detectarProximoTrato(penId, formData.feeding_date);
    const feedTypeId   = loteAuto ? getRacaoDaFase(loteAuto, formData.feeding_date) : '';
    setFormData(prev => ({ ...prev, pen_id: penId, lot_id: loteAuto, feeding_order: proximoTrato, feed_type_id: feedTypeId || prev.feed_type_id }));
  };

  // Ao selecionar lote → auto-preenche baia e ração da fase
  const handleLoteChange = async (lotId) => {
    const lote       = lotes.find(l => l.id === lotId);
    const penId      = lote?.pen_id || formData.pen_id;
    const proximoTrato = await detectarProximoTrato(penId, formData.feeding_date);
    const feedTypeId = getRacaoDaFase(lotId, formData.feeding_date);
    setFormData(prev => ({ ...prev, lot_id: lotId, pen_id: penId, feeding_order: proximoTrato, feed_type_id: feedTypeId || prev.feed_type_id }));
  };

  // Ao mudar a data → recalcula trato e atualiza ração da fase
  const handleDataChange = async (novaData) => {
    const proximoTrato = formData.pen_id ? await detectarProximoTrato(formData.pen_id, novaData) : 1;
    const feedTypeId   = formData.lot_id ? getRacaoDaFase(formData.lot_id, novaData) : '';
    setFormData(prev => ({ ...prev, feeding_date: novaData, feeding_order: proximoTrato, feed_type_id: feedTypeId || prev.feed_type_id }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.pen_id) return alert('Selecione uma baia.');
    if (!formData.feed_type_id) return alert('Selecione o tipo de ração.');
    if (!formData.quantity_kg || isNaN(formData.quantity_kg)) return alert('Quantidade inválida.');
    if (formData.leftover_kg && parseFloat(formData.leftover_kg) > parseFloat(formData.quantity_kg)) {
      return alert('❌ Sobra não pode ser maior que o fornecido.');
    }

    // Verificar se existe batida de vagão para este lote/data/trato
    if (formData.lot_id && !editingId) {
      const { data: batidas } = await supabase
        .from('wagon_batches')
        .select('id, batch_type, feeding_order')
        .eq('farm_id', currentFarm.id)
        .eq('lot_id', formData.lot_id)
        .eq('batch_date', formData.feeding_date);

      const ordemAtual = formData.feeding_order || 1;
      const temBatida = (batidas || []).some(b =>
        b.batch_type === 'day' ||
        (b.batch_type === 'feeding' && b.feeding_order === ordemAtual)
      );
      if (!temBatida) {
        return alert(`❌ Batida de Vagão não encontrada.\n\nRegistre a batida para o lote ${lotes.find(l=>l.id===formData.lot_id)?.lot_code || ''} — ${ordemAtual}º trato em ${new Date(formData.feeding_date+'T00:00:00').toLocaleDateString('pt-BR')} antes de registrar o trato.`);
      }
    }

    setLoading(true);
    try {
      const racaoAtual = racoes.find(r => r.id === formData.feed_type_id);
      const payload = {
        pen_id: formData.pen_id,
        lot_id: formData.lot_id || null,
        feed_type_id: formData.feed_type_id,
        quantity_kg: parseFloat(formData.quantity_kg),
        leftover_kg: formData.leftover_kg ? parseFloat(formData.leftover_kg) : null,
        feeding_date: formData.feeding_date,
        feeding_order: formData.feeding_order || 1,
        notes: formData.notes || null,
        farm_id: currentFarm.id,
        registered_by: user.id,
        cost_per_kg: racaoAtual ? Number(racaoAtual.cost_per_kg) : null, // travado no momento do registro
      };
      if (editingId) {
        const { error } = await supabase.from('feeding_records').update(payload).eq('id', editingId);
        if (error) throw error;
        alert('✅ Trato atualizado!');
      } else {
        const { error } = await supabase.from('feeding_records').insert([payload]);
        if (error) throw error;
        alert('✅ Trato registrado!');
      }
      resetForm();
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja remover este registro?')) return;
    try {
      const { error } = await supabase.from('feeding_records').delete().eq('id', id);
      if (error) throw error;
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  const handleEdit = (r) => {
    setFormData({
      pen_id: r.pen_id || '',
      lot_id: r.lot_id || '',
      feed_type_id: r.feed_type_id || '',
      quantity_kg: r.quantity_kg || '',
      leftover_kg: r.leftover_kg ?? '',
      feeding_date: r.feeding_date || hoje,
      feeding_order: r.feeding_order || 1,
      notes: r.notes || '',
    });
    setEditingId(r.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  // Preview de cálculos no formulário
  const racaoSelecionada = racoes.find(r => r.id === formData.feed_type_id);
  const baiaAtual = baias.find(b => b.id === formData.pen_id);
  const loteAtual = lotes.find(l => l.id === formData.lot_id);
  const qtd = parseFloat(formData.quantity_kg) || 0;
  const sob = parseFloat(formData.leftover_kg) || 0;
  const consumido = qtd > sob ? qtd - sob : 0;
  const sobraPct = qtd > 0 && sob > 0 ? ((sob / qtd) * 100).toFixed(1) : null;
  const cabHoje = loteAtual?.head_count || 0;
  const consumidoPorCab = cabHoje > 0 ? (consumido / cabHoje).toFixed(2) : null;
  const msPct = racaoSelecionada?.dry_matter_pct;
  const consumidoMS = msPct && consumidoPorCab ? ((parseFloat(consumidoPorCab) * msPct) / 100).toFixed(3) : null;
  const custoKgMS = msPct ? (Number(racaoSelecionada.cost_per_kg) / (msPct / 100)) : null;
  const diariaCab = consumidoMS && custoKgMS ? (parseFloat(consumidoMS) * custoKgMS).toFixed(2) : null;

  // Cálculo de MN sugerido
  const calcMNSugerido = () => {
    if (!loteAtual || !racaoSelecionada) return null;
    const msPvPct = parseFloat(loteAtual.carcass_yield_pct);
    const msDietaPct = parseFloat(racaoSelecionada.dry_matter_pct);
    const gmd = parseFloat(loteAtual.target_gmd) || 0;
    const headCount = parseInt(loteAtual.head_count) || 0;
    const feedingsPerDay = parseInt(loteAtual.daily_feeding_count) || 1;
    if (!msPvPct || !msDietaPct || !headCount) return null;

    // Peso base: última pesagem anterior à data do trato, ou peso de entrada
    const dataRef = formData.feeding_date || new Date().toISOString().slice(0, 10);
    const pesagensDoLote = pesagens
      .filter(p => p.lot_id === loteAtual.id && p.weighing_date <= dataRef)
      .sort((a, b) => b.weighing_date.localeCompare(a.weighing_date));

    let pesoBase, dataBase;
    if (pesagensDoLote.length > 0) {
      pesoBase = parseFloat(pesagensDoLote[0].avg_weight_kg);
      dataBase = pesagensDoLote[0].weighing_date;
    } else {
      pesoBase = parseFloat(loteAtual.avg_entry_weight) || 0;
      dataBase = loteAtual.entry_date;
    }
    if (!pesoBase || !dataBase) return null;

    // Dias decorridos desde o peso base até a data do trato
    const dias = Math.max(0, Math.floor((new Date(dataRef) - new Date(dataBase)) / 86400000));
    const pesoEstimado = pesoBase + (dias * gmd);

    // Consumo MS/cab = Peso × (MS%PV / 100)
    const msCab = pesoEstimado * (msPvPct / 100);
    // Consumo MN/cab = MS/cab / (MS%dieta / 100)
    const mnCab = msCab / (msDietaPct / 100);
    // Total lote
    const mnTotalDia = mnCab * headCount;

    // Sobra do dia anterior para este lote
    const dataAnterior = new Date(dataRef);
    dataAnterior.setDate(dataAnterior.getDate() - 1);
    const dataAnteriorStr = dataAnterior.toISOString().slice(0, 10);
    const sobraDiaAnterior = registros
      .filter(r => r.lot_id === loteAtual.id && r.feeding_date === dataAnteriorStr && r.leftover_kg)
      .reduce((acc, r) => acc + Number(r.leftover_kg), 0);

    // MN ajustado = total - sobra anterior, dividido pelos tratos
    const mnAjustadoDia = Math.max(0, mnTotalDia - sobraDiaAnterior);
    const mnPorTrato = mnAjustadoDia / feedingsPerDay;

    return { pesoEstimado, msCab, mnCab, mnTotalDia, mnAjustadoDia, mnPorTrato, feedingsPerDay, dias, sobraDiaAnterior, dataBase: pesagensDoLote.length > 0 ? 'pesagem' : 'entrada' };
  };
  // Busca batida de vagão para lote/data/trato atual
  const batidaAtual = (() => {
    if (!formData.lot_id || !formData.feeding_date) return null;
    const ordem = formData.feeding_order || 1;
    return batidasVagao.find(b =>
      b.lot_id === formData.lot_id &&
      b.batch_date === formData.feeding_date &&
      (b.batch_type === 'day' || (b.batch_type === 'feeding' && b.feeding_order === ordem))
    ) || null;
  })();

  // Sugestão: usa realizado da batida se existir, senão previsto, senão cálculo
  const sugestao = (() => {
    if (batidaAtual) {
      const temRealizado  = batidaAtual.qty_realizada_kg != null;
      const total         = Number(temRealizado ? batidaAtual.qty_realizada_kg : batidaAtual.total_qty_kg);
      const feedingsPerDay = parseInt(loteAtual?.daily_feeding_count) || 1;
      const mnPorTrato    = batidaAtual.batch_type === 'day' ? total / feedingsPerDay : total;
      return { mnPorTrato, fromBatida: true, temRealizado, batidaTotal: total, batch_type: batidaAtual.batch_type, feedingsPerDay };
    }
    return calcMNSugerido();
  })();

  // Alertas de limites
  const alertas = [];
  if (baiaAtual && qtd > 0) {
    if (baiaAtual.min_feed_kg && qtd < Number(baiaAtual.min_feed_kg))
      alertas.push({ tipo: 'warn', msg: `⚠️ Fornecido abaixo do mínimo (mín: ${Number(baiaAtual.min_feed_kg).toFixed(0)} kg)` });
    if (baiaAtual.max_feed_kg && qtd > Number(baiaAtual.max_feed_kg))
      alertas.push({ tipo: 'erro', msg: `🚨 Fornecido acima do máximo (máx: ${Number(baiaAtual.max_feed_kg).toFixed(0)} kg)` });
  }
  if (baiaAtual && sob > 0) {
    if (baiaAtual.min_leftover_kg && sob < Number(baiaAtual.min_leftover_kg))
      alertas.push({ tipo: 'warn', msg: `⚠️ Sobra abaixo do mínimo (mín: ${Number(baiaAtual.min_leftover_kg).toFixed(0)} kg)` });
    if (baiaAtual.max_leftover_kg && sob > Number(baiaAtual.max_leftover_kg))
      alertas.push({ tipo: 'erro', msg: `🚨 Sobra acima do máximo (máx: ${Number(baiaAtual.max_leftover_kg).toFixed(0)} kg)` });
  }

  const registrosFiltrados = registros.filter((r) => {
    const baiaMatch = !filtroBaia || r.pen_id === filtroBaia;
    const dataMatch = !filtroData || r.feeding_date === filtroData;
    return baiaMatch && dataMatch;
  });

  const registrosHoje = registros.filter(r => r.feeding_date === hoje);
  const totalFornecidoHoje = registrosHoje.reduce((acc, r) => acc + Number(r.quantity_kg), 0);
  const totalSobraHoje = registrosHoje.reduce((acc, r) => acc + Number(r.leftover_kg || 0), 0);
  const totalConsumoHoje = totalFornecidoHoje - totalSobraHoje;
  const sobraPctHoje = totalFornecidoHoje > 0 ? ((totalSobraHoje / totalFornecidoHoje) * 100).toFixed(1) : null;
  const totalCustoHoje = registrosHoje.reduce((acc, r) => acc + (Number(r.quantity_kg) * Number(r.cost_per_kg ?? r.feed_types?.cost_per_kg ?? 0)), 0);
  const baiasAlimentadasHoje = new Set(registrosHoje.map(r => r.pen_id)).size;

  // ── Modo em lote: inicializa linhas ──────────────────────────
  useEffect(() => {
    if (aba !== 'lote' || !lotes.length) return;
    setTratoLinhas(prev => {
      const novo = {};
      lotes.forEach(l => {
        // Batida para esse lote/data/ordem
        const batida = batidasVagao.find(b =>
          b.lot_id === l.id && b.batch_date === tratoLoteData &&
          (b.batch_type === 'day' || (b.batch_type === 'feeding' && b.feeding_order === tratoLoteOrdem))
        );
        const feedingsPerDay = parseInt(l.daily_feeding_count) || 1;
        // Usa realizado se disponível, senão previsto
        const qtdBase = batida
          ? Number(batida.qty_realizada_kg ?? batida.total_qty_kg)
          : 0;
        const qtyKg = batida
          ? (batida.batch_type === 'day' ? qtdBase / feedingsPerDay : qtdBase)
          : '';
        const feedTypeId = batida?.feed_type_id || prev[l.id]?.feed_type_id || '';
        const penId      = l.pen_id || prev[l.id]?.pen_id || '';
        novo[l.id] = {
          checked:      prev[l.id]?.checked !== undefined ? prev[l.id].checked : !!batida,
          feed_type_id: feedTypeId,
          pen_id:       penId,
          quantity_kg:  qtyKg.toString(),  // sempre refresh da batida ao mudar data/ordem
          leftover_kg:  '',
          temBatida:    !!batida,
          usouRealizado: batida?.qty_realizada_kg != null,
        };
      });
      return novo;
    });
  }, [aba, tratoLoteData, tratoLoteOrdem, lotes.length, batidasVagao.length]);

  // ── Auto-detecta próximo trato (conta feeding_records já existentes) ──
  useEffect(() => {
    if (aba !== 'lote' || !registros.length) return;
    const maxExistente = lotes.reduce((max, l) => {
      const ex = registros.filter(r => r.lot_id === l.id && r.feeding_date === tratoLoteData);
      const m  = ex.length ? Math.max(...ex.map(r => r.feeding_order || 1)) : 0;
      return Math.max(max, m);
    }, 0);
    setTratoLoteOrdem(maxExistente + 1);
  }, [aba, tratoLoteData, registros.length]);

  const handleSalvarTratoLote = async () => {
    const selecionados = lotes.filter(l => tratoLinhas[l.id]?.checked);
    if (!selecionados.length) return alert('Selecione ao menos um lote.');
    const semBatida = selecionados.filter(l => !tratoLinhas[l.id]?.temBatida);
    if (semBatida.length) {
      return alert(`Lotes sem Batida de Vagão para esta data/trato:\n${semBatida.map(l => l.lot_code).join(', ')}\n\nRegistre as batidas primeiro.`);
    }
    const invalidos = selecionados.filter(l => !tratoLinhas[l.id]?.feed_type_id || !parseFloat(tratoLinhas[l.id]?.quantity_kg));
    if (invalidos.length) return alert(`Lotes sem ração ou quantidade:\n${invalidos.map(l => l.lot_code).join(', ')}`);

    setSalvandoLote(true);
    try {
      const payloads = selecionados.map(l => {
        const d    = tratoLinhas[l.id];
        const racao = racoes.find(r => r.id === d.feed_type_id);
        return {
          farm_id:       currentFarm.id,
          lot_id:        l.id,
          pen_id:        d.pen_id || l.pen_id || null,
          feed_type_id:  d.feed_type_id,
          quantity_kg:   parseFloat(d.quantity_kg),
          leftover_kg:   d.leftover_kg ? parseFloat(d.leftover_kg) : null,
          feeding_date:  tratoLoteData,
          feeding_order: tratoLoteOrdem,
          farm_id:       currentFarm.id,
          registered_by: user.id,
          cost_per_kg:   racao ? Number(racao.cost_per_kg) : null,
        };
      });
      const { error } = await supabase.from('feeding_records').insert(payloads);
      if (error) throw error;
      alert(`✅ ${payloads.length} trato(s) registrado(s)!`);
      loadDados();
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setSalvandoLote(false); }
  };

  const toggleTodosTratos = (val) => setTratoLinhas(prev => {
    const novo = { ...prev };
    lotes.forEach(l => { if (novo[l.id]) novo[l.id] = { ...novo[l.id], checked: val }; });
    return novo;
  });

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🌿 Tratos Diários</h1>
          {aba === 'individual' && canCreate('feeding_records') && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm && !editingId ? 'Cancelar' : '+ Registrar Trato'}
            </button>
          )}
        </div>

        {/* Abas */}
        <div className={styles.abas}>
          <button className={`${styles.aba} ${aba === 'individual' ? styles.abaAtiva : ''}`} onClick={() => { setAba('individual'); setShowForm(false); }}>📋 Individual</button>
          <button className={`${styles.aba} ${aba === 'lote' ? styles.abaAtiva : ''}`} onClick={() => setAba('lote')}>⚡ Todos os Lotes</button>
        </div>

        {aba === 'individual' && (<>

        {/* Resumo do dia */}
        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <span>Baias com Trato Hoje</span>
            <strong>{baiasAlimentadasHoje}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Fornecido Hoje</span>
            <strong>{Number(totalFornecidoHoje).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} kg</strong>
          </div>
          <div className={styles.resumoCard} style={{ borderLeftColor: totalSobraHoje > 0 ? '#f57c00' : '#2e7d32' }}>
            <span>Sobra Hoje</span>
            <strong style={{ color: totalSobraHoje > 0 ? '#f57c00' : '#2e7d32' }}>
              {Number(totalSobraHoje).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} kg
              {sobraPctHoje && <span style={{ fontSize: '0.85rem' }}> ({sobraPctHoje}%)</span>}
            </strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Custo Hoje</span>
            <strong>R$ {totalCustoHoje.toFixed(2)}</strong>
          </div>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className={styles.formCard}>
            <h2>{editingId ? '✏️ Editar Trato' : '➕ Registrar Trato'}</h2>
            {racoes.length === 0 && (
              <div className={styles.aviso}>⚠️ Nenhuma ração cadastrada. Cadastre em <strong>Rações</strong> primeiro.</div>
            )}
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Data *</label>
                  <input type="date" value={formData.feeding_date}
                    onChange={(e) => handleDataChange(e.target.value)} required />
                </div>
                <div>
                  <label>Baia *</label>
                  <select value={formData.pen_id} onChange={(e) => handleBaiaChange(e.target.value)} required>
                    <option value="">Selecione a baia</option>
                    {baias.map(b => <option key={b.id} value={b.id}>Baia {b.pen_number}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Lote</label>
                  <select value={formData.lot_id} onChange={(e) => handleLoteChange(e.target.value)}>
                    <option value="">— Sem lote —</option>
                    {(formData.pen_id
                      ? lotes.filter(l => l.pen_id === formData.pen_id)
                      : lotes
                    ).map(l => <option key={l.id} value={l.id}>{l.lot_code} ({l.head_count} cab.)</option>)}
                  </select>
                </div>
                <div>
                  <label>Nº do Trato no Dia</label>
                  <div className={styles.tratoOrdemBox}>
                    <span className={styles.tratoOrdemNum}>{formData.feeding_order}º Trato</span>
                    <div className={styles.tratoOrdemBtns}>
                      <button type="button" onClick={() => setFormData(p => ({ ...p, feeding_order: Math.max(1, p.feeding_order - 1) }))}>−</button>
                      <button type="button" onClick={() => setFormData(p => ({ ...p, feeding_order: p.feeding_order + 1 }))}>+</button>
                    </div>
                    <span className={styles.tratoOrdemInfo}>
                      {formData.pen_id
                        ? `(detectado automaticamente pela baia e data)`
                        : `(selecione a baia para detecção automática)`}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Ração *
                    {formData.lot_id && (() => {
                      const lote = lotes.find(l => l.id === formData.lot_id);
                      const fase = (lote?.lot_phases || []).find(f =>
                        formData.feeding_date >= f.start_date && (!f.end_date || formData.feeding_date <= f.end_date)
                      );
                      return fase ? <span style={{ marginLeft: 8, background: '#e8f5e9', color: '#2e7d32', padding: '1px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600 }}>Fase: {fase.phase_name}</span> : null;
                    })()}
                  </label>
                  <select value={formData.feed_type_id} onChange={(e) => setFormData({ ...formData, feed_type_id: e.target.value })} required>
                    <option value="">Selecione a ração</option>
                    {racoes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} — R$ {Number(r.cost_per_kg).toFixed(2)}/kg {r.dry_matter_pct ? `| MS: ${r.dry_matter_pct}%` : '⚠️ sem MS%'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Sugestão de MN — batida de vagão ou cálculo */}
              {sugestao && (
                <div style={{ background: sugestao.fromBatida ? '#e8f5e9' : '#f0f7f0', border: `1px solid ${sugestao.fromBatida ? '#66bb6a' : '#a5d6a7'}`, borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '0.5rem', fontSize: '0.82rem', color: '#2e7d32' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      {sugestao.fromBatida ? (
                        <>
                          <strong>🚜 Batida de Vagão: {Number(sugestao.mnPorTrato).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} kg</strong>
                          {sugestao.temRealizado
                            ? <span style={{ marginLeft: 8, background: '#c8e6c9', color: '#1b5e20', padding: '1px 7px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>✅ baseado no REALIZADO</span>
                            : <span style={{ marginLeft: 8, background: '#fff3e0', color: '#e65100', padding: '1px 7px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>⏳ baseado no PREVISTO — lance o realizado na batida</span>
                          }
                          {sugestao.batch_type === 'day' && sugestao.feedingsPerDay > 1 && (
                            <span style={{ color: '#555', marginLeft: '0.5rem' }}>
                              (total {Number(sugestao.batidaTotal).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} kg ÷ {sugestao.feedingsPerDay} tratos)
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <strong>🌿 MN sugerido: {Number(sugestao.mnPorTrato).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} kg</strong>
                          {sugestao.feedingsPerDay > 1 && (
                            <span style={{ color: '#555', marginLeft: '0.5rem' }}>
                              ({sugestao.feedingsPerDay} tratos/dia — total {Number(sugestao.mnAjustadoDia).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} kg)
                            </span>
                          )}
                          <div style={{ color: '#555', marginTop: '2px' }}>
                            Peso est. {Number(sugestao.pesoEstimado).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} kg ({sugestao.dias}d) → MS {Number(sugestao.msCab).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} kg/cab → MN base {Number(sugestao.mnTotalDia).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} kg/dia
                          </div>
                          {sugestao.sobraDiaAnterior > 0 && (
                            <div style={{ color: '#e65100', marginTop: '2px', fontWeight: 500 }}>
                              ⚠️ Sobra de ontem: -{Number(sugestao.sobraDiaAnterior).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} kg → ajustado: {Number(sugestao.mnAjustadoDia).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} kg
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <button type="button"
                      onClick={() => setFormData(p => ({ ...p, quantity_kg: Number(sugestao.mnPorTrato).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) }))}
                      style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.35rem 0.85rem', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      Usar sugestão
                    </button>
                  </div>
                </div>
              )}
              <div className={styles.row}>
                <div>
                  <label>Fornecido MN (kg) *</label>
                  <input type="number" value={formData.quantity_kg} onChange={(e) => setFormData({ ...formData, quantity_kg: e.target.value })} placeholder="Ex: 3200" step="0.1" min="0" required />
                </div>
                <div>
                  <label>Sobra MN (kg) <span style={{ color: '#888', fontWeight: 400 }}>— leitura do cocho</span></label>
                  <input type="number" value={formData.leftover_kg} onChange={(e) => setFormData({ ...formData, leftover_kg: e.target.value })} placeholder="Ex: 96" step="0.1" min="0" />
                </div>
              </div>

              {/* Alertas de limites da baia */}
              {alertas.length > 0 && (
                <div className={styles.alertasBox}>
                  {alertas.map((a, i) => (
                    <div key={i} className={a.tipo === 'erro' ? styles.alertaErro : styles.alertaWarn}>
                      {a.msg}
                    </div>
                  ))}
                </div>
              )}

              {/* Preview de indicadores */}
              {qtd > 0 && (
                <div className={styles.previewCusto}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#555' }}>Consumido MN</div>
                      <strong>{consumido.toFixed(1)} kg</strong>
                    </div>
                    {sobraPct && (
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#555' }}>Sobra %</div>
                        <strong style={{ color: parseFloat(sobraPct) > 5 ? '#c62828' : '#2e7d32' }}>{sobraPct}%</strong>
                      </div>
                    )}
                    {consumidoPorCab && (
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#555' }}>Consumido/cab</div>
                        <strong>{consumidoPorCab} kg MN</strong>
                      </div>
                    )}
                    {consumidoMS && (
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#555' }}>CMS/cab</div>
                        <strong>{consumidoMS} kg MS</strong>
                      </div>
                    )}
                    {diariaCab && (
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#555' }}>Diária R$/cab</div>
                        <strong style={{ color: '#1565c0' }}>R$ {diariaCab}</strong>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#555' }}>Custo total</div>
                      <strong>R$ {(qtd * (racaoSelecionada?.cost_per_kg || 0)).toFixed(2)}</strong>
                    </div>
                  </div>
                  {!msPct && racaoSelecionada && (
                    <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#f57c00' }}>
                      ⚠️ Ração sem MS% — cadastre MS% em Rações para calcular CMS e Diária R$/cab
                    </div>
                  )}
                </div>
              )}

              <div className={styles.row} style={{ marginTop: '0.5rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Observações</label>
                  <input type="text" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Ex: Chuva, lama no cocho, atraso no trato..." />
                </div>
              </div>

              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                <button type="submit" disabled={loading}>{loading ? 'Salvando...' : editingId ? 'Atualizar Trato' : 'Registrar Trato'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Filtros */}
        <div className={styles.filtros}>
          <input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} className={styles.inputData} title="Filtrar por data" />
          <select value={filtroBaia} onChange={(e) => setFiltroBaia(e.target.value)}>
            <option value="">Todas as baias</option>
            {baias.map(b => <option key={b.id} value={b.id}>Baia {b.pen_number}</option>)}
          </select>
          {(filtroBaia || filtroData) && (
            <button className={styles.btnLimpar} onClick={() => { setFiltroBaia(''); setFiltroData(''); }}>✕ Limpar filtros</button>
          )}
        </div>

        {/* Tabela agrupada por baia */}
        {loading ? <p className={styles.vazio}>Carregando...</p> :
          registrosFiltrados.length === 0 ? <p className={styles.vazio}>Nenhum registro encontrado.</p> : (() => {
            // Agrupa registros por baia
            const grupos = {};
            registrosFiltrados.forEach(r => {
              const key = r.pen_id || 'sem-baia';
              if (!grupos[key]) grupos[key] = { pen: r.pens, registros: [] };
              grupos[key].registros.push(r);
            });
            // Ordena registros de cada grupo por trato decrescente
            Object.values(grupos).forEach(g => {
              g.registros.sort((a, b) => {
                if (b.feeding_date !== a.feeding_date) return b.feeding_date.localeCompare(a.feeding_date);
                return (b.feeding_order || 1) - (a.feeding_order || 1);
              });
            });

            // Função de renderização de linha de trato
            const renderLinha = (r) => {
              const fornecido = Number(r.quantity_kg);
              const sobra = Number(r.leftover_kg || 0);
              const consumidoR = fornecido - sobra;
              const sobraP = fornecido > 0 && r.leftover_kg != null ? ((sobra / fornecido) * 100).toFixed(1) : null;
              const custo = fornecido * Number(r.cost_per_kg ?? r.feed_types?.cost_per_kg ?? 0);
              const baia = baias.find(b => b.id === r.pen_id);
              const foraNosLimites = baia && (
                (baia.min_feed_kg && fornecido < Number(baia.min_feed_kg)) ||
                (baia.max_feed_kg && fornecido > Number(baia.max_feed_kg)) ||
                (r.leftover_kg != null && baia.min_leftover_kg && sobra < Number(baia.min_leftover_kg)) ||
                (r.leftover_kg != null && baia.max_leftover_kg && sobra > Number(baia.max_leftover_kg))
              );
              return (
                <tr key={r.id} className={foraNosLimites ? styles.linhaAlerta : ''}>
                  <td>{foraNosLimites && <span className={styles.alertaIcone} title="Trato fora dos limites">⚠️</span>}{new Date(r.feeding_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td><span className={styles.tratoOrdemBadge}>{r.feeding_order || 1}º</span></td>
                  <td style={{ fontSize: '0.85rem', color: '#555' }}>{r.lots?.lot_code || '—'}</td>
                  <td>{r.feed_types?.name || '—'}</td>
                  <td>{fornecido.toFixed(1)} kg</td>
                  <td>{r.leftover_kg != null ? `${sobra.toFixed(1)} kg` : <span style={{ color: '#aaa' }}>—</span>}</td>
                  <td>
                    {sobraP != null ? (
                      <span style={{
                        background: parseFloat(sobraP) > 5 ? '#ffebee' : parseFloat(sobraP) < 1 ? '#fff8e1' : '#e8f5e9',
                        color: parseFloat(sobraP) > 5 ? '#c62828' : parseFloat(sobraP) < 1 ? '#f57c00' : '#2e7d32',
                        padding: '2px 8px', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem'
                      }}>
                        {sobraP}%
                      </span>
                    ) : <span style={{ color: '#aaa' }}>—</span>}
                  </td>
                  <td>{consumidoR.toFixed(1)} kg</td>
                  <td>R$ {custo.toFixed(2)}</td>
                  {canDelete('feeding_records') && (
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className={styles.btnEditar} onClick={() => handleEdit(r)}>Editar</button>
                        <button className={styles.btnDeletar} onClick={() => handleDelete(r.id)}>Deletar</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            };

            // Função de resumo de uma lista de registros
            const calcResumo = (regs) => {
              const forn = regs.reduce((acc, r) => acc + Number(r.quantity_kg), 0);
              const sobra = regs.reduce((acc, r) => acc + Number(r.leftover_kg || 0), 0);
              const cons = forn - sobra;
              const custo = regs.reduce((acc, r) => acc + Number(r.quantity_kg) * Number(r.cost_per_kg ?? r.feed_types?.cost_per_kg ?? 0), 0);
              const sobraPct = forn > 0 && sobra > 0 ? ((sobra / forn) * 100).toFixed(1) : null;
              return { forn, sobra, cons, custo, sobraPct };
            };

            return (
              <div className={styles.gruposWrapper}>
                {Object.entries(grupos).sort((a, b) => {
                  const nA = a[1].pen?.pen_number || "";
                  const nB = b[1].pen?.pen_number || "";
                  return nA.localeCompare(nB, "pt-BR", { numeric: true, sensitivity: "base" });
                }).map(([penId, grupo]) => {
                  const resumoTotal = calcResumo(grupo.registros);
                  const cabecas = grupo.registros.reduce((max, r) => {
                    const lote = lotes.find(l => l.id === r.lot_id);
                    return lote?.head_count > max ? lote.head_count : max;
                  }, 0);
                  const isExpanded = expandedBaias[penId] === true; // retraído por padrão

                  // Agrupa registros por fase dentro da baia
                  const faseMap = {};
                  grupo.registros.forEach(r => {
                    const fase = getFasePorData(r.lot_id, r.feeding_date);
                    const faseKey = fase ? `${fase.phase_name}|||${fase.id}` : 'sem-fase|||';
                    const faseLbl = fase ? fase.phase_name : 'Sem fase';
                    const faseRacao = fase?.feed_types?.name || null;
                    const faseInicio = fase?.start_date || null;
                    const faseFim = fase?.end_date || null;
                    const fimFaseTs = fase?.end_date ? new Date(fase.end_date) : null;
                    const faseAtiva = fase && !(fimFaseTs && fimFaseTs < new Date(hoje));
                    if (!faseMap[faseKey]) faseMap[faseKey] = { label: faseLbl, racao: faseRacao, inicio: faseInicio, fim: faseFim, ativa: faseAtiva, registros: [] };
                    faseMap[faseKey].registros.push(r);
                  });

                  // Ordena fases: ativa primeiro, depois por data de início decrescente
                  const fasesOrdenadas = Object.entries(faseMap).sort((a, b) => {
                    if (a[1].ativa && !b[1].ativa) return -1;
                    if (!a[1].ativa && b[1].ativa) return 1;
                    return (b[1].inicio || '') > (a[1].inicio || '') ? 1 : -1;
                  });

                  const temMultiFases = fasesOrdenadas.length > 1;

                  return (
                    <div key={penId} className={styles.grupoCard}>
                      {/* Cabeçalho colapsável da baia */}
                      <div className={styles.grupoCabecalho} onClick={() => toggleBaia(penId)} style={{ cursor: 'pointer' }}>
                        <div className={styles.grupoCabecalhoLeft}>
                          <span className={styles.expandToggle}>{isExpanded ? '▼' : '▶'}</span>
                          <strong>Baia {grupo.pen?.pen_number || '—'}</strong>
                          {cabecas > 0 && <span className={styles.cabecasBadge}>{cabecas} cabeças</span>}
                          {!isExpanded && temMultiFases && <span className={styles.faseBadgeHeader}>
                            {fasesOrdenadas.length} fase(s)
                          </span>}
                        </div>
                        <div className={styles.grupoCabecalhoRight}>
                          <div className={styles.grupoStat}>
                            <span>Fornecido</span>
                            <strong>{resumoTotal.forn.toFixed(1)} kg</strong>
                          </div>
                          <div className={styles.grupoStat}>
                            <span>Sobra</span>
                            <strong style={{ color: resumoTotal.sobraPct && parseFloat(resumoTotal.sobraPct) > 5 ? '#f87171' : '#86efac' }}>
                              {resumoTotal.sobra.toFixed(1)} kg
                              {resumoTotal.sobraPct && <em> ({resumoTotal.sobraPct}%)</em>}
                            </strong>
                          </div>
                          <div className={styles.grupoStat}>
                            <span>Consumido</span>
                            <strong>{resumoTotal.cons.toFixed(1)} kg</strong>
                          </div>
                          <div className={styles.grupoStat}>
                            <span>Custo Total</span>
                            <strong className={styles.custoDest}>R$ {resumoTotal.custo.toFixed(2)}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Conteúdo colapsável */}
                      {isExpanded && (
                        <div>
                          {fasesOrdenadas.map(([faseKey, faseGrupo]) => {
                            const resumoFase = calcResumo(faseGrupo.registros);
                            const isConcluida = faseGrupo.fim && new Date(faseGrupo.fim) < new Date(hoje);
                            const corFase = faseGrupo.ativa ? '#e65100' : '#2e7d32';
                            const bgFase = faseGrupo.ativa ? '#fff8f0' : '#f0faf0';

                            return (
                              <div key={faseKey}>
                                {/* Sub-cabeçalho de fase */}
                                <div className={styles.faseCabecalho} style={{ borderLeftColor: corFase, background: bgFase }}>
                                  <div className={styles.faseCabecalhoLeft}>
                                    {faseGrupo.ativa
                                      ? <span className={styles.faseBadgeEmProcesso}>⏳ Em Processo</span>
                                      : <span className={styles.faseBadgeConcluida}>✓ Concluída</span>
                                    }
                                    <strong style={{ color: corFase }}>{faseGrupo.label}</strong>
                                    {faseGrupo.racao && <span className={styles.faseRacaoLabel}>{faseGrupo.racao}</span>}
                                    {faseGrupo.inicio && (
                                      <span className={styles.fasePeriodo}>
                                        {new Date(faseGrupo.inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        {faseGrupo.fim ? ` → ${new Date(faseGrupo.fim + 'T12:00:00').toLocaleDateString('pt-BR')}` : ' → atual'}
                                      </span>
                                    )}
                                  </div>
                                  <div className={styles.faseCabecalhoRight}>
                                    <div className={styles.faseStat}>
                                      <span>Tratos</span>
                                      <strong>{faseGrupo.registros.length}</strong>
                                    </div>
                                    <div className={styles.faseStat}>
                                      <span>Fornecido</span>
                                      <strong>{resumoFase.forn.toFixed(1)} kg</strong>
                                    </div>
                                    <div className={styles.faseStat}>
                                      <span>Sobra</span>
                                      <strong>{resumoFase.sobra.toFixed(1)} kg{resumoFase.sobraPct ? ` (${resumoFase.sobraPct}%)` : ''}</strong>
                                    </div>
                                    <div className={styles.faseStat}>
                                      <span>Consumido</span>
                                      <strong>{resumoFase.cons.toFixed(1)} kg</strong>
                                    </div>
                                    <div className={styles.faseStat}>
                                      <span>Custo Fase</span>
                                      <strong>R$ {resumoFase.custo.toFixed(2)}</strong>
                                    </div>
                                  </div>
                                </div>

                                {/* Tabela dos tratos da fase — estilo planilha */}
                                <div className={styles.tabelaPlHeader}>
                                  <span className={styles.tabelaPlCount}>{faseGrupo.registros.length} registro(s)</span>
                                  <label className={styles.tabelaPlLabel}>
                                    Altura:
                                    <select
                                      className={styles.tabelaPlSelect}
                                      value={alturaTabela}
                                      onChange={e => setAlturaTabela(Number(e.target.value))}
                                    >
                                      <option value={410}>10 linhas</option>
                                      <option value={820}>20 linhas</option>
                                      <option value={1230}>30 linhas</option>
                                      <option value={99999}>Todas</option>
                                    </select>
                                  </label>
                                </div>
                                <div
                                  className={styles.tabelaScrollBox}
                                  style={{ maxHeight: alturaTabela === 99999 ? 'none' : `${alturaTabela}px` }}
                                >
                                  <table className={styles.tabela}>
                                    <thead>
                                      <tr>
                                        <th>Data</th>
                                        <th>Trato</th>
                                        <th>Lote</th>
                                        <th>Ração</th>
                                        <th>Fornecido</th>
                                        <th>Sobra</th>
                                        <th>Sobra%</th>
                                        <th>Consumido</th>
                                        <th>Custo</th>
                                        {canDelete('feeding_records') && <th>Ações</th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {faseGrupo.registros.map(r => renderLinha(r))}
                                    </tbody>
                                  </table>
                                </div>
                                <div className={styles.tabelaPlRodape}>
                                  <span className={styles.tabelaPlRodapeLabel}>TOTAL DA FASE</span>
                                  <div className={styles.tabelaPlRodapeTotais}>
                                    <span><em>Forn:</em> {resumoFase.forn.toFixed(1)} kg</span>
                                    <span><em>Sobra:</em> {resumoFase.sobra.toFixed(1)} kg{resumoFase.sobraPct ? ` (${resumoFase.sobraPct}%)` : ''}</span>
                                    <span><em>Cons:</em> {resumoFase.cons.toFixed(1)} kg</span>
                                    <strong>R$ {resumoFase.custo.toFixed(2)}</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Rodapé total geral */}
                <div className={styles.totalGeral}>
                  <span>Total geral ({registrosFiltrados.length} registros)</span>
                  <div className={styles.grupoCabecalhoRight}>
                    <div className={styles.grupoStat}>
                      <span>Fornecido</span>
                      <strong>{registrosFiltrados.reduce((acc, r) => acc + Number(r.quantity_kg), 0).toFixed(1)} kg</strong>
                    </div>
                    <div className={styles.grupoStat}>
                      <span>Sobra</span>
                      <strong>{registrosFiltrados.reduce((acc, r) => acc + Number(r.leftover_kg || 0), 0).toFixed(1)} kg</strong>
                    </div>
                    <div className={styles.grupoStat}>
                      <span>Consumido</span>
                      <strong>{registrosFiltrados.reduce((acc, r) => acc + Number(r.quantity_kg) - Number(r.leftover_kg || 0), 0).toFixed(1)} kg</strong>
                    </div>
                    <div className={styles.grupoStat}>
                      <span>Custo Total</span>
                      <strong className={styles.custoDest}>R$ {registrosFiltrados.reduce((acc, r) => acc + Number(r.quantity_kg) * Number(r.cost_per_kg ?? r.feed_types?.cost_per_kg ?? 0), 0).toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        }

        {/* Fecha aba individual */}
        </>)}

        {/* ═══ ABA TODOS OS LOTES ═══ */}
        {aba === 'lote' && (
          <div className={styles.formCard}>
            <div className={styles.loteControles}>
              <div className={styles.loteControlesRow}>
                <div>
                  <label>Data</label>
                  <input type="date" value={tratoLoteData} onChange={e => setTratoLoteData(e.target.value)} className={styles.inputData} />
                </div>
                <div>
                  <label>Nº do Trato</label>
                  <div className={styles.tratoOrdemBox}>
                    <span className={styles.tratoOrdemNum}>{tratoLoteOrdem}º Trato</span>
                    <div className={styles.tratoOrdemBtns}>
                      <button type="button" onClick={() => setTratoLoteOrdem(o => Math.max(1, o - 1))}>−</button>
                      <button type="button" onClick={() => setTratoLoteOrdem(o => o + 1)}>+</button>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <button type="button" className={styles.btnSecundario} onClick={() => toggleTodosTratos(true)}>Marcar todos</button>
                  <button type="button" className={styles.btnSecundario} onClick={() => toggleTodosTratos(false)}>Desmarcar</button>
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
                    <th>Batida</th>
                    <th>Ração</th>
                    <th>Fornecido MN (kg)</th>
                    <th>Sobra MN (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map(l => {
                    const d = tratoLinhas[l.id];
                    if (!d) return null;
                    return (
                      <tr key={l.id} className={d.checked ? styles.linhaChecked : styles.linhaUnchecked}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={d.checked}
                            onChange={e => setTratoLinhas(p => ({ ...p, [l.id]: { ...p[l.id], checked: e.target.checked } }))} />
                        </td>
                        <td><strong>{l.lot_code}</strong></td>
                        <td>{l.head_count}</td>
                        <td>
                          {d.temBatida
                            ? <span style={{ display:'flex', flexDirection:'column', gap:1 }}>
                                <span style={{ color: '#2e7d32', fontWeight: 700, fontSize: '0.85rem' }}>✅ OK</span>
                                <span style={{ fontSize: '0.72rem', color: d.usouRealizado ? '#2e7d32' : '#e65100', fontWeight: 600 }}>
                                  {d.usouRealizado ? 'realizado' : '⏳ previsto'}
                                </span>
                              </span>
                            : <span style={{ color: '#c62828', fontSize: '0.85rem' }}>⚠️ Sem batida</span>
                          }
                        </td>
                        <td>
                          <select value={d.feed_type_id} disabled={!d.checked} className={styles.selectInline}
                            onChange={e => setTratoLinhas(p => ({ ...p, [l.id]: { ...p[l.id], feed_type_id: e.target.value } }))}>
                            <option value="">— Selecione —</option>
                            {racoes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <input type="number" value={d.quantity_kg} step="0.1" min="0" disabled={!d.checked}
                            className={styles.inputInline}
                            onChange={e => setTratoLinhas(p => ({ ...p, [l.id]: { ...p[l.id], quantity_kg: e.target.value } }))} />
                        </td>
                        <td>
                          <input type="number" value={d.leftover_kg} step="0.1" min="0" disabled={!d.checked}
                            className={styles.inputInline} placeholder="Opcional"
                            onChange={e => setTratoLinhas(p => ({ ...p, [l.id]: { ...p[l.id], leftover_kg: e.target.value } }))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ padding: '10px 12px', fontWeight: 700 }}>
                      Total ({lotes.filter(l => tratoLinhas[l.id]?.checked).length} lotes)
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <strong style={{ color: '#2e7d32' }}>
                        {lotes.filter(l => tratoLinhas[l.id]?.checked).reduce((acc, l) => acc + (parseFloat(tratoLinhas[l.id]?.quantity_kg) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                      </strong>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className={styles.formAcoes}>
              <span style={{ fontSize: '0.85rem', color: '#888' }}>
                {lotes.filter(l => tratoLinhas[l.id]?.checked).length} lote(s) selecionado(s)
              </span>
              <button type="button" className={styles.btnAdd} onClick={handleSalvarTratoLote} disabled={salvandoLote}>
                {salvandoLote ? 'Salvando...' : `💾 Registrar ${lotes.filter(l => tratoLinhas[l.id]?.checked).length} Trato(s)`}
              </button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
