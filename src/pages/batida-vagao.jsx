import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/BatidaVagao.module.css';

const COCHO_NOTES = [
  { nota: 0, label: 'Nota 0',  desc: 'Cocho zerado',     cor: '#c62828', bgCor: '#ffebee', sinal: +1 },
  { nota: 1, label: 'Nota 1',  desc: 'Resíduo ideal',    cor: '#2e7d32', bgCor: '#e8f5e9', sinal:  0 },
  { nota: 2, label: 'Nota 2',  desc: 'Sobra moderada',   cor: '#e65100', bgCor: '#fff3e0', sinal: -1 },
  { nota: 3, label: 'Nota 3',  desc: 'Sobra excessiva',  cor: '#6a1b9a', bgCor: '#f3e5f5', sinal: -2 },
];

export default function BatidaVagao() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canDelete } = usePermissions();

  const hoje = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [batidas, setBatidas]       = useState([]);
  const [lotes, setLotes]           = useState([]);
  const [racoes, setRacoes]         = useState([]);
  const [pesagens, setPesagens]     = useState([]);
  const [feedingRecs, setFeedingRecs] = useState([]);
  const [compositions, setCompositions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [filtroData, setFiltroData] = useState(hoje);
  const [filtroLote, setFiltroLote] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const [form, setForm] = useState({
    lot_id: '', feed_type_id: '', batch_date: hoje,
    batch_type: 'feeding', feeding_order: 1,
    total_qty_kg: '', cocho_note: null, notes: '',
  });

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
        { data: feedingData },
        { data: compData },
      ] = await Promise.all([
        supabase.from('wagon_batches')
          .select('*')
          .eq('farm_id', currentFarm.id)
          .order('batch_date', { ascending: false })
          .order('feeding_order', { ascending: true }),
        supabase.from('lots')
          .select('id, lot_code, pen_id, head_count, avg_entry_weight, entry_date, target_gmd, carcass_yield_pct, daily_feeding_count, lot_phases(id, phase_name, start_date, end_date, feed_types(name))')
          .eq('farm_id', currentFarm.id).eq('status', 'active').order('lot_code'),
        supabase.from('feed_types')
          .select('id, name, cost_per_kg, dry_matter_pct')
          .eq('farm_id', currentFarm.id).order('name'),
        supabase.from('lot_weighings')
          .select('id, lot_id, weighing_date, avg_weight_kg')
          .eq('farm_id', currentFarm.id).order('weighing_date', { ascending: false }),
        supabase.from('feeding_records')
          .select('id, lot_id, feeding_date, feeding_order, leftover_kg')
          .eq('farm_id', currentFarm.id).order('feeding_date', { ascending: false }).limit(200),
        supabase.from('feed_compositions')
          .select('*, feed_composition_items(*, feed_ingredients(id, name, unit, dry_matter_pct))')
          .eq('farm_id', currentFarm.id).eq('is_current', true),
      ]);
      setBatidas(batidasData || []);
      setLotes(lotesData || []);
      setRacoes(racoesData || []);
      setPesagens(pesagensData || []);
      setFeedingRecs(feedingData || []);
      setCompositions(compData || []);
    } catch (e) {
      alert('Erro ao carregar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Calcula peso estimado e MN base ─────────────────────────
  const calcMNBase = (lote, racao, dataRef) => {
    if (!lote || !racao) return null;
    const msPvPct   = parseFloat(lote.carcass_yield_pct);
    const msDietaPct = parseFloat(racao.dry_matter_pct);
    const gmd        = parseFloat(lote.target_gmd) || 0;
    const headCount  = parseInt(lote.head_count) || 0;
    if (!msPvPct || !msDietaPct || !headCount) return null;

    const pesagensLote = pesagens
      .filter(p => p.lot_id === lote.id && p.weighing_date <= dataRef)
      .sort((a, b) => b.weighing_date.localeCompare(a.weighing_date));

    let pesoBase, dataBase;
    if (pesagensLote.length > 0) {
      pesoBase  = parseFloat(pesagensLote[0].avg_weight_kg);
      dataBase  = pesagensLote[0].weighing_date;
    } else {
      pesoBase = parseFloat(lote.avg_entry_weight) || 0;
      dataBase = lote.entry_date;
    }
    if (!pesoBase || !dataBase) return null;

    const dias         = Math.max(0, Math.floor((new Date(dataRef) - new Date(dataBase)) / 86400000));
    const pesoEstimado = pesoBase + (dias * gmd);
    const msCab        = pesoEstimado * (msPvPct / 100);
    const mnCab        = msCab / (msDietaPct / 100);
    const mnTotalDia   = mnCab * headCount;

    return { pesoEstimado, msCab, mnCab, mnTotalDia, dias, headCount };
  };

  // Ajuste de nota de cocho: 0.450 kg × cabeças × sinal
  const calcAjusteCocho = (nota, headCount) => {
    const entry = COCHO_NOTES.find(n => n.nota === nota);
    if (!entry || entry.sinal === 0) return 0;
    return entry.sinal * 0.450 * headCount;
  };

  // ── Sugestão ao selecionar lote/ração/data ───────────────────
  const loteAtual  = lotes.find(l => l.id === form.lot_id);
  const racaoAtual = racoes.find(r => r.id === form.feed_type_id);
  const feedingsPerDay = parseInt(loteAtual?.daily_feeding_count) || 1;

  const mnBase = form.lot_id && form.feed_type_id
    ? calcMNBase(loteAtual, racaoAtual, form.batch_date)
    : null;

  const ajusteCocho = form.cocho_note !== null && loteAtual
    ? calcAjusteCocho(form.cocho_note, parseInt(loteAtual.head_count) || 0)
    : 0;

  const mnSugeridoDia   = mnBase ? Math.max(0, mnBase.mnTotalDia + ajusteCocho) : 0;
  const mnSugeridoTrato = form.batch_type === 'feeding'
    ? mnSugeridoDia / feedingsPerDay
    : mnSugeridoDia;

  // Proporcionaliza composição para X kg
  const calcIngredientes = (feedTypeId, totalKg) => {
    const comp = compositions.find(c => c.feed_type_id === feedTypeId);
    if (!comp) return [];
    return (comp.feed_composition_items || []).map(item => {
      const propPct  = Number(item.quantity_kg) / Number(comp.base_qty_kg);
      const qtdKg    = propPct * totalKg;
      const ing      = item.feed_ingredients;
      return {
        nome:    ing?.name || '—',
        unidade: ing?.unit || 'kg',
        msPct:   ing?.dry_matter_pct,
        propPct: (propPct * 100).toFixed(3),
        qtdMN:   qtdKg,
        qtdMS:   ing?.dry_matter_pct ? qtdKg * (ing.dry_matter_pct / 100) : null,
      };
    }).sort((a, b) => b.qtdMN - a.qtdMN);
  };

  // ── Salvar ───────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const total = parseFloat(form.total_qty_kg);
    if (!total || total <= 0) return alert('Informe a quantidade total.');
    if (!form.lot_id)        return alert('Selecione o lote.');
    if (!form.feed_type_id)  return alert('Selecione a ração.');
    if (form.batch_type === 'feeding' && !form.feeding_order)
      return alert('Informe o número do trato.');

    const payload = {
      farm_id:           currentFarm.id,
      lot_id:            form.lot_id,
      feed_type_id:      form.feed_type_id,
      batch_date:        form.batch_date,
      batch_type:        form.batch_type,
      feeding_order:     form.batch_type === 'feeding' ? parseInt(form.feeding_order) : null,
      total_qty_kg:      total,
      cocho_note:        form.cocho_note,
      cocho_adjustment_kg: ajusteCocho !== 0 ? ajusteCocho : null,
      notes:             form.notes || null,
    };

    const { error } = await supabase.from('wagon_batches').insert([payload]);
    if (error) return alert('Erro: ' + error.message);
    resetForm();
    loadDados();
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

  // ── Filtros ──────────────────────────────────────────────────
  const batidasFiltradas = batidas.filter(b => {
    const dataOk = !filtroData || b.batch_date === filtroData;
    const loteOk = !filtroLote || b.lot_id === filtroLote;
    return dataOk && loteOk;
  });

  const fmtKg = (v) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg' : '—';
  const fmtN  = (v, d=2) => v != null ? Number(v).toFixed(d) : '—';

  if (authLoading || loading) return <Layout><div style={{ padding: '2rem' }}>Carregando...</div></Layout>;

  return (
    <Layout>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <h1>🚜 Batida de Vagão</h1>
          {canCreate('wagon_batches') && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(true); }}>
              + Nova Batida
            </button>
          )}
        </div>

        {/* Formulário */}
        {showForm && (
          <div className={styles.formCard}>
            <h2>Nova Batida de Vagão</h2>
            <form onSubmit={handleSubmit}>

              {/* Data + Tipo */}
              <div className={styles.row}>
                <div>
                  <label>Data *</label>
                  <input type="date" value={form.batch_date}
                    onChange={e => setForm(p => ({ ...p, batch_date: e.target.value }))} required />
                </div>
                <div>
                  <label>Tipo de Batida *</label>
                  <select value={form.batch_type}
                    onChange={e => setForm(p => ({ ...p, batch_type: e.target.value }))}>
                    <option value="feeding">Por Trato</option>
                    <option value="day">Por Dia (todos os tratos)</option>
                  </select>
                </div>
              </div>

              {/* Lote + Nº Trato */}
              <div className={styles.row}>
                <div>
                  <label>Lote *</label>
                  <select value={form.lot_id}
                    onChange={e => setForm(p => ({ ...p, lot_id: e.target.value, feed_type_id: '' }))}>
                    <option value="">Selecione o lote</option>
                    {lotes.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.lot_code} ({l.head_count} cab.)
                      </option>
                    ))}
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

              {/* Ração */}
              <div className={styles.row}>
                <div>
                  <label>Ração *</label>
                  <select value={form.feed_type_id}
                    onChange={e => setForm(p => ({ ...p, feed_type_id: e.target.value }))}
                    required>
                    <option value="">Selecione a ração</option>
                    {racoes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} — R$ {Number(r.cost_per_kg).toFixed(2)}/kg{r.dry_matter_pct ? ` | MS: ${r.dry_matter_pct}%` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nota de cocho */}
              {loteAtual && (
                <div className={styles.cochoBox}>
                  <label>Nota de Cocho <span style={{ color: '#888', fontWeight: 400 }}>— leitura antes do trato</span></label>
                  <div className={styles.cochoNotas}>
                    {COCHO_NOTES.map(n => {
                      const adj = calcAjusteCocho(n.nota, parseInt(loteAtual.head_count) || 0);
                      const selected = form.cocho_note === n.nota;
                      return (
                        <button
                          key={n.nota}
                          type="button"
                          className={`${styles.cochoBtn} ${selected ? styles.cochoBtnActive : ''}`}
                          style={selected ? { background: n.bgCor, borderColor: n.cor, color: n.cor } : {}}
                          onClick={() => setForm(p => ({ ...p, cocho_note: p.cocho_note === n.nota ? null : n.nota }))}
                        >
                          <span className={styles.cochoBtnNota}>{n.label}</span>
                          <span className={styles.cochoBtnDesc}>{n.desc}</span>
                          {n.sinal !== 0 && (
                            <span className={styles.cochoBtnAdj} style={{ color: n.cor }}>
                              {adj > 0 ? '+' : ''}{fmtKg(adj)}
                            </span>
                          )}
                          {n.sinal === 0 && (
                            <span className={styles.cochoBtnAdj} style={{ color: '#2e7d32' }}>sem ajuste</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sugestão de quantidade */}
              {mnBase && (
                <div className={styles.sugestaoBox}>
                  <div className={styles.sugestaoInfo}>
                    <strong>
                      🌿 Sugerido: {fmtKg(mnSugeridoTrato)}
                      {form.batch_type === 'day' && feedingsPerDay > 1 &&
                        <span style={{ fontWeight: 400, fontSize: '0.82rem', marginLeft: '0.5rem', color: '#555' }}>
                          ({feedingsPerDay} tratos/dia)
                        </span>
                      }
                    </strong>
                    <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '2px' }}>
                      Peso est. {fmtN(mnBase.pesoEstimado, 1)} kg ({mnBase.dias}d) → MS {fmtN(mnBase.msCab, 2)} kg/cab → MN base {fmtKg(mnBase.mnTotalDia)}
                    </div>
                    {ajusteCocho !== 0 && (
                      <div style={{ fontSize: '0.8rem', color: ajusteCocho > 0 ? '#c62828' : '#e65100', marginTop: '2px', fontWeight: 600 }}>
                        Ajuste nota {form.cocho_note}: {ajusteCocho > 0 ? '+' : ''}{fmtKg(ajusteCocho)} → total {fmtKg(mnSugeridoDia)}
                      </div>
                    )}
                  </div>
                  <button type="button" className={styles.btnUsarSugestao}
                    onClick={() => setForm(p => ({ ...p, total_qty_kg: mnSugeridoTrato.toFixed(1) }))}>
                    Usar sugestão
                  </button>
                </div>
              )}

              {/* Quantidade total */}
              <div className={styles.row}>
                <div>
                  <label>
                    {form.batch_type === 'feeding' ? `Total a fabricar — ${form.feeding_order}º trato (kg) *` : 'Total a fabricar — dia completo (kg) *'}
                  </label>
                  <input type="number" value={form.total_qty_kg}
                    onChange={e => setForm(p => ({ ...p, total_qty_kg: e.target.value }))}
                    placeholder="Ex: 432.0" step="0.1" min="0" required />
                </div>
                <div>
                  <label>Observações</label>
                  <input type="text" value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Opcional" />
                </div>
              </div>

              {/* Preview ingredientes */}
              {form.feed_type_id && parseFloat(form.total_qty_kg) > 0 && (() => {
                const ings = calcIngredientes(form.feed_type_id, parseFloat(form.total_qty_kg));
                if (!ings.length) return null;
                return (
                  <div className={styles.previewIngs}>
                    <div className={styles.previewIngsTitle}>📋 Ordem de fabricação — {fmtKg(parseFloat(form.total_qty_kg))}</div>
                    <table className={styles.tabelaIngs}>
                      <thead>
                        <tr>
                          <th>Ingrediente</th>
                          <th>Proporção</th>
                          <th>Qtd MN</th>
                          <th>Qtd MS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ings.map((ing, i) => (
                          <tr key={i}>
                            <td>{ing.nome}</td>
                            <td>{ing.propPct}%</td>
                            <td><strong>{fmtKg(ing.qtdMN)}</strong></td>
                            <td style={{ color: '#1565c0' }}>{ing.qtdMS != null ? fmtKg(ing.qtdMS) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}><strong>TOTAL</strong></td>
                          <td><strong>{fmtKg(parseFloat(form.total_qty_kg))}</strong></td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
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

        {/* Lista de batidas */}
        {batidasFiltradas.length === 0 ? (
          <div className={styles.vazio}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚜</div>
            <p>Nenhuma batida registrada para este filtro.</p>
          </div>
        ) : (
          <div className={styles.batidasList}>
            {batidasFiltradas.map(b => {
              const lote  = lotes.find(l => l.id === b.lot_id);
              const racao = racoes.find(r => r.id === b.feed_type_id);
              const ings  = calcIngredientes(b.feed_type_id, Number(b.total_qty_kg));
              const expanded = expandedId === b.id;
              const cochoEntry = b.cocho_note != null ? COCHO_NOTES.find(n => n.nota === b.cocho_note) : null;

              return (
                <div key={b.id} className={styles.batidaCard}>
                  <div className={styles.batidaHeader} onClick={() => setExpandedId(expanded ? null : b.id)}>
                    <div className={styles.batidaHeaderLeft}>
                      <span className={styles.batidaTipoBadge} style={{ background: b.batch_type === 'day' ? '#e3f2fd' : '#e8f5e9', color: b.batch_type === 'day' ? '#1565c0' : '#2e7d32' }}>
                        {b.batch_type === 'day' ? '📅 Dia' : `🕐 ${b.feeding_order}º Trato`}
                      </span>
                      <strong>{lote?.lot_code || '—'}</strong>
                      <span style={{ color: '#666', fontSize: '0.88rem' }}>{racao?.name || '—'}</span>
                      {cochoEntry && (
                        <span className={styles.cochoBadge} style={{ background: cochoEntry.bgCor, color: cochoEntry.cor }}>
                          {cochoEntry.label} {b.cocho_adjustment_kg != null ? `(${Number(b.cocho_adjustment_kg) > 0 ? '+' : ''}${fmtKg(b.cocho_adjustment_kg)})` : ''}
                        </span>
                      )}
                    </div>
                    <div className={styles.batidaHeaderRight}>
                      <span className={styles.batidaTotal}>{fmtKg(b.total_qty_kg)}</span>
                      <span style={{ color: '#888', fontSize: '0.8rem' }}>{new Date(b.batch_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      <span className={styles.expandToggle}>{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expanded && (
                    <div className={styles.batidaBody}>
                      {ings.length > 0 ? (
                        <>
                          <div className={styles.batidaBodyTitle}>📋 Ingredientes para {fmtKg(b.total_qty_kg)}</div>
                          <table className={styles.tabelaIngs}>
                            <thead>
                              <tr><th>Ingrediente</th><th>Proporção</th><th>Qtd MN</th><th>Qtd MS</th></tr>
                            </thead>
                            <tbody>
                              {ings.map((ing, i) => (
                                <tr key={i}>
                                  <td>{ing.nome}</td>
                                  <td>{ing.propPct}%</td>
                                  <td><strong>{fmtKg(ing.qtdMN)}</strong></td>
                                  <td style={{ color: '#1565c0' }}>{ing.qtdMS != null ? fmtKg(ing.qtdMS) : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={2}><strong>TOTAL</strong></td>
                                <td><strong>{fmtKg(b.total_qty_kg)}</strong></td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </>
                      ) : (
                        <p style={{ color: '#888', fontSize: '0.88rem' }}>⚠️ Composição vigente não encontrada para esta ração.</p>
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
        )}
      </div>
    </Layout>
  );
}
