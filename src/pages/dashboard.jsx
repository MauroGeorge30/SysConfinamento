import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/layout/Layout';
import styles from '../styles/Dashboard.module.css';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function Dashboard() {
  const router = useRouter();
  const { user, userProfile, currentFarm, loading: authLoading } = useAuth();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  const hoje = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const mesAtual = hoje.substring(0, 7);
      const seteDiasAtras = (() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      })();

      const [
        { data: lotes },
        { data: baias },
        { data: gadoIndividual },
        { data: tratos },
        { data: tratosHoje },
        { data: ocorrencias },
        { data: pesagensLote },
        { data: financeiro },
      ] = await Promise.all([
        supabase.from('lots')
          .select(`id, lot_code, category, head_count, avg_entry_weight, entry_date,
            target_gmd, target_leftover_pct, status, pen_id,
            pens(pen_number),
            lot_phases(id, phase_name, end_date, feed_types(name, dry_matter_pct, cost_per_kg)),
            lot_weighings(id, avg_weight_kg, weighing_date)`)
          .eq('farm_id', currentFarm.id)
          .eq('status', 'active')
          .order('entry_date'),

        supabase.from('pens')
          .select('id, pen_number, capacity, current_occupancy, status, min_feed_kg, max_feed_kg, min_leftover_kg, max_leftover_kg')
          .eq('farm_id', currentFarm.id)
          .eq('status', 'active')
          .order('pen_number'),

        supabase.from('cattle')
          .select('id, status')
          .eq('farm_id', currentFarm.id)
          .eq('status', 'active'),

        supabase.from('feeding_records')
          .select('pen_id, lot_id, quantity_kg, leftover_kg, feeding_date, feed_types(cost_per_kg, dry_matter_pct)')
          .eq('farm_id', currentFarm.id)
          .gte('feeding_date', seteDiasAtras)
          .order('feeding_date', { ascending: false }),

        supabase.from('feeding_records')
          .select('pen_id, lot_id, quantity_kg, leftover_kg, feed_types(cost_per_kg, dry_matter_pct)')
          .eq('farm_id', currentFarm.id)
          .eq('feeding_date', hoje),

        supabase.from('occurrences')
          .select('type, quantity, occurrence_date')
          .eq('farm_id', currentFarm.id)
          .gte('occurrence_date', mesAtual + '-01'),

        supabase.from('lot_weighings')
          .select('lot_id, avg_weight_kg, weighing_date')
          .eq('farm_id', currentFarm.id)
          .order('weighing_date', { ascending: false }),

        supabase.from('financial_records')
          .select('type, amount, record_date')
          .eq('farm_id', currentFarm.id)
          .gte('record_date', mesAtual + '-01'),
      ]);

      // ── Lotes ──────────────────────────────────────────────
      const lotesAtivos = lotes || [];
      const totalCabecas = lotesAtivos.reduce((acc, l) => acc + (l.head_count || 0), 0);
      const totalIndividuais = (gadoIndividual || []).length;
      const totalAnimais = totalCabecas + totalIndividuais;

      const getFaseAtiva = (lote) => {
        const fases = lote.lot_phases || [];
        return fases.find(f => !f.end_date) || fases[fases.length - 1] || null;
      };

      const getUltimaPesagem = (lote) => {
        const pw = (lote.lot_weighings || []).sort((a, b) => new Date(b.weighing_date) - new Date(a.weighing_date));
        return pw[0] || null;
      };

      const getPenultimaPesagem = (lote) => {
        const pw = (lote.lot_weighings || []).sort((a, b) => new Date(b.weighing_date) - new Date(a.weighing_date));
        return pw[1] || null;
      };

      const calcGMD = (lote) => {
        const ult = getUltimaPesagem(lote);
        const pen = getPenultimaPesagem(lote);
        if (ult && pen) {
          const dias = Math.floor((new Date(ult.weighing_date) - new Date(pen.weighing_date)) / 86400000);
          if (dias > 0) return (ult.avg_weight_kg - pen.avg_weight_kg) / dias;
        }
        if (ult && lote.avg_entry_weight && lote.entry_date) {
          const dias = Math.floor((new Date(ult.weighing_date) - new Date(lote.entry_date)) / 86400000);
          if (dias > 0) return (ult.avg_weight_kg - lote.avg_entry_weight) / dias;
        }
        return null;
      };

      // GMD médio de todos os lotes ativos
      const gmds = lotesAtivos.map(l => calcGMD(l)).filter(g => g !== null);
      const gmdMedioLotes = gmds.length > 0 ? gmds.reduce((a, b) => a + b, 0) / gmds.length : null;

      // Dias médios de confinamento
      const diasConf = lotesAtivos.map(l => Math.floor((new Date() - new Date(l.entry_date + 'T00:00:00')) / 86400000));
      const diasMedios = diasConf.length > 0 ? Math.round(diasConf.reduce((a, b) => a + b, 0) / diasConf.length) : 0;

      // ── Tratos de hoje ──────────────────────────────────────
      const th = tratosHoje || [];
      const fornecidoHoje = th.reduce((acc, r) => acc + Number(r.quantity_kg), 0);
      const sobraHoje = th.reduce((acc, r) => acc + Number(r.leftover_kg || 0), 0);
      const consumidoHoje = fornecidoHoje - sobraHoje;
      const sobraPctHoje = fornecidoHoje > 0 ? (sobraHoje / fornecidoHoje) * 100 : null;
      const custoHoje = th.reduce((acc, r) => acc + Number(r.quantity_kg) * Number(r.feed_types?.cost_per_kg || 0), 0);
      const custoPorCabHoje = totalAnimais > 0 && custoHoje > 0 ? custoHoje / totalAnimais : 0;
      const baiasAlimentadasHoje = new Set(th.map(r => r.pen_id)).size;
      const baiasAtivas = (baias || []);
      const baiasSemTrato = baiasAtivas.filter(b => !th.find(t => t.pen_id === b.id));

      // ── Alertas ─────────────────────────────────────────────
      const alertas = [];

      // Baias com lote ativo sem trato hoje
      const lotesComBaiaSemTrato = lotesAtivos.filter(l =>
        l.pen_id && !th.find(t => t.pen_id === l.pen_id)
      );
      if (lotesComBaiaSemTrato.length > 0) {
        alertas.push({
          tipo: 'danger',
          icone: '🚨',
          msg: `${lotesComBaiaSemTrato.length} lote(s) sem trato hoje: ${lotesComBaiaSemTrato.map(l => l.lot_code).join(', ')}`,
          link: '/alimentacao',
        });
      }

      // Tratos de hoje fora dos limites da baia
      const tratosForaLimite = th.filter(t => {
        const baia = (baias || []).find(b => b.id === t.pen_id);
        if (!baia) return false;
        const forn = Number(t.quantity_kg);
        const sobr = Number(t.leftover_kg || 0);
        return (
          (baia.min_feed_kg && forn < Number(baia.min_feed_kg)) ||
          (baia.max_feed_kg && forn > Number(baia.max_feed_kg)) ||
          (t.leftover_kg != null && baia.min_leftover_kg && sobr < Number(baia.min_leftover_kg)) ||
          (t.leftover_kg != null && baia.max_leftover_kg && sobr > Number(baia.max_leftover_kg))
        );
      });
      if (tratosForaLimite.length > 0) {
        const baiasAfetadas = [...new Set(tratosForaLimite.map(t => {
          const b = (baias || []).find(b => b.id === t.pen_id);
          return b ? `Baia ${b.pen_number}` : '';
        }).filter(Boolean))];
        alertas.push({
          tipo: 'danger',
          icone: '🚨',
          msg: `${tratosForaLimite.length} trato(s) fora dos limites hoje: ${baiasAfetadas.join(', ')} — corrija imediatamente`,
          link: '/alimentacao',
        });
      }

      // Sobra fora da meta
      lotesAtivos.forEach(l => {
        if (!l.target_leftover_pct) return;
        const tratosLote = th.filter(t => t.lot_id === l.id);
        if (tratosLote.length === 0) return;
        const fornLote = tratosLote.reduce((a, r) => a + Number(r.quantity_kg), 0);
        const sobrLote = tratosLote.reduce((a, r) => a + Number(r.leftover_kg || 0), 0);
        const pct = fornLote > 0 ? (sobrLote / fornLote) * 100 : null;
        if (pct === null) return;
        const meta = Number(l.target_leftover_pct);
        if (pct > meta * 1.5) {
          alertas.push({ tipo: 'warning', icone: '⚠️', msg: `Lote ${l.lot_code}: sobra alta ${pct.toFixed(1)}% (meta ${meta}%)`, link: '/alimentacao' });
        } else if (pct < 0.5) {
          alertas.push({ tipo: 'warning', icone: '⚠️', msg: `Lote ${l.lot_code}: cocho zerado — risco de compulsão`, link: '/alimentacao' });
        }
      });

      // Lotes sem pesagem nos últimos 14 dias
      const quatorze = new Date(); quatorze.setDate(quatorze.getDate() - 14);
      lotesAtivos.forEach(l => {
        const ult = getUltimaPesagem(l);
        const semPesagem = !ult || new Date(ult.weighing_date) < quatorze;
        if (semPesagem) {
          alertas.push({ tipo: 'info', icone: '⚖️', msg: `Lote ${l.lot_code} sem pesagem há mais de 14 dias`, link: '/pesagens' });
        }
      });

      // ── Ocorrências do mês ──────────────────────────────────
      const oc = ocorrencias || [];
      const mortesmes = oc.filter(o => o.type === 'morte').reduce((a, o) => a + o.quantity, 0);
      const refugoMes = oc.filter(o => o.type === 'refugo').reduce((a, o) => a + o.quantity, 0);

      // ── Financeiro ──────────────────────────────────────────
      const fin = financeiro || [];
      const receitaMes = fin.filter(r => r.type === 'income').reduce((acc, r) => acc + Number(r.amount), 0);
      const despesaMes = fin.filter(r => r.type === 'expense').reduce((acc, r) => acc + Number(r.amount), 0);

      // ── Cards de lotes para o painel ────────────────────────
      const lotesCards = lotesAtivos.map(l => {
        const gmd = calcGMD(l);
        const ultPes = getUltimaPesagem(l);
        const fase = getFaseAtiva(l);
        const dias = Math.floor((new Date() - new Date(l.entry_date + 'T00:00:00')) / 86400000);
        const gmdOk = gmd !== null && l.target_gmd ? gmd >= Number(l.target_gmd) : null;
        // Sobra do último trato deste lote
        const ultimoTrato = (tratos || []).find(t => t.lot_id === l.id);
        const sobraPct = ultimoTrato && Number(ultimoTrato.quantity_kg) > 0 && ultimoTrato.leftover_kg != null
          ? (Number(ultimoTrato.leftover_kg) / Number(ultimoTrato.quantity_kg)) * 100
          : null;
        return { ...l, gmd, ultPes, fase, dias, gmdOk, sobraPct };
      });

      // ── Baias detalhes ──────────────────────────────────────
      const baiasDetalhes = baiasAtivas.map(b => ({
        ...b,
        pct: b.capacity > 0 ? Math.round((b.current_occupancy / b.capacity) * 100) : 0,
        semTratomHoje: !th.find(t => t.pen_id === b.id),
        loteDaBaia: lotesAtivos.find(l => l.pen_id === b.id),
      })).sort((a, b) => b.pct - a.pct);

      setDados({
        lotesAtivos, totalCabecas, totalIndividuais, totalAnimais,
        gmdMedioLotes, diasMedios,
        fornecidoHoje, sobraHoje, consumidoHoje, sobraPctHoje,
        custoHoje, custoPorCabHoje,
        baiasAlimentadasHoje, baiasSemTrato,
        alertas, mortesmes, refugoMes,
        receitaMes, despesaMes, saldoMes: receitaMes - despesaMes,
        baiasDetalhes, lotesCards,
        totalBaias: baiasAtivas.length,
        ocupacaoTotal: baiasAtivas.reduce((a, b) => a + (b.current_occupancy || 0), 0),
        capacidadeTotal: baiasAtivas.reduce((a, b) => a + (b.capacity || 0), 0),
      });

    } catch (error) {
      console.error('Erro dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const hojeFormatado = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <Layout>
      <div className={styles.container}>

        {/* Top Bar */}
        <div className={styles.topBar}>
          <div>
            <h1>Dashboard</h1>
            <p className={styles.sub}>
              {currentFarm?.name} · <span style={{ textTransform: 'capitalize' }}>{hojeFormatado}</span>
            </p>
          </div>
          <button className={styles.btnAtualizar} onClick={loadDados}>↻ Atualizar</button>
        </div>

        {loading ? (
          <p className={styles.vazio}>Carregando dados...</p>
        ) : !dados ? (
          <p className={styles.vazio}>Erro ao carregar.</p>
        ) : (
          <>
            {/* ── ALERTAS ── */}
            {dados.alertas.length > 0 && (
              <div className={styles.alertasBox}>
                {dados.alertas.map((a, i) => (
                  <Link href={a.link} key={i} className={`${styles.alerta} ${styles[`alerta_${a.tipo}`]}`}>
                    <span>{a.icone}</span>
                    <span>{a.msg}</span>
                    <span className={styles.alertaLink}>Ver →</span>
                  </Link>
                ))}
              </div>
            )}

            {/* ── VISÃO GERAL ── */}
            <div className={styles.secaoTitulo}>📊 Visão Geral</div>
            <div className={styles.grid4}>
              <div className={styles.card}>
                <span>Lotes Ativos</span>
                <strong>{dados.lotesAtivos.length}</strong>
                <small>{dados.totalCabecas} cab. em lotes · {dados.totalIndividuais} individuais</small>
              </div>
              <div className={styles.card}>
                <span>Ocupação das Baias</span>
                <strong>{dados.ocupacaoTotal} / {dados.capacidadeTotal}</strong>
                <small>{dados.capacidadeTotal > 0 ? Math.round((dados.ocupacaoTotal / dados.capacidadeTotal) * 100) : 0}% da capacidade</small>
              </div>
              <div className={`${styles.card} ${dados.gmdMedioLotes !== null ? (dados.gmdMedioLotes >= 1.0 ? styles.cardVerde : styles.cardLaranja) : ''}`}>
                <span>GMD Médio (Lotes)</span>
                <strong>{dados.gmdMedioLotes !== null ? `${dados.gmdMedioLotes.toFixed(3)} kg/d` : '—'}</strong>
                <small>Ganho médio diário entre pesagens</small>
              </div>
              <div className={styles.card}>
                <span>Dias Médios Confinados</span>
                <strong>{dados.diasMedios}d</strong>
                <small>Média entre lotes ativos</small>
              </div>
            </div>

            {/* ── TRATO DE HOJE ── */}
            <div className={styles.secaoTitulo}>🌿 Trato de Hoje</div>
            <div className={styles.grid4}>
              <div className={styles.card}>
                <span>Fornecido</span>
                <strong>{dados.fornecidoHoje.toFixed(0)} kg</strong>
                <small>{dados.baiasAlimentadasHoje} de {dados.totalBaias} baias</small>
              </div>
              <div className={`${styles.card} ${
                dados.sobraPctHoje === null ? '' :
                dados.sobraPctHoje > 5 ? styles.cardVermelho :
                dados.sobraPctHoje < 1 ? styles.cardLaranja : styles.cardVerde
              }`}>
                <span>Sobra do Cocho</span>
                <strong>
                  {dados.sobraHoje.toFixed(0)} kg
                  {dados.sobraPctHoje !== null && <span style={{ fontSize: '1rem' }}> · {dados.sobraPctHoje.toFixed(1)}%</span>}
                </strong>
                <small>
                  {dados.sobraPctHoje === null ? 'Sem sobra registrada' :
                   dados.sobraPctHoje > 5 ? '⚠️ Sobra acima do ideal' :
                   dados.sobraPctHoje < 1 ? '⚠️ Cocho zerado' : '✓ Dentro da meta'}
                </small>
              </div>
              <div className={styles.card}>
                <span>Consumido</span>
                <strong>{dados.consumidoHoje.toFixed(0)} kg</strong>
                <small>{dados.totalAnimais > 0 ? `${(dados.consumidoHoje / dados.totalAnimais).toFixed(1)} kg/cab` : '—'}</small>
              </div>
              <div className={styles.card}>
                <span>Custo Alimentação Hoje</span>
                <strong>R$ {dados.custoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                <small>R$ {dados.custoPorCabHoje.toFixed(2)}/cab/dia</small>
              </div>
            </div>

            {/* ── LOTES ATIVOS ── */}
            {dados.lotesCards.length > 0 && (
              <>
                <div className={styles.secaoTitulo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📦 Lotes Ativos</span>
                  <Link href="/lotes" className={styles.linkVerTodos}>Ver todos →</Link>
                </div>
                <div className={styles.lotesGrid}>
                  {dados.lotesCards.map(lote => (
                    <div key={lote.id} className={styles.loteCard}>
                      <div className={styles.loteCardTop}>
                        <div>
                          <div className={styles.loteCodigo}>{lote.lot_code}</div>
                          <div className={styles.loteCategoria}>{lote.category} · {lote.pens?.pen_number ? `Baia ${lote.pens.pen_number}` : 'sem baia'}</div>
                        </div>
                        <div className={styles.loteCabecas}>
                          <strong>{lote.head_count}</strong>
                          <span>cab.</span>
                        </div>
                      </div>

                      <div className={styles.loteIndicadores}>
                        {/* GMD */}
                        <div className={`${styles.loteInd} ${lote.gmdOk === true ? styles.indVerde : lote.gmdOk === false ? styles.indVermelho : ''}`}>
                          <span>GMD</span>
                          <strong>{lote.gmd !== null ? `${lote.gmd.toFixed(3)}` : '—'}</strong>
                          {lote.target_gmd && <small>meta {Number(lote.target_gmd).toFixed(3)}</small>}
                        </div>

                        {/* Sobra % último trato */}
                        <div className={`${styles.loteInd} ${
                          lote.sobraPct === null ? '' :
                          lote.sobraPct > (Number(lote.target_leftover_pct) * 1.5 || 5) ? styles.indVermelho :
                          lote.sobraPct < 0.5 ? styles.indLaranja : styles.indVerde
                        }`}>
                          <span>Sobra</span>
                          <strong>{lote.sobraPct !== null ? `${lote.sobraPct.toFixed(1)}%` : '—'}</strong>
                          {lote.target_leftover_pct && <small>meta {Number(lote.target_leftover_pct).toFixed(1)}%</small>}
                        </div>

                        {/* Peso atual */}
                        <div className={styles.loteInd}>
                          <span>Peso Médio</span>
                          <strong>{lote.ultPes ? `${Number(lote.ultPes.avg_weight_kg).toFixed(0)} kg` : '—'}</strong>
                          {lote.avg_entry_weight && <small>entrada {Number(lote.avg_entry_weight).toFixed(0)} kg</small>}
                        </div>

                        {/* Dias */}
                        <div className={styles.loteInd}>
                          <span>Dias</span>
                          <strong>{lote.dias}d</strong>
                          {lote.fase && <small>{lote.fase.phase_name}</small>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {dados.lotesAtivos.length === 0 && (
              <div className={styles.semLotes}>
                <span>📦</span>
                <p>Nenhum lote ativo. <Link href="/lotes">Cadastrar lote →</Link></p>
              </div>
            )}

            {/* ── BAIAS ── */}
            {dados.baiasDetalhes.length > 0 && (
              <>
                <div className={styles.secaoTitulo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🏠 Ocupação por Baia</span>
                  <Link href="/baias" className={styles.linkVerTodos}>Ver todas →</Link>
                </div>
                <div className={styles.baiasGrid}>
                  {dados.baiasDetalhes.map(b => (
                    <div key={b.id} className={`${styles.baiaCard} ${b.semTratomHoje ? styles.baiaSemTrato : ''}`}>
                      <div className={styles.baiaHeader}>
                        <strong>Baia {b.pen_number}</strong>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {b.semTratomHoje && <span className={styles.badgeSemTrato}>Sem trato</span>}
                          <span className={b.pct >= 90 ? styles.pctAlto : b.pct >= 60 ? styles.pctMedio : styles.pctBaixo}>{b.pct}%</span>
                        </div>
                      </div>
                      <div className={styles.baiaBar}>
                        <div className={`${styles.baiaBarFill} ${b.pct >= 90 ? styles.barVermelho : b.pct >= 60 ? styles.barLaranja : styles.barVerde}`} style={{ width: `${Math.min(b.pct, 100)}%` }} />
                      </div>
                      <div className={styles.baiaInfo}>
                        {b.current_occupancy} / {b.capacity} animais
                        {b.loteDaBaia && <span className={styles.baiaBadgeLote}> · {b.loteDaBaia.lot_code}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── OCORRÊNCIAS + FINANCEIRO ── */}
            <div className={styles.grid2}>
              <div>
                <div className={styles.secaoTitulo}>🚨 Ocorrências — {mesNome}</div>
                <div className={styles.grid2inner}>
                  <div className={`${styles.card} ${dados.mortesmes > 0 ? styles.cardVermelho : ''}`}>
                    <span>Mortes</span>
                    <strong>{dados.mortesmes}</strong>
                    <small>cabeças no mês</small>
                  </div>
                  <div className={`${styles.card} ${dados.refugoMes > 0 ? styles.cardLaranja : ''}`}>
                    <span>Refugos</span>
                    <strong>{dados.refugoMes}</strong>
                    <small>cabeças no mês</small>
                  </div>
                </div>
              </div>
              <div>
                <div className={styles.secaoTitulo}>💰 Financeiro — {mesNome}</div>
                <div className={styles.grid2inner}>
                  <div className={`${styles.card} ${styles.cardVerde}`}>
                    <span>Receitas</span>
                    <strong>R$ {dados.receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className={`${styles.card} ${styles.cardVermelho}`}>
                    <span>Despesas</span>
                    <strong>R$ {dados.despesaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
                <div className={`${styles.card} ${dados.saldoMes >= 0 ? styles.cardAzul : styles.cardVermelho}`} style={{ marginTop: '0.7rem' }}>
                  <span>Saldo do Mês</span>
                  <strong>R$ {dados.saldoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, signDisplay: 'always' })}</strong>
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </Layout>
  );
}
