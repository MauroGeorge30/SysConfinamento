import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Lotes.module.css';

const CATEGORIAS = ['Macho', 'Fêmea', 'Novilha', 'Boi magro', 'Boi gordo', 'Bezerro', 'Outro'];
const STATUS_LABELS = { active: 'Ativo', closed: 'Encerrado' };

export default function Lotes() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const [lotes, setLotes] = useState([]);
  const [baias, setBaias] = useState([]);
  const [racoes, setRacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showFaseForm, setShowFaseForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedLote, setSelectedLote] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('active');
  const [expandedLote, setExpandedLote] = useState(null);

  const hoje = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [formData, setFormData] = useState({
    lot_code: '', pen_id: '', category: 'Macho', origin: '',
    entry_date: hoje, head_count: '', avg_entry_weight: '',
    target_gmd: '', target_leftover_pct: '', notes: '', status: 'active',
  });

  const [faseData, setFaseData] = useState({
    phase_name: 'Adaptação', feed_type_id: '', start_date: hoje,
    end_date: '', cms_pct_pv: '', notes: '',
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: lotesData, error: lotesError }, { data: baiasData }, { data: racoesData }] = await Promise.all([
        supabase.from('lots')
          .select(`
            *,
            pens(pen_number),
            lot_phases(id, phase_name, feed_type_id, start_date, end_date, cms_pct_pv,
              feed_types(name, cost_per_kg, dry_matter_pct)),
            lot_weighings(id, avg_weight_kg, weighing_date, head_weighed)
          `)
          .eq('farm_id', currentFarm.id)
          .order('entry_date', { ascending: false }),
        supabase.from('pens').select('id, pen_number, capacity, current_occupancy').eq('farm_id', currentFarm.id).eq('status', 'active').order('pen_number'),
        supabase.from('feed_types').select('id, name, cost_per_kg, dry_matter_pct').eq('farm_id', currentFarm.id).order('name'),
      ]);
      if (lotesError) throw lotesError;
      setLotes(lotesData || []);
      setBaias(baiasData || []);
      setRacoes(racoesData || []);
    } catch (error) {
      alert('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ lot_code: '', pen_id: '', category: 'Macho', origin: '', entry_date: hoje, head_count: '', avg_entry_weight: '', target_gmd: '', target_leftover_pct: '', notes: '', status: 'active' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.lot_code.trim()) return alert('Código do lote é obrigatório.');
    if (!formData.head_count || isNaN(formData.head_count)) return alert('Nº de cabeças inválido.');
    setLoading(true);
    try {
      const payload = {
        farm_id: currentFarm.id,
        lot_code: formData.lot_code.trim(),
        pen_id: formData.pen_id || null,
        category: formData.category,
        origin: formData.origin || null,
        entry_date: formData.entry_date,
        head_count: parseInt(formData.head_count),
        avg_entry_weight: formData.avg_entry_weight ? parseFloat(formData.avg_entry_weight) : null,
        target_gmd: formData.target_gmd ? parseFloat(formData.target_gmd) : null,
        target_leftover_pct: formData.target_leftover_pct ? parseFloat(formData.target_leftover_pct) : null,
        notes: formData.notes || null,
        status: formData.status,
        registered_by: user.id,
      };
      if (editingId) {
        const { error } = await supabase.from('lots').update(payload).eq('id', editingId);
        if (error) throw error;
        alert('✅ Lote atualizado!');
      } else {
        const { error } = await supabase.from('lots').insert([payload]);
        if (error) throw error;
        alert('✅ Lote cadastrado!');
      }
      resetForm();
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (lote) => {
    setFormData({
      lot_code: lote.lot_code,
      pen_id: lote.pen_id || '',
      category: lote.category,
      origin: lote.origin || '',
      entry_date: lote.entry_date,
      head_count: lote.head_count,
      avg_entry_weight: lote.avg_entry_weight || '',
      target_gmd: lote.target_gmd || '',
      target_leftover_pct: lote.target_leftover_pct || '',
      notes: lote.notes || '',
      status: lote.status,
    });
    setEditingId(lote.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este lote? Isso também removerá as fases vinculadas.')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('lots').delete().eq('id', id);
      if (error) throw error;
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEncerrar = async (lote) => {
    if (!confirm(`Encerrar o lote ${lote.lot_code}?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('lots').update({ status: 'closed' }).eq('id', lote.id);
      if (error) throw error;
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fases
  const handleAddFase = (lote) => {
    setSelectedLote(lote);
    setFaseData({ phase_name: 'Adaptação', feed_type_id: '', start_date: hoje, end_date: '', cms_pct_pv: '', notes: '' });
    setShowFaseForm(true);
  };

  const handleSubmitFase = async (e) => {
    e.preventDefault();
    if (!faseData.feed_type_id) return alert('Selecione a ração/dieta.');
    setLoading(true);
    try {
      // Encerrar fase ativa anterior
      const faseAtiva = (selectedLote.lot_phases || []).find(f => !f.end_date);
      if (faseAtiva) {
        await supabase.from('lot_phases').update({ end_date: faseData.start_date }).eq('id', faseAtiva.id);
      }
      const { error } = await supabase.from('lot_phases').insert([{
        farm_id: currentFarm.id,
        lot_id: selectedLote.id,
        feed_type_id: faseData.feed_type_id,
        phase_name: faseData.phase_name,
        start_date: faseData.start_date,
        end_date: faseData.end_date || null,
        cms_pct_pv: faseData.cms_pct_pv ? parseFloat(faseData.cms_pct_pv) : null,
        notes: faseData.notes || null,
        registered_by: user.id,
      }]);
      if (error) throw error;
      alert('✅ Fase registrada!');
      setShowFaseForm(false);
      setSelectedLote(null);
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Cálculos
  const getFaseAtiva = (lote) => {
    const fases = lote.lot_phases || [];
    return fases.find(f => !f.end_date) || fases.sort((a, b) => new Date(b.start_date) - new Date(a.start_date))[0] || null;
  };

  const getUltimaPesagem = (lote) => {
    const pesagens = lote.lot_weighings || [];
    return pesagens.sort((a, b) => new Date(b.weighing_date) - new Date(a.weighing_date))[0] || null;
  };

  const calcGMD = (lote) => {
    const pesagens = (lote.lot_weighings || []).sort((a, b) => new Date(b.weighing_date) - new Date(a.weighing_date));
    if (pesagens.length >= 2) {
      const dias = Math.floor((new Date(pesagens[0].weighing_date) - new Date(pesagens[1].weighing_date)) / 86400000);
      if (dias > 0) return ((pesagens[0].avg_weight_kg - pesagens[1].avg_weight_kg) / dias).toFixed(3);
    }
    if (pesagens.length === 1 && lote.avg_entry_weight && lote.entry_date) {
      const dias = Math.floor((new Date(pesagens[0].weighing_date) - new Date(lote.entry_date)) / 86400000);
      if (dias > 0) return ((pesagens[0].avg_weight_kg - lote.avg_entry_weight) / dias).toFixed(3);
    }
    return null;
  };

  const getDiasConfinamento = (lote) => {
    return Math.floor((new Date() - new Date(lote.entry_date)) / 86400000);
  };

  const lotesFiltrados = lotes.filter(l => !filtroStatus || l.status === filtroStatus);
  const totalAtivos = lotes.filter(l => l.status === 'active').length;
  const totalCabecas = lotes.filter(l => l.status === 'active').reduce((acc, l) => acc + (l.head_count || 0), 0);
  const totalEncerrados = lotes.filter(l => l.status === 'closed').length;

  if (loading && lotes.length === 0) return <Layout><div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div></Layout>;

  return (
    <Layout>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <h1>📦 Lotes de Confinamento</h1>
          <div className={styles.headerBtns}>
            {showForm ? (
              <button className={styles.btnCancelarHeader} onClick={resetForm}>✕ Cancelar</button>
            ) : (
              canCreate('lots') !== false && (
                <button className={styles.btnAdd} onClick={() => setShowForm(true)}>+ Novo Lote</button>
              )
            )}
          </div>
        </div>

        {/* Cards resumo */}
        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <span>Lotes Ativos</span>
            <strong>{totalAtivos}</strong>
          </div>
          <div className={styles.resumoCard} style={{ borderLeftColor: '#1565c0' }}>
            <span>Cabeças em Confinamento</span>
            <strong style={{ color: '#1565c0' }}>{totalCabecas}</strong>
          </div>
          <div className={styles.resumoCard} style={{ borderLeftColor: '#6a1b9a' }}>
            <span>Baias com Lote</span>
            <strong style={{ color: '#6a1b9a' }}>{new Set(lotes.filter(l => l.status === 'active' && l.pen_id).map(l => l.pen_id)).size}</strong>
          </div>
          <div className={styles.resumoCard} style={{ borderLeftColor: '#757575' }}>
            <span>Lotes Encerrados</span>
            <strong style={{ color: '#757575' }}>{totalEncerrados}</strong>
          </div>
        </div>

        {/* Formulário de cadastro */}
        {showForm && (
          <div className={styles.formCard}>
            <h2>{editingId ? '✏️ Editar Lote' : '+ Novo Lote'}</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Código do Lote *</label>
                  <input type="text" value={formData.lot_code} onChange={e => setFormData({ ...formData, lot_code: e.target.value })} placeholder="Ex: L-2026-001" required />
                </div>
                <div>
                  <label>Baia</label>
                  <select value={formData.pen_id} onChange={e => setFormData({ ...formData, pen_id: e.target.value })}>
                    <option value="">— Sem baia —</option>
                    {baias.map(b => <option key={b.id} value={b.id}>{b.pen_number} ({b.current_occupancy}/{b.capacity})</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Categoria *</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label>Origem / Fornecedor</label>
                  <input type="text" value={formData.origin} onChange={e => setFormData({ ...formData, origin: e.target.value })} placeholder="Ex: Fazenda São João" />
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Data de Entrada *</label>
                  <input type="date" value={formData.entry_date} onChange={e => setFormData({ ...formData, entry_date: e.target.value })} required />
                </div>
                <div>
                  <label>Nº de Cabeças *</label>
                  <input type="number" value={formData.head_count} onChange={e => setFormData({ ...formData, head_count: e.target.value })} placeholder="Ex: 120" min="1" required />
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Peso Médio de Entrada (kg)</label>
                  <input type="number" value={formData.avg_entry_weight} onChange={e => setFormData({ ...formData, avg_entry_weight: e.target.value })} placeholder="Ex: 320.0" step="0.1" min="0" />
                </div>
                <div>
                  <label>Meta GMD (kg/dia)</label>
                  <input type="number" value={formData.target_gmd} onChange={e => setFormData({ ...formData, target_gmd: e.target.value })} placeholder="Ex: 1.200" step="0.001" min="0" />
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Meta de Sobra (%)</label>
                  <input type="number" value={formData.target_leftover_pct} onChange={e => setFormData({ ...formData, target_leftover_pct: e.target.value })} placeholder="Ex: 3.0" step="0.1" min="0" max="100" />
                </div>
                <div>
                  <label>Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option value="active">Ativo</option>
                    <option value="closed">Encerrado</option>
                  </select>
                </div>
              </div>
              <div className={styles.rowFull}>
                <div>
                  <label>Observações</label>
                  <input type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Observações gerais do lote" />
                </div>
              </div>
              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                <button type="submit" disabled={loading}>{loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar Lote'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Formulário de Fase */}
        {showFaseForm && selectedLote && (
          <div className={styles.formCard} style={{ borderLeft: '4px solid #e65100' }}>
            <h2>🌿 Nova Fase de Dieta — Lote {selectedLote.lot_code}</h2>
            <form onSubmit={handleSubmitFase}>
              <div className={styles.row}>
                <div>
                  <label>Fase *</label>
                  <select value={faseData.phase_name} onChange={e => setFaseData({ ...faseData, phase_name: e.target.value })}>
                    <option>Adaptação</option>
                    <option>Transição</option>
                    <option>Terminação</option>
                    <option>Manutenção</option>
                  </select>
                </div>
                <div>
                  <label>Dieta / Ração *</label>
                  <select value={faseData.feed_type_id} onChange={e => setFaseData({ ...faseData, feed_type_id: e.target.value })} required>
                    <option value="">— Selecione —</option>
                    {racoes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.dry_matter_pct ? `— MS: ${r.dry_matter_pct}%` : ''} — R$ {Number(r.cost_per_kg).toFixed(2)}/kg
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Data Início *</label>
                  <input type="date" value={faseData.start_date} onChange={e => setFaseData({ ...faseData, start_date: e.target.value })} required />
                </div>
                <div>
                  <label>Data Fim (deixe vazio se ativa)</label>
                  <input type="date" value={faseData.end_date} onChange={e => setFaseData({ ...faseData, end_date: e.target.value })} />
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>CMS % do PV (ex: 2.3)</label>
                  <input type="number" value={faseData.cms_pct_pv} onChange={e => setFaseData({ ...faseData, cms_pct_pv: e.target.value })} placeholder="Ex: 2.30" step="0.01" min="0" />
                </div>
                <div>
                  <label>Observações</label>
                  <input type="text" value={faseData.notes} onChange={e => setFaseData({ ...faseData, notes: e.target.value })} placeholder="Observações da fase" />
                </div>
              </div>
              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={() => { setShowFaseForm(false); setSelectedLote(null); }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ background: '#e65100' }}>{loading ? 'Salvando...' : 'Registrar Fase'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Filtros */}
        <div className={styles.filtros}>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="closed">Encerrados</option>
          </select>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>{lotesFiltrados.length} lote(s)</span>
        </div>

        {/* Lista de Lotes */}
        {lotesFiltrados.length === 0 ? (
          <div className={styles.vazio}>
            <p style={{ fontSize: '2rem' }}>📦</p>
            <p>Nenhum lote encontrado.</p>
            <p style={{ fontSize: '0.9rem' }}>Cadastre o primeiro lote de confinamento.</p>
          </div>
        ) : (
          <div className={styles.lotesList}>
            {lotesFiltrados.map(lote => {
              const faseAtiva = getFaseAtiva(lote);
              const ultimaPesagem = getUltimaPesagem(lote);
              const gmd = calcGMD(lote);
              const dias = getDiasConfinamento(lote);
              const isExpanded = expandedLote === lote.id;

              const gmdNum = gmd ? parseFloat(gmd) : null;
              const gmdOk = gmdNum && lote.target_gmd ? gmdNum >= lote.target_gmd : null;

              return (
                <div key={lote.id} className={`${styles.loteCard} ${lote.status === 'closed' ? styles.loteEncerrado : ''}`}>

                  {/* Cabeçalho do card */}
                  <div className={styles.loteCardHeader} onClick={() => setExpandedLote(isExpanded ? null : lote.id)}>
                    <div className={styles.loteCardLeft}>
                      <div className={styles.loteCode}>{lote.lot_code}</div>
                      <div className={styles.loteMeta}>
                        <span className={styles.badgeCategoria}>{lote.category}</span>
                        <span className={`${styles.badgeStatus} ${lote.status === 'active' ? styles.badgeAtivo : styles.badgeEncerrado}`}>
                          {STATUS_LABELS[lote.status]}
                        </span>
                        {lote.pens && <span className={styles.metaItem}>🏠 {lote.pens.pen_number}</span>}
                        <span className={styles.metaItem}>🐂 {lote.head_count} cab.</span>
                        <span className={styles.metaItem}>📅 {dias}d</span>
                      </div>
                    </div>

                    <div className={styles.loteCardIndicadores}>
                      {gmdNum !== null && (
                        <div className={`${styles.indicador} ${gmdOk === true ? styles.indOk : gmdOk === false ? styles.indAlert : ''}`}>
                          <span>GMD</span>
                          <strong>{gmdNum.toFixed(3)} kg/d</strong>
                          {lote.target_gmd && <small>Meta: {Number(lote.target_gmd).toFixed(3)}</small>}
                        </div>
                      )}
                      {faseAtiva && (
                        <div className={styles.indicador}>
                          <span>Fase</span>
                          <strong>{faseAtiva.phase_name}</strong>
                          <small>{faseAtiva.feed_types?.name || '—'}</small>
                        </div>
                      )}
                      {ultimaPesagem && (
                        <div className={styles.indicador}>
                          <span>Último Peso</span>
                          <strong>{Number(ultimaPesagem.avg_weight_kg).toFixed(1)} kg</strong>
                          <small>{new Date(ultimaPesagem.weighing_date + 'T12:00:00').toLocaleDateString('pt-BR')}</small>
                        </div>
                      )}
                      <div className={styles.chevron}>{isExpanded ? '▲' : '▼'}</div>
                    </div>
                  </div>

                  {/* Detalhe expandido */}
                  {isExpanded && (
                    <div className={styles.loteCardBody}>
                      <div className={styles.detalheGrid}>
                        <div>
                          <span>Entrada</span>
                          <strong>{new Date(lote.entry_date + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                        </div>
                        <div>
                          <span>Peso Médio Entrada</span>
                          <strong>{lote.avg_entry_weight ? `${Number(lote.avg_entry_weight).toFixed(1)} kg` : '—'}</strong>
                        </div>
                        <div>
                          <span>Meta GMD</span>
                          <strong>{lote.target_gmd ? `${Number(lote.target_gmd).toFixed(3)} kg/d` : '—'}</strong>
                        </div>
                        <div>
                          <span>Meta Sobra</span>
                          <strong>{lote.target_leftover_pct ? `${Number(lote.target_leftover_pct).toFixed(1)}%` : '—'}</strong>
                        </div>
                        <div>
                          <span>Origem</span>
                          <strong>{lote.origin || '—'}</strong>
                        </div>
                        <div>
                          <span>Dias de Confinamento</span>
                          <strong>{dias} dias</strong>
                        </div>
                      </div>

                      {/* Fases */}
                      {lote.lot_phases && lote.lot_phases.length > 0 && (
                        <div className={styles.faseSection}>
                          <h4>Fases de Dieta</h4>
                          <div className={styles.fasesGrid}>
                            {[...lote.lot_phases].sort((a, b) => new Date(b.start_date) - new Date(a.start_date)).map(fase => (
                              <div key={fase.id} className={`${styles.faseChip} ${!fase.end_date ? styles.faseAtiva : ''}`}>
                                <strong>{fase.phase_name}</strong>
                                <span>{fase.feed_types?.name}</span>
                                {fase.feed_types?.dry_matter_pct && <span>MS: {fase.feed_types.dry_matter_pct}%</span>}
                                {fase.cms_pct_pv && <span>CMS: {fase.cms_pct_pv}% PV</span>}
                                <span>{new Date(fase.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} {fase.end_date ? `→ ${new Date(fase.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}` : '→ atual'}</span>
                                {!fase.end_date && <span className={styles.badgeFaseAtiva}>Ativa</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notas */}
                      {lote.notes && (
                        <div className={styles.notasSection}>
                          <strong>Obs:</strong> {lote.notes}
                        </div>
                      )}

                      {/* Ações */}
                      <div className={styles.loteAcoes}>
                        {lote.status === 'active' && (
                          <button className={styles.btnFase} onClick={() => handleAddFase(lote)}>🌿 Nova Fase</button>
                        )}
                        {canEdit && (
                          <button className={styles.btnEditar} onClick={() => handleEdit(lote)}>✏️ Editar</button>
                        )}
                        {lote.status === 'active' && (
                          <button className={styles.btnEncerrar} onClick={() => handleEncerrar(lote)}>🔒 Encerrar</button>
                        )}
                        {canDelete && (
                          <button className={styles.btnDeletar} onClick={() => handleDelete(lote.id)}>🗑️ Excluir</button>
                        )}
                      </div>
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
