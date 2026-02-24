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
  const [editingFaseId, setEditingFaseId] = useState(null);
  const [selectedLote, setSelectedLote] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('active');
  const [expandedLote, setExpandedLote] = useState(null);
  const [viewingLote, setViewingLote] = useState(null);

  const hoje = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [formData, setFormData] = useState({
    lot_code: '', pen_id: '', category: 'Macho', origin: '',
    entry_date: hoje, head_count: '', avg_entry_weight: '',
    target_gmd: '', target_leftover_pct: '', notes: '', status: 'active',
    purchase_price_arroba: '', carcass_yield_pct: '52', cost_per_head_day: '', arroba_divisor: '30', daily_feeding_count: '1',
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
    if (formData.avg_entry_weight && parseFloat(formData.avg_entry_weight) > 9999) {
      return alert('Peso médio de entrada inválido. Use kg com ponto decimal. Ex: 320.5');
    }
    if (formData.target_gmd && parseFloat(formData.target_gmd) > 99) {
      return alert('Meta GMD inválida. Use ponto decimal. Ex: 1.200 (não 1200).');
    }
    if (formData.target_leftover_pct && parseFloat(formData.target_leftover_pct) > 100) {
      return alert('Meta de Sobra deve ser entre 0 e 100%.');
    }
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
        purchase_price_arroba: formData.purchase_price_arroba ? parseFloat(formData.purchase_price_arroba) : null,
        carcass_yield_pct: formData.carcass_yield_pct ? parseFloat(formData.carcass_yield_pct) : 52,
        cost_per_head_day: formData.cost_per_head_day ? parseFloat(formData.cost_per_head_day) : null,
        arroba_divisor: formData.arroba_divisor ? parseFloat(formData.arroba_divisor) : 30,
        daily_feeding_count: formData.daily_feeding_count ? parseInt(formData.daily_feeding_count) : 1,
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
      purchase_price_arroba: lote.purchase_price_arroba || '',
      carcass_yield_pct: lote.carcass_yield_pct || '52',
      cost_per_head_day: lote.cost_per_head_day || '',
      arroba_divisor: lote.arroba_divisor || '30',
      daily_feeding_count: lote.daily_feeding_count || '1',
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

  const handleEditFase = (lote, fase) => {
    setSelectedLote(lote);
    setEditingFaseId(fase.id);
    setFaseData({
      phase_name: fase.phase_name,
      feed_type_id: fase.feed_type_id,
      start_date: fase.start_date,
      end_date: fase.end_date || '',
      cms_pct_pv: fase.cms_pct_pv || '',
      notes: fase.notes || '',
    });
    setShowFaseForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitFase = async (e) => {
    e.preventDefault();
    if (!faseData.feed_type_id) return alert('Selecione a ração/dieta.');
    setLoading(true);
    try {
      if (editingFaseId) {
        // Modo edição: atualiza a fase existente
        const { error } = await supabase.from('lot_phases').update({
          feed_type_id: faseData.feed_type_id,
          phase_name: faseData.phase_name,
          start_date: faseData.start_date,
          end_date: faseData.end_date || null,
          cms_pct_pv: faseData.cms_pct_pv ? parseFloat(faseData.cms_pct_pv) : null,
          notes: faseData.notes || null,
        }).eq('id', editingFaseId);
        if (error) throw error;
        alert('✅ Fase atualizada!');
      } else {
        // Modo criação: encerra fase ativa anterior e insere nova
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
      }
      setShowFaseForm(false);
      setSelectedLote(null);
      setEditingFaseId(null);
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
                  <input type="number" value={formData.avg_entry_weight} onChange={e => setFormData({ ...formData, avg_entry_weight: e.target.value })} placeholder="Ex: 320.5" step="0.1" min="0" max="9999" />
                </div>
                <div>
                  <label>Meta GMD (kg/dia) <span style={{color:'#888',fontWeight:400}}>use ponto decimal</span></label>
                  <input type="number" value={formData.target_gmd} onChange={e => setFormData({ ...formData, target_gmd: e.target.value })} placeholder="Ex: 1.200" step="0.001" min="0" max="99.999" />
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Meta de Sobra (%) <span style={{color:'#888',fontWeight:400}}>0 a 100</span></label>
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

              {/* Seção de custos */}
              <div className={styles.secaoCustos}>
                <div className={styles.secaoCustosTitulo}>💰 Dados de Custo e Fechamento</div>
                <div className={styles.row}>
                  <div>
                    <label>Preço de Compra (R$/@)</label>
                    <input type="number" value={formData.purchase_price_arroba}
                      onChange={e => setFormData({ ...formData, purchase_price_arroba: e.target.value })}
                      placeholder="Ex: 310.00" step="0.01" min="0" />
                  </div>
                  <div>
                    <label>Divisor da @ negociada <span style={{color:'#888',fontWeight:400}}>(padrão 30)</span></label>
                    <input type="number" value={formData.arroba_divisor}
                      onChange={e => setFormData({ ...formData, arroba_divisor: e.target.value })}
                      placeholder="Ex: 30" step="0.1" min="1" />
                  </div>
                </div>
                <div className={styles.row}>
                  <div>
                    <label>MS% do Peso Vivo para consumo <span style={{color:'#888',fontWeight:400}}>padrão 2.5%</span></label>
                    <input type="number" value={formData.carcass_yield_pct}
                      onChange={e => setFormData({ ...formData, carcass_yield_pct: e.target.value })}
                      placeholder="Ex: 2.5" step="0.01" min="0" />
                  </div>
                  <div>
                    <label>Custo Operacional (R$/cab/dia)</label>
                    <input type="number" value={formData.cost_per_head_day}
                      onChange={e => setFormData({ ...formData, cost_per_head_day: e.target.value })}
                      placeholder="Ex: 1.00" step="0.01" min="0" />
                  </div>
                </div>
                <div className={styles.row}>
                  <div>
                    <label>Tratos por dia <span style={{color:'#888',fontWeight:400}}>— divide o MN sugerido</span></label>
                    <input type="number" value={formData.daily_feeding_count}
                      onChange={e => setFormData({ ...formData, daily_feeding_count: e.target.value })}
                      placeholder="Ex: 2" step="1" min="1" max="10" />
                  </div>
                </div>
                {formData.purchase_price_arroba && formData.avg_entry_weight && (() => {
                  const div = parseFloat(formData.arroba_divisor) || 30;
                  const arrobaNegocia = parseFloat(formData.avg_entry_weight) / div;
                  const precoCab = arrobaNegocia * parseFloat(formData.purchase_price_arroba);
                  return (
                    <div className={styles.previewCompra}>
                      <span>@ negociada/cab</span>
                      <strong>{arrobaNegocia.toFixed(2)} @</strong>
                      <span style={{marginLeft:'1.5rem'}}>Preço de compra/cab</span>
                      <strong>R$ {precoCab.toFixed(2)}</strong>
                      <small style={{marginLeft:'1rem'}}>({formData.avg_entry_weight} kg ÷ {div} = {arrobaNegocia.toFixed(2)} @ × R$ {formData.purchase_price_arroba})</small>
                    </div>
                  );
                })()}
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
            <h2>{editingFaseId ? '✏️ Editar Fase de Dieta' : '🌿 Nova Fase de Dieta'} — Lote {selectedLote.lot_code}</h2>
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
                <button type="button" className={styles.btnCancelar} onClick={() => { setShowFaseForm(false); setSelectedLote(null); setEditingFaseId(null); }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ background: '#e65100' }}>{loading ? 'Salvando...' : editingFaseId ? 'Salvar Alterações' : 'Registrar Fase'}</button>
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
                      {faseAtiva && (() => {
                        const fimFase = faseAtiva.end_date ? new Date(faseAtiva.end_date) : null;
                        const faseJaConcluida = fimFase && fimFase < new Date(hoje);
                        return (
                          <div className={styles.indicador}>
                            <span>Fase</span>
                            <strong style={{ color: faseJaConcluida ? '#2e7d32' : '#e65100' }}>{faseAtiva.phase_name}</strong>
                            <small>{faseJaConcluida ? '✓ Concluída' : '⏳ Em Processo'}</small>
                          </div>
                        );
                      })()}
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

                      {/* Fases — timeline completa */}
                      {lote.lot_phases && lote.lot_phases.length > 0 && (() => {
                        const fasesSorted = [...lote.lot_phases].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
                        return (
                          <div className={styles.faseSection}>
                            <h4>📋 Histórico de Fases de Dieta ({fasesSorted.length})</h4>
                            <div className={styles.fasesTimeline}>
                              {fasesSorted.map((fase, idx) => {
                                // Status real: concluída se end_date existe E já passou; em processo se não tem end_date OU end_date ainda não chegou
                                const hojeTs = new Date(hoje);
                                const fimTs = fase.end_date ? new Date(fase.end_date) : null;
                                const isConcluida = fimTs && fimTs < hojeTs;
                                const isEmProcesso = !isConcluida; // ainda dentro do período
                                const diasFase = fase.end_date
                                  ? Math.floor((new Date(fase.end_date) - new Date(fase.start_date)) / 86400000)
                                  : Math.floor((new Date() - new Date(fase.start_date)) / 86400000);
                                return (
                                  <div key={fase.id} className={`${styles.faseTimelineItem} ${isEmProcesso ? styles.faseTimelineAtiva : styles.faseTimelineAnt}`}>
                                    <div className={styles.faseTimelineMarcador}>
                                      <div className={styles.faseTimelineDot} style={{ background: isConcluida ? '#2e7d32' : '#e65100' }} />
                                      {idx < fasesSorted.length - 1 && <div className={styles.faseTimelineLine} />}
                                    </div>
                                    <div className={styles.faseTimelineConteudo}>
                                      <div className={styles.faseTimelineHeader}>
                                        <strong>{fase.phase_name}</strong>
                                        {isConcluida
                                          ? <span className={styles.badgeFaseConcluida}>✓ Concluída</span>
                                          : <span className={styles.badgeFaseEmProcesso}>⏳ Em Processo</span>
                                        }
                                        <span className={styles.faseTimelineDias}>{diasFase}d</span>
                                        {canEdit && (
                                          <button className={styles.btnEditarFase} onClick={(e) => { e.stopPropagation(); handleEditFase(lote, fase); }} title="Editar fase">✏️ Editar</button>
                                        )}
                                      </div>
                                      <div className={styles.faseTimelineDetalhes}>
                                        {fase.feed_types?.name && (
                                          <span className={styles.faseDetalheRacao}>🌾 {fase.feed_types.name}</span>
                                        )}
                                        {fase.feed_types?.dry_matter_pct && (
                                          <span className={styles.faseDetalheInfo}>MS: {fase.feed_types.dry_matter_pct}%</span>
                                        )}
                                        {fase.cms_pct_pv && (
                                          <span className={styles.faseDetalheInfo}>CMS: {fase.cms_pct_pv}% PV</span>
                                        )}
                                      </div>
                                      <div className={styles.faseTimelinePeriodo}>
                                        📅 {new Date(fase.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        {' → '}
                                        {fase.end_date
                                          ? new Date(fase.end_date + 'T12:00:00').toLocaleDateString('pt-BR')
                                          : <em style={{ color: '#e65100' }}>em andamento</em>
                                        }
                                      </div>
                                      {fase.notes && <div className={styles.faseTimelineObs}>{fase.notes}</div>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Notas */}
                      {lote.notes && (
                        <div className={styles.notasSection}>
                          <strong>Obs:</strong> {lote.notes}
                        </div>
                      )}

                      {/* Ações */}
                      <div className={styles.loteAcoes}>
                        <button className={styles.btnVisualizar} onClick={() => setViewingLote(lote)}>👁 Visualizar</button>
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

        {/* ── MODAL VISUALIZAR LOTE ── */}
        {viewingLote && (() => {
          const vl = viewingLote;
          const faseAtiva = getFaseAtiva(vl);
          const ultimaPesagem = getUltimaPesagem(vl);
          const gmd = calcGMD(vl);
          const dias = getDiasConfinamento(vl);
          const fasesSorted = [...(vl.lot_phases || [])].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

          // Cálculo de consumo MN baseado no MS% do PV
          // carcass_yield_pct agora = MS% do PV para consumo
          const msPvPct = vl.carcass_yield_pct ? parseFloat(vl.carcass_yield_pct) : null;
          const pesoAtual = ultimaPesagem?.avg_weight_kg || vl.avg_entry_weight;
          const faseAtivaRacao = faseAtiva?.feed_types;
          const msDieta = faseAtivaRacao?.dry_matter_pct ? parseFloat(faseAtivaRacao.dry_matter_pct) : null;
          // Consumo MS/dia = Peso Vivo × (MS%PV / 100)
          const consumoMsDia = pesoAtual && msPvPct ? parseFloat(pesoAtual) * (msPvPct / 100) : null;
          // Consumo MN/dia = Consumo MS / (MS% dieta / 100)
          const consumoMnDia = consumoMsDia && msDieta ? consumoMsDia / (msDieta / 100) : null;
          // Consumo MN total por cabeça/dia e por lote/dia
          const consumoMnLoteDia = consumoMnDia ? consumoMnDia * vl.head_count : null;

          // Preview compra
          const div = parseFloat(vl.arroba_divisor) || 30;
          const arrobaNegocia = vl.avg_entry_weight ? parseFloat(vl.avg_entry_weight) / div : null;
          const precoCab = arrobaNegocia && vl.purchase_price_arroba ? arrobaNegocia * parseFloat(vl.purchase_price_arroba) : null;

          return (
            <div className={styles.modalOverlay} onClick={() => setViewingLote(null)}>
              <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <div>
                    <h2 className={styles.modalTitulo}>📦 {vl.lot_code}</h2>
                    <div style={{display:'flex',gap:'8px',marginTop:'4px',flexWrap:'wrap'}}>
                      <span className={styles.badgeCategoria}>{vl.category}</span>
                      <span className={vl.status === 'active' ? styles.badgeAtivo : styles.badgeEncerrado}>
                        {STATUS_LABELS[vl.status]}
                      </span>
                      {vl.pens && <span className={styles.metaItem}>🏠 {vl.pens.pen_number}</span>}
                    </div>
                  </div>
                  <button className={styles.modalFechar} onClick={() => setViewingLote(null)}>✕</button>
                </div>

                <div className={styles.modalBody}>

                  {/* Bloco 1: Identificação */}
                  <div className={styles.modalSecao}>
                    <div className={styles.modalSecaoTitulo}>📋 Identificação</div>
                    <div className={styles.modalGrid}>
                      <div><span>Código</span><strong>{vl.lot_code}</strong></div>
                      <div><span>Categoria</span><strong>{vl.category}</strong></div>
                      <div><span>Origem</span><strong>{vl.origin || '—'}</strong></div>
                      <div><span>Baia</span><strong>{vl.pens?.pen_number || '—'}</strong></div>
                      <div><span>Data Entrada</span><strong>{new Date(vl.entry_date + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>
                      <div><span>Dias Confinamento</span><strong>{dias} dias</strong></div>
                      <div><span>Status</span><strong>{STATUS_LABELS[vl.status]}</strong></div>
                      {vl.notes && <div style={{gridColumn:'1/-1'}}><span>Observações</span><strong>{vl.notes}</strong></div>}
                    </div>
                  </div>

                  {/* Bloco 2: Animais e Pesagens */}
                  <div className={styles.modalSecao}>
                    <div className={styles.modalSecaoTitulo}>🐂 Animais e Pesagens</div>
                    <div className={styles.modalGrid}>
                      <div><span>Cabeças</span><strong>{vl.head_count} cab.</strong></div>
                      <div><span>Peso Médio Entrada</span><strong>{vl.avg_entry_weight ? `${Number(vl.avg_entry_weight).toFixed(1)} kg` : '—'}</strong></div>
                      <div><span>Último Peso</span><strong>{ultimaPesagem ? `${Number(ultimaPesagem.avg_weight_kg).toFixed(1)} kg` : '—'}</strong></div>
                      <div><span>Data Último Peso</span><strong>{ultimaPesagem ? new Date(ultimaPesagem.weighing_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</strong></div>
                      <div><span>GMD Real</span><strong style={{color: gmd && vl.target_gmd && parseFloat(gmd) >= vl.target_gmd ? '#1b5e20' : '#c62828'}}>{gmd ? `${parseFloat(gmd).toFixed(3)} kg/d` : '—'}</strong></div>
                      <div><span>Meta GMD</span><strong>{vl.target_gmd ? `${Number(vl.target_gmd).toFixed(3)} kg/d` : '—'}</strong></div>
                      <div><span>Meta Sobra</span><strong>{vl.target_leftover_pct ? `${Number(vl.target_leftover_pct).toFixed(1)}%` : '—'}</strong></div>
                      <div><span>Total pesagens</span><strong>{(vl.lot_weighings || []).length}</strong></div>
                    </div>
                  </div>

                  {/* Bloco 3: Consumo calculado */}
                  {msPvPct && (
                    <div className={styles.modalSecao} style={{borderLeftColor:'#1565c0'}}>
                      <div className={styles.modalSecaoTitulo} style={{color:'#1565c0'}}>🌿 Consumo Estimado (fase atual)</div>
                      <div className={styles.modalGrid}>
                        <div><span>MS% do PV</span><strong style={{color:'#1565c0'}}>{msPvPct.toFixed(2)}%</strong></div>
                        <div><span>Peso base (atual)</span><strong>{pesoAtual ? `${Number(pesoAtual).toFixed(1)} kg` : '—'}</strong></div>
                        <div><span>Consumo MS/cab/dia</span><strong>{consumoMsDia ? `${consumoMsDia.toFixed(2)} kg MS` : '—'}</strong></div>
                        <div><span>MS% da dieta atual</span><strong>{msDieta ? `${msDieta.toFixed(2)}%` : <span style={{color:'#aaa'}}>Sem composição</span>}</strong></div>
                        <div style={{background:'#e8f5e9',borderRadius:'8px',padding:'8px 12px'}}>
                          <span>Consumo MN/cab/dia</span>
                          <strong style={{color:'#1b5e20',fontSize:'1.1rem'}}>{consumoMnDia ? `${consumoMnDia.toFixed(2)} kg MN` : '—'}</strong>
                        </div>
                        <div style={{background:'#e3f2fd',borderRadius:'8px',padding:'8px 12px'}}>
                          <span>Consumo MN/lote/dia ({vl.head_count} cab)</span>
                          <strong style={{color:'#1565c0',fontSize:'1.1rem'}}>{consumoMnLoteDia ? `${consumoMnLoteDia.toFixed(1)} kg MN` : '—'}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bloco 4: Dados financeiros */}
                  <div className={styles.modalSecao} style={{borderLeftColor:'#e65100'}}>
                    <div className={styles.modalSecaoTitulo} style={{color:'#e65100'}}>💰 Dados Financeiros</div>
                    <div className={styles.modalGrid}>
                      <div><span>Preço de Compra</span><strong>{vl.purchase_price_arroba ? `R$ ${Number(vl.purchase_price_arroba).toFixed(2)}/@` : '—'}</strong></div>
                      <div><span>Divisor @ negociada</span><strong>{vl.arroba_divisor || 30}</strong></div>
                      <div><span>@ negociada/cab</span><strong>{arrobaNegocia ? `${arrobaNegocia.toFixed(2)} @` : '—'}</strong></div>
                      <div><span>Custo de compra/cab</span><strong>{precoCab ? `R$ ${precoCab.toFixed(2)}` : '—'}</strong></div>
                      <div><span>Custo total compra</span><strong>{precoCab ? `R$ ${(precoCab * vl.head_count).toFixed(2)}` : '—'}</strong></div>
                      <div><span>Custo Operac./cab/dia</span><strong>{vl.cost_per_head_day ? `R$ ${Number(vl.cost_per_head_day).toFixed(2)}` : '—'}</strong></div>
                      <div><span>Tratos por dia</span><strong>{vl.daily_feeding_count || 1}</strong></div>
                    </div>
                  </div>

                  {/* Bloco 5: Fases */}
                  {fasesSorted.length > 0 && (
                    <div className={styles.modalSecao} style={{borderLeftColor:'#e65100'}}>
                      <div className={styles.modalSecaoTitulo} style={{color:'#e65100'}}>🌿 Fases de Dieta ({fasesSorted.length})</div>
                      {fasesSorted.map((fase, idx) => {
                        const fimTs = fase.end_date ? new Date(fase.end_date) : null;
                        const isConcluida = fimTs && fimTs < new Date();
                        const diasFase = fase.end_date
                          ? Math.floor((new Date(fase.end_date) - new Date(fase.start_date)) / 86400000)
                          : Math.floor((new Date() - new Date(fase.start_date)) / 86400000);
                        return (
                          <div key={fase.id} className={styles.modalFaseItem}>
                            <div className={styles.modalFaseHeader}>
                              <strong>{fase.phase_name}</strong>
                              <span className={isConcluida ? styles.badgeFaseConcluida : styles.badgeFaseEmProcesso}>
                                {isConcluida ? '✓ Concluída' : '⏳ Em Processo'}
                              </span>
                              <span className={styles.faseTimelineDias}>{diasFase}d</span>
                            </div>
                            <div className={styles.modalFaseDetalhes}>
                              {fase.feed_types?.name && <span>🌾 {fase.feed_types.name}</span>}
                              {fase.feed_types?.dry_matter_pct && <span>MS: {fase.feed_types.dry_matter_pct}%</span>}
                              {fase.cms_pct_pv && <span>CMS: {fase.cms_pct_pv}% PV</span>}
                              {fase.feed_types?.cost_per_kg && <span>R$ {Number(fase.feed_types.cost_per_kg).toFixed(4)}/kg</span>}
                              <span>📅 {new Date(fase.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} → {fase.end_date ? new Date(fase.end_date + 'T12:00:00').toLocaleDateString('pt-BR') : <em style={{color:'#e65100'}}>em andamento</em>}</span>
                            </div>
                            {fase.notes && <div style={{fontSize:'0.8rem',color:'#888',marginTop:'4px'}}>{fase.notes}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </Layout>
  );
}
