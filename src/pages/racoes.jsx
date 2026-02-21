import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Racoes.module.css';

export default function Racoes() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canEdit, canDelete, isViewer } = usePermissions();

  const [racoes, setRacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', composition: '', cost_per_kg: '', dry_matter_pct: '',
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadRacoes();
  }, [user, authLoading, currentFarm]);

  const loadRacoes = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_types')
        .select('*')
        .eq('farm_id', currentFarm.id)
        .order('name');
      if (error) throw error;
      setRacoes(data || []);
    } catch (error) {
      alert('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', composition: '', cost_per_kg: '', dry_matter_pct: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('Nome é obrigatório.');
    if (!formData.cost_per_kg || isNaN(formData.cost_per_kg)) return alert('Custo por kg inválido.');
    if (formData.dry_matter_pct && (isNaN(formData.dry_matter_pct) || parseFloat(formData.dry_matter_pct) > 100)) {
      return alert('MS% deve ser um número entre 0 e 100.');
    }
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        composition: formData.composition || null,
        cost_per_kg: parseFloat(formData.cost_per_kg),
        dry_matter_pct: formData.dry_matter_pct ? parseFloat(formData.dry_matter_pct) : null,
        farm_id: currentFarm.id,
      };
      if (editingId) {
        const { error } = await supabase.from('feed_types').update(payload).eq('id', editingId);
        if (error) throw error;
        alert('✅ Ração atualizada!');
      } else {
        const { error } = await supabase.from('feed_types').insert([payload]);
        if (error) throw error;
        alert('✅ Ração cadastrada!');
      }
      resetForm();
      loadRacoes();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (r) => {
    setFormData({
      name: r.name,
      composition: r.composition || '',
      cost_per_kg: r.cost_per_kg,
      dry_matter_pct: r.dry_matter_pct || '',
    });
    setEditingId(r.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja realmente deletar esta ração?')) return;
    try {
      const { error } = await supabase.from('feed_types').delete().eq('id', id);
      if (error) throw error;
      alert('✅ Ração removida!');
      loadRacoes();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🌾 Tipos de Ração ({racoes.length})</h1>
          {canCreate('feed_types') && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm && !editingId ? 'Cancelar' : '+ Nova Ração'}
            </button>
          )}
        </div>

        {showForm && (
          <div className={styles.formCard}>
            <h2>{editingId ? '✏️ Editar Ração' : '➕ Nova Ração'}</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Nome da Ração *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Silagem de Milho, Ração Terminação"
                    required
                  />
                </div>
                <div>
                  <label>Custo por kg MN (R$) *</label>
                  <input
                    type="number"
                    value={formData.cost_per_kg}
                    onChange={(e) => setFormData({ ...formData, cost_per_kg: e.target.value })}
                    placeholder="Ex: 0.73"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Matéria Seca — MS% <span style={{ color: '#888', fontWeight: 400 }}>(Fundamental para CMS)</span></label>
                  <input
                    type="number"
                    value={formData.dry_matter_pct}
                    onChange={(e) => setFormData({ ...formData, dry_matter_pct: e.target.value })}
                    placeholder="Ex: 54.0"
                    step="0.1"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  {/* Preview de custo por kg MS */}
                  {formData.cost_per_kg && formData.dry_matter_pct && (
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                      <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '10px 14px', fontSize: '0.88rem', color: '#2e7d32' }}>
                        💡 Custo por kg MS: <strong>R$ {(parseFloat(formData.cost_per_kg) / (parseFloat(formData.dry_matter_pct) / 100)).toFixed(4)}</strong>
                        <br />
                        <small>(custo MN ÷ MS%)</small>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.rowFull}>
                <div>
                  <label>Composição / Observações</label>
                  <input
                    type="text"
                    value={formData.composition}
                    onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                    placeholder="Ex: 60% milho, 30% soja, 10% sal mineral"
                  />
                </div>
              </div>
              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar Ração'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? <p className={styles.vazio}>Carregando...</p> :
          racoes.length === 0 ? (
            <div className={styles.vazio}>
              <p style={{ fontSize: '2rem' }}>🌾</p>
              <p>Nenhuma ração cadastrada.</p>
              <p style={{ fontSize: '0.85rem', color: '#aaa' }}>Cadastre os tipos de ração antes de criar lotes e registrar tratos.</p>
            </div>
          ) : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>MS%</th>
                  <th>Custo MN (R$/kg)</th>
                  <th>Custo MS (R$/kg)</th>
                  <th>Composição</th>
                  {(canEdit('feed_types') || canDelete('feed_types')) && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {racoes.map((r) => {
                  const custoMS = r.dry_matter_pct
                    ? (r.cost_per_kg / (r.dry_matter_pct / 100)).toFixed(4)
                    : null;
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong></td>
                      <td>
                        {r.dry_matter_pct
                          ? <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem' }}>{Number(r.dry_matter_pct).toFixed(1)}%</span>
                          : <span style={{ color: '#f57c00', fontSize: '0.82rem' }}>⚠️ Não informado</span>
                        }
                      </td>
                      <td>R$ {Number(r.cost_per_kg).toFixed(2)}/kg</td>
                      <td>{custoMS ? `R$ ${custoMS}/kg` : '—'}</td>
                      <td style={{ fontSize: '0.88rem', color: '#666' }}>{r.composition || '—'}</td>
                      {(canEdit('feed_types') || canDelete('feed_types')) && (
                        <td>
                          <div className={styles.acoes}>
                            {canEdit('feed_types') && <button className={styles.btnEditar} onClick={() => handleEdit(r)}>Editar</button>}
                            {canDelete('feed_types') && <button className={styles.btnDeletar} onClick={() => handleDelete(r.id)}>Deletar</button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
