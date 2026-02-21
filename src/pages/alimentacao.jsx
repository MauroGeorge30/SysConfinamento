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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtroBaia, setFiltroBaia] = useState('');
  const [filtroData, setFiltroData] = useState('');

  const hoje = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [formData, setFormData] = useState({
    pen_id: '', lot_id: '', feed_type_id: '',
    quantity_kg: '', leftover_kg: '', feeding_date: hoje, notes: '',
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: regData, error: regError }, { data: baiasData }, { data: racoesData }, { data: lotesData }] = await Promise.all([
        supabase.from('feeding_records')
          .select('*, pens(pen_number), feed_types(name, cost_per_kg, dry_matter_pct), lots(lot_code)')
          .eq('farm_id', currentFarm.id)
          .order('feeding_date', { ascending: false })
          .limit(200),
        supabase.from('pens').select('id, pen_number').eq('farm_id', currentFarm.id).eq('status', 'active').order('pen_number'),
        supabase.from('feed_types').select('id, name, cost_per_kg, dry_matter_pct').eq('farm_id', currentFarm.id).order('name'),
        supabase.from('lots').select('id, lot_code, pen_id, head_count').eq('farm_id', currentFarm.id).eq('status', 'active').order('lot_code'),
      ]);
      if (regError) throw regError;
      setRegistros(regData || []);
      setBaias(baiasData || []);
      setRacoes(racoesData || []);
      setLotes(lotesData || []);
    } catch (error) {
      alert('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ pen_id: '', lot_id: '', feed_type_id: '', quantity_kg: '', leftover_kg: '', feeding_date: hoje, notes: '' });
    setShowForm(false);
  };

  // Ao selecionar baia, auto-preenche lote ativo da baia
  const handleBaiaChange = (penId) => {
    const loteNaBaia = lotes.find(l => l.pen_id === penId);
    setFormData(prev => ({
      ...prev,
      pen_id: penId,
      lot_id: loteNaBaia?.id || '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.pen_id) return alert('Selecione uma baia.');
    if (!formData.feed_type_id) return alert('Selecione o tipo de ração.');
    if (!formData.quantity_kg || isNaN(formData.quantity_kg)) return alert('Quantidade inválida.');
    if (formData.leftover_kg && parseFloat(formData.leftover_kg) > parseFloat(formData.quantity_kg)) {
      return alert('❌ Sobra não pode ser maior que o fornecido.');
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('feeding_records').insert([{
        pen_id: formData.pen_id,
        lot_id: formData.lot_id || null,
        feed_type_id: formData.feed_type_id,
        quantity_kg: parseFloat(formData.quantity_kg),
        leftover_kg: formData.leftover_kg ? parseFloat(formData.leftover_kg) : null,
        feeding_date: formData.feeding_date,
        notes: formData.notes || null,
        farm_id: currentFarm.id,
        registered_by: user.id,
      }]);
      if (error) throw error;
      alert('✅ Trato registrado!');
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

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  // Preview de cálculos no formulário
  const racaoSelecionada = racoes.find(r => r.id === formData.feed_type_id);
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
  const totalCustoHoje = registrosHoje.reduce((acc, r) => acc + (Number(r.quantity_kg) * Number(r.feed_types?.cost_per_kg || 0)), 0);
  const baiasAlimentadasHoje = new Set(registrosHoje.map(r => r.pen_id)).size;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🌿 Tratos Diários</h1>
          {canCreate('feeding_records') && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? 'Cancelar' : '+ Registrar Trato'}
            </button>
          )}
        </div>

        {/* Resumo do dia */}
        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <span>Baias com Trato Hoje</span>
            <strong>{baiasAlimentadasHoje}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Fornecido Hoje</span>
            <strong>{totalFornecidoHoje.toFixed(0)} kg</strong>
          </div>
          <div className={styles.resumoCard} style={{ borderLeftColor: totalSobraHoje > 0 ? '#f57c00' : '#2e7d32' }}>
            <span>Sobra Hoje</span>
            <strong style={{ color: totalSobraHoje > 0 ? '#f57c00' : '#2e7d32' }}>
              {totalSobraHoje.toFixed(0)} kg
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
            <h2>➕ Registrar Trato</h2>
            {racoes.length === 0 && (
              <div className={styles.aviso}>⚠️ Nenhuma ração cadastrada. Cadastre em <strong>Rações</strong> primeiro.</div>
            )}
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Data *</label>
                  <input type="date" value={formData.feeding_date} onChange={(e) => setFormData({ ...formData, feeding_date: e.target.value })} required />
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
                  <label>Lote (auto-preenchido pela baia)</label>
                  <select value={formData.lot_id} onChange={(e) => setFormData({ ...formData, lot_id: e.target.value })}>
                    <option value="">— Sem lote —</option>
                    {lotes.map(l => <option key={l.id} value={l.id}>{l.lot_code} ({l.head_count} cab.)</option>)}
                  </select>
                </div>
                <div>
                  <label>Ração *</label>
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
                <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Registrar Trato'}</button>
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

        {/* Tabela */}
        {loading ? <p className={styles.vazio}>Carregando...</p> :
          registrosFiltrados.length === 0 ? <p className={styles.vazio}>Nenhum registro encontrado.</p> : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Baia</th>
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
                {registrosFiltrados.map((r) => {
                  const fornecido = Number(r.quantity_kg);
                  const sobra = Number(r.leftover_kg || 0);
                  const consumidoR = fornecido - sobra;
                  const sobraP = fornecido > 0 && r.leftover_kg != null ? ((sobra / fornecido) * 100).toFixed(1) : null;
                  const custo = fornecido * Number(r.feed_types?.cost_per_kg || 0);
                  return (
                    <tr key={r.id}>
                      <td>{new Date(r.feeding_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                      <td>{r.pens?.pen_number ? `${r.pens.pen_number}` : '—'}</td>
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
                        <td><button className={styles.btnDeletar} onClick={() => handleDelete(r.id)}>Deletar</button></td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4"><strong>Total filtrado</strong></td>
                  <td><strong>{registrosFiltrados.reduce((acc, r) => acc + Number(r.quantity_kg), 0).toFixed(1)} kg</strong></td>
                  <td><strong>{registrosFiltrados.reduce((acc, r) => acc + Number(r.leftover_kg || 0), 0).toFixed(1)} kg</strong></td>
                  <td></td>
                  <td><strong>{registrosFiltrados.reduce((acc, r) => acc + Number(r.quantity_kg) - Number(r.leftover_kg || 0), 0).toFixed(1)} kg</strong></td>
                  <td><strong>R$ {registrosFiltrados.reduce((acc, r) => acc + Number(r.quantity_kg) * Number(r.feed_types?.cost_per_kg || 0), 0).toFixed(2)}</strong></td>
                  {canDelete('feeding_records') && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
