import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import styles from '../styles/CustoTratos.module.css';

export default function CustoTratos() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();

  const [lotes, setLotes] = useState([]);
  const [loteSelecionado, setLoteSelecionado] = useState('');
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingLotes, setLoadingLotes] = useState(true);
  const [expandedFases, setExpandedFases] = useState({});

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadLotes();
  }, [user, authLoading, currentFarm]);

  const loadLotes = async () => {
    setLoadingLotes(true);
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('id, lot_code, head_count, avg_entry_weight, entry_date, category, status, pens(pen_number)')
        .eq('farm_id', currentFarm.id)
        .in('status', ['active', 'closed'])
        .order('entry_date', { ascending: false });
      if (error) throw error;
      setLotes(data || []);
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoadingLotes(false); }
  };

  const hoje = new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString().split('T')[0];

  const loadDados = async (loteId) => {
    if (!loteId) { setDados(null); return; }
    setLoading(true);
    setDados(null);
    setExpandedFases({});
    try {
      const lote = lotes.find(l => l.id === loteId);
      if (!lote) return;

      const [
        { data: tratos, error: e1 },
        { data: fases,  error: e2 },
        { data: pesagens, error: e3 },
      ] = await Promise.all([
        supabase.from('feeding_records')
          .select('id, feeding_date, quantity_kg, leftover_kg, cost_per_kg, feeding_order, feed_types(name, cost_per_kg, dry_matter_pct)')
          .eq('lot_id', loteId)
          .order('feeding_date', { ascending: true }),
        supabase.from('lot_phases')
          .select('id, phase_name, start_date, end_date, feed_type_id, cms_pct_pv, feed_types(name, dry_matter_pct)')
          .eq('lot_id', loteId)
          .order('start_date', { ascending: true }),
        supabase.from('lot_weighings')
          .select('avg_weight_kg, weighing_date')
          .eq('lot_id', loteId)
          .order('weighing_date', { ascending: false }),
      ]);
      if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;

      // ── Por cada fase, agrupa os tratos que caem no período ──────────────
      const fasesComDados = (fases || []).map((fase, idx) => {
        const inicio = fase.start_date;
        const fim = fase.end_date || hoje; // fase sem fim = até hoje

        const tratosNaFase = (tratos || []).filter(t =>
          t.feeding_date >= inicio && t.feeding_date <= fim
        );

        const totalFornMN   = tratosNaFase.reduce((a, t) => a + Number(t.quantity_kg), 0);
        const totalSobraMN  = tratosNaFase.reduce((a, t) => a + Number(t.leftover_kg || 0), 0);
        const totalConsMN   = totalFornMN - totalSobraMN;
        const totalCusto    = tratosNaFase.reduce((a, t) => {
          const cpk = Number(t.cost_per_kg ?? t.feed_types?.cost_per_kg ?? 0);
          return a + Number(t.quantity_kg) * cpk;
        }, 0);

        const msPct = fase.feed_types?.dry_matter_pct;
        const totalConsMS   = msPct ? totalConsMN * (Number(msPct) / 100) : null;

        const diasFase = Math.max(1, Math.floor(
          (new Date(fim) - new Date(inicio)) / 86400000
        ) + (fase.end_date ? 0 : 0));

        const cabecas = lote.head_count || 1;
        const custoPerCab   = totalCusto / cabecas;
        const fornPerCabDia = diasFase > 0 ? totalFornMN / cabecas / diasFase : 0;
        const consPerCabDia = diasFase > 0 ? totalConsMN / cabecas / diasFase : 0;

        // Status da fase
        const fimTs = fase.end_date ? new Date(fase.end_date) : null;
        const isConcluida = fimTs && fimTs < new Date(hoje);

        return {
          ...fase,
          inicio,
          fim: fase.end_date,
          diasFase,
          tratosNaFase,
          totalFornMN,
          totalSobraMN,
          totalConsMN,
          totalConsMS,
          totalCusto,
          custoPerCab,
          fornPerCabDia,
          consPerCabDia,
          isConcluida,
          msPct,
        };
      });

      // ── Tratos sem fase (antes da primeira fase ou sem fase cadastrada) ──
      const todasDatas = new Set((fases || []).flatMap(f => {
        // gera as datas cobertas (simplificado: filtra depois nos tratos)
        return [];
      }));
      const tratosSemFase = (tratos || []).filter(t =>
        !fasesComDados.some(f => t.feeding_date >= f.inicio && t.feeding_date <= (f.fim || hoje))
      );

      // ── Resumo geral ────────────────────────────────────────────────────
      const totalGeralForn  = (tratos || []).reduce((a, t) => a + Number(t.quantity_kg), 0);
      const totalGeralSobra = (tratos || []).reduce((a, t) => a + Number(t.leftover_kg || 0), 0);
      const totalGeralCons  = totalGeralForn - totalGeralSobra;
      const totalGeralCusto = (tratos || []).reduce((a, t) => {
        const cpk = Number(t.cost_per_kg ?? t.feed_types?.cost_per_kg ?? 0);
        return a + Number(t.quantity_kg) * cpk;
      }, 0);

      const dataEntrada = new Date(lote.entry_date + 'T00:00:00');
      const ultimaPesagem = pesagens && pesagens.length > 0 ? pesagens[0] : null;
      const pesoFinal = ultimaPesagem ? Number(ultimaPesagem.avg_weight_kg) : null;
      const dataRef = ultimaPesagem
        ? new Date(ultimaPesagem.weighing_date + 'T00:00:00')
        : new Date();
      const diasTotal = Math.max(1, Math.floor((dataRef - dataEntrada) / 86400000));
      const gmd = pesoFinal && lote.avg_entry_weight
        ? ((pesoFinal - lote.avg_entry_weight) / diasTotal)
        : null;

      setDados({
        lote,
        fasesComDados,
        tratosSemFase,
        totalGeralForn,
        totalGeralSobra,
        totalGeralCons,
        totalGeralCusto,
        diasTotal,
        pesoFinal,
        gmd,
        totalTratos: (tratos || []).length,
      });

      // Abre todas as fases por padrão
      const exp = {};
      fasesComDados.forEach(f => { exp[f.id] = true; });
      setExpandedFases(exp);

    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  const toggleFase = (id) => setExpandedFases(p => ({ ...p, [id]: !p[id] }));

  const fmt  = (n, dec = 1) => n != null ? Number(n).toFixed(dec) : '—';
  const fmtR = (n) => n != null ? 'R$ ' + Number(n).toFixed(2) : '—';
  const fmtD = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

  const COR_FASE = {
    'Adaptação':  { bg: '#e3f2fd', border: '#1565c0', text: '#1565c0', dot: '#1565c0' },
    'Transição':  { bg: '#fff3e0', border: '#e65100', text: '#e65100', dot: '#e65100' },
    'Terminação': { bg: '#e8f5e9', border: '#2e7d32', text: '#2e7d32', dot: '#2e7d32' },
    'Manutenção': { bg: '#f3e5f5', border: '#6a1b9a', text: '#6a1b9a', dot: '#6a1b9a' },
  };
  const getCor = (nome) => COR_FASE[nome] || { bg: '#f5f5f5', border: '#757575', text: '#555', dot: '#9e9e9e' };

  if (authLoading || !user) return <div>Carregando...</div>;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🌿 Custo de Tratos por Lote</h1>
          <p className={styles.subtitle}>Análise detalhada de consumo e custo por fase de dieta</p>
        </div>

        {/* Seletor de lote */}
        <div className={styles.selectorCard}>
          <label>Selecione o Lote</label>
          <select
            value={loteSelecionado}
            onChange={e => { setLoteSelecionado(e.target.value); loadDados(e.target.value); }}
            disabled={loadingLotes}
          >
            <option value="">— Selecione um lote —</option>
            {lotes.map(l => (
              <option key={l.id} value={l.id}>
                {l.lot_code} — {l.pens?.pen_number ? `Baia ${l.pens.pen_number} — ` : ''}{l.head_count} cab. — {l.status === 'active' ? '🟢 Ativo' : '⚫ Encerrado'}
              </option>
            ))}
          </select>
        </div>

        {loading && <div className={styles.vazio}><p>⏳ Carregando dados...</p></div>}

        {dados && !loading && (() => {
          const { lote, fasesComDados, totalGeralForn, totalGeralSobra, totalGeralCons, totalGeralCusto, diasTotal, pesoFinal, gmd, totalTratos, tratosSemFase } = dados;
          const sobraPctGeral = totalGeralForn > 0 ? (totalGeralSobra / totalGeralForn * 100) : 0;

          return (
            <div>
              {/* ── Card de identificação do lote ── */}
              <div className={styles.loteCard}>
                <div className={styles.loteCardHeader}>
                  <div className={styles.loteInfo}>
                    <div className={styles.loteCode}>{lote.lot_code}</div>
                    <div className={styles.loteMeta}>
                      {lote.pens?.pen_number && <span className={styles.badge} style={{background:'#e3f2fd',color:'#1565c0'}}>🏠 Baia {lote.pens.pen_number}</span>}
                      <span className={styles.badge} style={{background:'#e8f5e9',color:'#2e7d32'}}>🐂 {lote.head_count} cab.</span>
                      <span className={styles.badge} style={{background:'#f3e5f5',color:'#6a1b9a'}}>{lote.category}</span>
                      <span className={styles.badge} style={{background: lote.status === 'active' ? '#e8f5e9' : '#f5f5f5', color: lote.status === 'active' ? '#2e7d32' : '#757575'}}>
                        {lote.status === 'active' ? '🟢 Ativo' : '⚫ Encerrado'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.loteIndicadores}>
                    <div className={styles.indItem}>
                      <span>Entrada</span>
                      <strong>{fmtD(lote.entry_date)}</strong>
                    </div>
                    <div className={styles.indItem}>
                      <span>Dias conf.</span>
                      <strong>{diasTotal}d</strong>
                    </div>
                    <div className={styles.indItem}>
                      <span>Peso entrada</span>
                      <strong>{lote.avg_entry_weight ? `${fmt(lote.avg_entry_weight)} kg` : '—'}</strong>
                    </div>
                    {pesoFinal && (
                      <div className={styles.indItem}>
                        <span>Último peso</span>
                        <strong>{fmt(pesoFinal)} kg</strong>
                      </div>
                    )}
                    {gmd && (
                      <div className={styles.indItem} style={{background:'#e8f5e9'}}>
                        <span>GMD</span>
                        <strong style={{color:'#2e7d32'}}>{fmt(gmd,3)} kg/d</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Totalizadores rápidos */}
                <div className={styles.totaisRapidos}>
                  <div className={styles.totalItem}>
                    <span>Total Fornecido</span>
                    <strong>{fmt(totalGeralForn)} kg</strong>
                  </div>
                  <div className={styles.totalItem}>
                    <span>Total Sobra</span>
                    <strong>{fmt(totalGeralSobra)} kg <em>({fmt(sobraPctGeral)}%)</em></strong>
                  </div>
                  <div className={styles.totalItem}>
                    <span>Total Consumido</span>
                    <strong>{fmt(totalGeralCons)} kg</strong>
                  </div>
                  <div className={styles.totalItem} style={{borderLeftColor:'#1b5e20'}}>
                    <span>Custo Total Tratos</span>
                    <strong style={{color:'#1b5e20'}}>{fmtR(totalGeralCusto)}</strong>
                  </div>
                  <div className={styles.totalItem}>
                    <span>Custo por Cabeça</span>
                    <strong>{fmtR(totalGeralCusto / lote.head_count)}</strong>
                  </div>
                  <div className={styles.totalItem}>
                    <span>Total de Tratos</span>
                    <strong>{totalTratos}</strong>
                  </div>
                </div>
              </div>

              {/* ── Fases ── */}
              {fasesComDados.length === 0 && (
                <div className={styles.avisoSemFase}>
                  ⚠️ Nenhuma fase de dieta cadastrada para este lote. Cadastre as fases em <strong>Lotes → Nova Fase</strong>.
                </div>
              )}

              {fasesComDados.map((fase, idx) => {
                const cor = getCor(fase.phase_name);
                const isOpen = expandedFases[fase.id];
                const sobraPct = fase.totalFornMN > 0 ? (fase.totalSobraMN / fase.totalFornMN * 100) : 0;

                return (
                  <div key={fase.id} className={styles.faseBlock} style={{borderLeftColor: cor.border}}>
                    {/* Cabeçalho da fase — clicável */}
                    <div
                      className={styles.faseHeader}
                      style={{background: cor.bg}}
                      onClick={() => toggleFase(fase.id)}
                    >
                      <div className={styles.faseHeaderLeft}>
                        <span className={styles.faseDot} style={{background: cor.dot}} />
                        <div>
                          <div className={styles.faseNome} style={{color: cor.text}}>
                            {fase.phase_name}
                            <span className={fase.isConcluida ? styles.badgeConcluida : styles.badgeEmProcesso}>
                              {fase.isConcluida ? '✓ Concluída' : '⏳ Em Processo'}
                            </span>
                          </div>
                          <div className={styles.fasePeriodo}>
                            {fmtD(fase.inicio)} → {fase.fim ? fmtD(fase.fim) : <em>em andamento</em>}
                            <span className={styles.faseDias}>{fase.diasFase} dias</span>
                            {fase.feed_types?.name && (
                              <span className={styles.faseRacao}>🌾 {fase.feed_types.name}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* KPIs do cabeçalho */}
                      <div className={styles.faseHeaderKpis}>
                        <div className={styles.kpi}>
                          <span>Tratos</span>
                          <strong>{fase.tratosNaFase.length}</strong>
                        </div>
                        <div className={styles.kpi}>
                          <span>Fornecido</span>
                          <strong>{fmt(fase.totalFornMN)} kg</strong>
                        </div>
                        <div className={styles.kpi}>
                          <span>Consumido</span>
                          <strong>{fmt(fase.totalConsMN)} kg</strong>
                        </div>
                        <div className={styles.kpi}>
                          <span>Sobra</span>
                          <strong style={{color: sobraPct > 5 ? '#c62828' : '#2e7d32'}}>
                            {fmt(fase.totalSobraMN)} kg ({fmt(sobraPct)}%)
                          </strong>
                        </div>
                        <div className={styles.kpi} style={{borderLeft:'2px solid rgba(0,0,0,0.1)', paddingLeft:'12px'}}>
                          <span>Custo Total</span>
                          <strong style={{color: cor.text}}>{fmtR(fase.totalCusto)}</strong>
                        </div>
                        <div className={styles.kpi}>
                          <span>Custo/Cabeça</span>
                          <strong>{fmtR(fase.custoPerCab)}</strong>
                        </div>
                        <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Detalhe expandível */}
                    {isOpen && (
                      <div className={styles.faseBody}>
                        {/* Grid de métricas da fase */}
                        <div className={styles.metricasGrid}>
                          <div className={styles.metricaCard}>
                            <div className={styles.metricaTitulo}>📦 Consumo</div>
                            <table className={styles.metricaTabela}>
                              <tbody>
                                <tr><td>Fornecido total MN</td><td>{fmt(fase.totalFornMN)} kg</td></tr>
                                <tr><td>Sobra total MN</td><td>{fmt(fase.totalSobraMN)} kg ({fmt(sobraPct)}%)</td></tr>
                                <tr className={styles.trDestaque}><td>Consumido MN</td><td><strong>{fmt(fase.totalConsMN)} kg</strong></td></tr>
                                {fase.totalConsMS != null && (
                                  <tr><td>Consumido MS ({fmt(fase.msPct,1)}% MS)</td><td>{fmt(fase.totalConsMS)} kg</td></tr>
                                )}
                                <tr><td>Fornecido/cab/dia</td><td>{fmt(fase.fornPerCabDia,2)} kg</td></tr>
                                <tr><td>Consumido/cab/dia</td><td>{fmt(fase.consPerCabDia,2)} kg</td></tr>
                              </tbody>
                            </table>
                          </div>

                          <div className={styles.metricaCard}>
                            <div className={styles.metricaTitulo}>💰 Custo da Fase</div>
                            <table className={styles.metricaTabela}>
                              <tbody>
                                <tr><td>Custo total alimentar</td><td>{fmtR(fase.totalCusto)}</td></tr>
                                <tr className={styles.trDestaque}><td>Custo por cabeça</td><td><strong>{fmtR(fase.custoPerCab)}</strong></td></tr>
                                <tr><td>Custo/cab/dia</td><td>{fmtR(fase.diasFase > 0 ? fase.custoPerCab / fase.diasFase : 0)}</td></tr>
                                <tr><td>Nº de tratos</td><td>{fase.tratosNaFase.length}</td></tr>
                                <tr><td>Período</td><td>{fase.diasFase} dias</td></tr>
                                <tr><td>Cabeças no lote</td><td>{lote.head_count}</td></tr>
                              </tbody>
                            </table>
                          </div>

                          <div className={styles.metricaCard}>
                            <div className={styles.metricaTitulo}>📅 Participação no Total</div>
                            <table className={styles.metricaTabela}>
                              <tbody>
                                <tr>
                                  <td>% do custo total</td>
                                  <td>{totalGeralCusto > 0 ? fmt(fase.totalCusto / totalGeralCusto * 100, 1) + '%' : '—'}</td>
                                </tr>
                                <tr>
                                  <td>% do consumo total</td>
                                  <td>{totalGeralCons > 0 ? fmt(fase.totalConsMN / totalGeralCons * 100, 1) + '%' : '—'}</td>
                                </tr>
                                <tr>
                                  <td>% dos dias</td>
                                  <td>{diasTotal > 0 ? fmt(fase.diasFase / diasTotal * 100, 1) + '%' : '—'}</td>
                                </tr>
                                <tr>
                                  <td>Ração</td>
                                  <td>{fase.feed_types?.name || '—'}</td>
                                </tr>
                                {fase.feed_types?.dry_matter_pct && (
                                  <tr><td>MS%</td><td>{fase.feed_types.dry_matter_pct}%</td></tr>
                                )}
                                {fase.cms_pct_pv && (
                                  <tr><td>CMS meta % PV</td><td>{fase.cms_pct_pv}%</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Tabela de tratos da fase */}
                        {fase.tratosNaFase.length > 0 ? (
                          <div className={styles.tratosSection}>
                            <div className={styles.tratosHeader}>
                              <strong>Registros de Tratos — {fase.phase_name}</strong>
                              <span>{fase.tratosNaFase.length} registro(s)</span>
                            </div>
                            <div className={styles.tabelaWrapper}>
                              <table className={styles.tabelaTratos}>
                                <thead>
                                  <tr>
                                    <th>Data</th>
                                    <th>Trato</th>
                                    <th>Ração</th>
                                    <th>Fornecido</th>
                                    <th>Sobra</th>
                                    <th>Sobra%</th>
                                    <th>Consumido</th>
                                    <th>Custo/kg</th>
                                    <th>Custo Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {fase.tratosNaFase.map(t => {
                                    const forn = Number(t.quantity_kg);
                                    const sobra = Number(t.leftover_kg || 0);
                                    const cons = forn - sobra;
                                    const sp = forn > 0 && t.leftover_kg != null ? (sobra / forn * 100) : null;
                                    const cpk = Number(t.cost_per_kg ?? t.feed_types?.cost_per_kg ?? 0);
                                    const custo = forn * cpk;
                                    return (
                                      <tr key={t.id}>
                                        <td>{fmtD(t.feeding_date)}</td>
                                        <td><span className={styles.tratoBadge}>{t.feeding_order || 1}º</span></td>
                                        <td style={{fontSize:'0.83rem',color:'#555'}}>{t.feed_types?.name || '—'}</td>
                                        <td>{fmt(forn)} kg</td>
                                        <td>{t.leftover_kg != null ? `${fmt(sobra)} kg` : <span style={{color:'#bbb'}}>—</span>}</td>
                                        <td>
                                          {sp != null ? (
                                            <span className={styles.sobraBadge} style={{
                                              background: sp > 5 ? '#ffebee' : sp < 1 ? '#fff8e1' : '#e8f5e9',
                                              color: sp > 5 ? '#c62828' : sp < 1 ? '#f57c00' : '#2e7d32',
                                            }}>{fmt(sp)}%</span>
                                          ) : '—'}
                                        </td>
                                        <td>{fmt(cons)} kg</td>
                                        <td style={{fontSize:'0.82rem',color:'#888'}}>R$ {cpk.toFixed(4)}</td>
                                        <td><strong>R$ {custo.toFixed(2)}</strong></td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan={3}><strong>TOTAL DA FASE</strong></td>
                                    <td><strong>{fmt(fase.totalFornMN)} kg</strong></td>
                                    <td><strong>{fmt(fase.totalSobraMN)} kg</strong></td>
                                    <td><strong>{fmt(sobraPct)}%</strong></td>
                                    <td><strong>{fmt(fase.totalConsMN)} kg</strong></td>
                                    <td>—</td>
                                    <td><strong style={{color:'#1b5e20'}}>R$ {fase.totalCusto.toFixed(2)}</strong></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.semTratos}>Nenhum trato registrado neste período.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Tratos sem fase */}
              {tratosSemFase.length > 0 && (
                <div className={styles.faseBlock} style={{borderLeftColor:'#9e9e9e'}}>
                  <div className={styles.faseHeader} style={{background:'#f5f5f5'}}>
                    <div className={styles.faseHeaderLeft}>
                      <span className={styles.faseDot} style={{background:'#9e9e9e'}} />
                      <div>
                        <div className={styles.faseNome} style={{color:'#555'}}>
                          Sem fase cadastrada
                          <span className={styles.badgeCinza}>⚠️ Sem fase</span>
                        </div>
                        <div className={styles.fasePeriodo}>Tratos fora do período de qualquer fase</div>
                      </div>
                    </div>
                    <div className={styles.faseHeaderKpis}>
                      <div className={styles.kpi}><span>Tratos</span><strong>{tratosSemFase.length}</strong></div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Resumo comparativo entre fases ── */}
              {fasesComDados.length > 1 && (
                <div className={styles.resumoCard}>
                  <div className={styles.resumoTitulo}>📊 Comparativo entre Fases</div>
                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabelaResumo}>
                      <thead>
                        <tr>
                          <th>Fase</th>
                          <th>Ração</th>
                          <th>Período</th>
                          <th>Dias</th>
                          <th>Tratos</th>
                          <th>Fornecido</th>
                          <th>Consumido</th>
                          <th>Sobra%</th>
                          <th>Custo Total</th>
                          <th>Custo/Cab</th>
                          <th>Custo/Cab/Dia</th>
                          <th>% Custo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fasesComDados.map(fase => {
                          const cor = getCor(fase.phase_name);
                          const sobraPct = fase.totalFornMN > 0 ? (fase.totalSobraMN / fase.totalFornMN * 100) : 0;
                          return (
                            <tr key={fase.id}>
                              <td>
                                <span className={styles.faseTag} style={{background: cor.bg, color: cor.text, borderColor: cor.border}}>
                                  {fase.phase_name}
                                </span>
                              </td>
                              <td style={{fontSize:'0.82rem',color:'#555'}}>{fase.feed_types?.name || '—'}</td>
                              <td style={{fontSize:'0.82rem',color:'#777',whiteSpace:'nowrap'}}>
                                {fmtD(fase.inicio)} → {fase.fim ? fmtD(fase.fim) : 'atual'}
                              </td>
                              <td style={{textAlign:'center'}}>{fase.diasFase}d</td>
                              <td style={{textAlign:'center'}}>{fase.tratosNaFase.length}</td>
                              <td>{fmt(fase.totalFornMN)} kg</td>
                              <td>{fmt(fase.totalConsMN)} kg</td>
                              <td>
                                <span style={{
                                  background: sobraPct > 5 ? '#ffebee' : '#e8f5e9',
                                  color: sobraPct > 5 ? '#c62828' : '#2e7d32',
                                  padding:'1px 6px', borderRadius:'8px', fontSize:'0.82rem', fontWeight:600,
                                }}>{fmt(sobraPct)}%</span>
                              </td>
                              <td><strong>{fmtR(fase.totalCusto)}</strong></td>
                              <td>{fmtR(fase.custoPerCab)}</td>
                              <td>{fmtR(fase.diasFase > 0 ? fase.custoPerCab / fase.diasFase : 0)}</td>
                              <td style={{textAlign:'center'}}>
                                <strong style={{color: cor.text}}>
                                  {totalGeralCusto > 0 ? fmt(fase.totalCusto / totalGeralCusto * 100, 1) + '%' : '—'}
                                </strong>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5}><strong>TOTAL GERAL</strong></td>
                          <td><strong>{fmt(totalGeralForn)} kg</strong></td>
                          <td><strong>{fmt(totalGeralCons)} kg</strong></td>
                          <td>
                            <span style={{background:'#f0f0f0',padding:'1px 6px',borderRadius:'8px',fontSize:'0.82rem',fontWeight:600}}>
                              {fmt(sobraPctGeral)}%
                            </span>
                          </td>
                          <td><strong style={{color:'#1b5e20'}}>{fmtR(totalGeralCusto)}</strong></td>
                          <td><strong>{fmtR(totalGeralCusto / lote.head_count)}</strong></td>
                          <td><strong>{fmtR(diasTotal > 0 ? totalGeralCusto / lote.head_count / diasTotal : 0)}</strong></td>
                          <td><strong>100%</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {!dados && !loading && !loteSelecionado && (
          <div className={styles.vazio}>
            <p style={{fontSize:'2rem'}}>🌿</p>
            <p>Selecione um lote para visualizar o custo de tratos por fase.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
