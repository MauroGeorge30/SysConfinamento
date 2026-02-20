import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Baias.module.css';

export default function Baias() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canEdit, canDelete, isViewer, isOperator } = usePermissions();

  const [baias, setBaias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    pen_number: '',
    capacity: '',
    status: 'active',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    } else if (user) {
      if (isViewer()) {
        alert('Você não tem permissão para acessar esta página');
        router.push('/dashboard');
        return;
      }
      loadBaias();
    }
  }, [user, authLoading, router, userProfile, currentFarm]);

  const loadBaias = async () => {
    if (!currentFarm?.id) return;
    try {
      const { data, error } = await supabase
        .from('pens')
        .select('*')
        .eq('farm_id', currentFarm.id)
        .order('pen_number', { ascending: true });

      if (error) throw error;
      setBaias(data || []);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ pen_number: '', capacity: '', status: 'active' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingId && !canEdit('pens')) {
      alert('Você não tem permissão para editar baias');
      return;
    }
    if (!editingId && !canCreate('pens')) {
      alert('Você não tem permissão para criar baias');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('pens')
          .update({
            pen_number: formData.pen_number,
            capacity: parseInt(formData.capacity),
            status: formData.status,
          })
          .eq('id', editingId);

        if (error) throw error;
        alert('✅ Baia atualizada!');
      } else {
        const { error } = await supabase
          .from('pens')
          .insert([{
            pen_number: formData.pen_number,
            capacity: parseInt(formData.capacity),
            current_occupancy: 0,
            status: 'active',
            farm_id: currentFarm.id,
          }]);

        if (error) throw error;
        alert('✅ Baia cadastrada!');
      }

      resetForm();
      loadBaias();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (baia) => {
    if (!canEdit('pens')) {
      alert('Você não tem permissão para editar baias');
      return;
    }
    setFormData({
      pen_number: baia.pen_number,
      capacity: baia.capacity,
      status: baia.status,
    });
    setEditingId(baia.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!canDelete('pens')) {
      alert('Você não tem permissão para deletar baias');
      return;
    }
    if (!confirm('Deseja realmente deletar esta baia?')) return;

    try {
      const { error } = await supabase
        .from('pens')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('✅ Baia deletada!');
      loadBaias();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  if (authLoading || !user) {
    return <div className="loading">Carregando...</div>;
  }

  if (isViewer()) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>⛔ Acesso Negado</h2>
          <p>Você não tem permissão para acessar esta página.</p>
        </div>
      </Layout>
    );
  }

  const totalCapacidade = baias.reduce((acc, b) => acc + (b.capacity || 0), 0);
  const totalOcupacao = baias.reduce((acc, b) => acc + (b.current_occupancy || 0), 0);

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Baias / Cochos ({baias.length})</h1>
          {canCreate('pens') && (
            <button
              className={styles.btnAdd}
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
            >
              {showForm && !editingId ? 'Cancelar' : '+ Nova Baia'}
            </button>
          )}
        </div>

        {/* Cards resumo */}
        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <span>Total de Baias</span>
            <strong>{baias.length}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Capacidade Total</span>
            <strong>{totalCapacidade} animais</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Ocupação Atual</span>
            <strong>{totalOcupacao} animais</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Vagas Disponíveis</span>
            <strong>{totalCapacidade - totalOcupacao} animais</strong>
          </div>
        </div>

        {/* Formulário */}
        {showForm && (canCreate('pens') || (editingId && canEdit('pens'))) && (
          <div className={styles.formCard}>
            <h2>{editingId ? 'Editar Baia' : 'Nova Baia'}</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Número / Identificação da Baia *</label>
                  <input
                    type="text"
                    value={formData.pen_number}
                    onChange={(e) => setFormData({ ...formData, pen_number: e.target.value })}
                    placeholder="Ex: 01, A, Curral 1"
                    required
                  />
                </div>
                <div>
                  <label>Capacidade (animais) *</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    placeholder="Ex: 50"
                    min="1"
                    required
                  />
                </div>
              </div>

              {editingId && (
                <div>
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Ativa</option>
                    <option value="inactive">Inativa</option>
                  </select>
                </div>
              )}

              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : editingId ? 'Atualizar Baia' : 'Cadastrar Baia'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista */}
        <div className={styles.list}>
          {loading ? (
            <p>Carregando baias...</p>
          ) : baias.length === 0 ? (
            <p>Nenhuma baia cadastrada. Clique em &quot;+ Nova Baia&quot; para começar.</p>
          ) : (
            baias.map((baia) => {
              const ocupacaoPct = baia.capacity > 0
                ? Math.round((baia.current_occupancy / baia.capacity) * 100)
                : 0;
              const corBarra = ocupacaoPct >= 90 ? '#c62828' : ocupacaoPct >= 70 ? '#e65100' : '#2e7d32';

              return (
                <div key={baia.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3>Baia {baia.pen_number}</h3>
                    <div className={styles.cardHeaderRight}>
                      <span className={baia.status === 'active' ? styles.statusAtivo : styles.statusInativo}>
                        {baia.status === 'active' ? 'Ativa' : 'Inativa'}
                      </span>
                      {(canEdit('pens') || canDelete('pens')) && (
                        <div className={styles.actions}>
                          {canEdit('pens') && (
                            <button onClick={() => handleEdit(baia)}>Editar</button>
                          )}
                          {canDelete('pens') && (
                            <button onClick={() => handleDelete(baia.id)}>Deletar</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.ocupacaoInfo}>
                      <span>🐂 {baia.current_occupancy || 0} / {baia.capacity} animais</span>
                      <span>{ocupacaoPct}%</span>
                    </div>
                    <div className={styles.barraFundo}>
                      <div
                        className={styles.barraPreenchimento}
                        style={{ width: `${Math.min(ocupacaoPct, 100)}%`, background: corBarra }}
                      />
                    </div>
                    <p className={styles.vagas}>
                      {baia.capacity - (baia.current_occupancy || 0)} vagas disponíveis
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
