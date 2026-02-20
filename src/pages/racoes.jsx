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
  const [formData, setFormData] = useState({ name: '', composition: '', cost_per_kg: '' });

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
    setFormData({ name: '', composition: '', cost_per_kg: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('Nome é obrigatório.');
    if (!formData.cost_per_kg || isNaN(formData.cost_per_kg)) return alert('Custo por kg inválido.');
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        composition: formData.composition || null,
        cost_per_kg: parseFloat(formData.cost_per_kg),
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
    setFormData({ name: r.name, composition: r.composition || '', cost_per_kg: r.cost_per_kg });
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
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Milho Moído, Silagem" required />
                </div>
                <div>
                  <label>Custo por kg (R$) *</label>
                  <input type="number" value={formData.cost_per_kg} onChange={(e) => setFormData({ ...formData, cost_per_kg: e.target.value })} placeholder="Ex: 1.50" step="0.01" min="0" required />
                </div>
              </div>
              <div className={styles.rowFull}>
                <div>
                  <label>Composição / Observações</label>
                  <input type="text" value={formData.composition} onChange={(e) => setFormData({ ...formData, composition: e.target.value })} placeholder="Ex: 60% milho, 30% soja, 10% sal mineral" />
                </div>
              </div>
              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                <button type="submit" disabled={loading}>{loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar Ração'}</button>
              </div>
            </form>
          </div>
        )}

        {loading ? <p className={styles.vazio}>Carregando...</p> :
          racoes.length === 0 ? <p className={styles.vazio}>Nenhuma ração cadastrada.</p> : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Composição</th>
                  <th>Custo por kg</th>
                  {(canEdit('feed_types') || canDelete('feed_types')) && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {racoes.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.composition || '-'}</td>
                    <td>R$ {Number(r.cost_per_kg).toFixed(2)}/kg</td>
                    {(canEdit('feed_types') || canDelete('feed_types')) && (
                      <td className={styles.acoes}>
                        {canEdit('feed_types') && <button className={styles.btnEditar} onClick={() => handleEdit(r)}>Editar</button>}
                        {canDelete('feed_types') && <button className={styles.btnDeletar} onClick={() => handleDelete(r.id)}>Deletar</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
