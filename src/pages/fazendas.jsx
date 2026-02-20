import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Fazendas.module.css';

export default function Fazendas() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { canCreate, canEdit, canDelete, isViewer, isOperator } = usePermissions();
  
  const [fazendas, setFazendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    owner: '',
    capacity: '1000',
    default_feed_limit: '800',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    } else if (user) {
      // Operadores e Visualizadores não podem acessar gerenciamento de fazendas
      if (isViewer() || isOperator()) {
        alert('Você não tem permissão para acessar esta página');
        router.push('/dashboard');
        return;
      }
      loadFazendas();
    }
  }, [user, authLoading, router, userProfile]);

  const loadFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingId && !canEdit('farms')) {
      alert('Você não tem permissão para editar fazendas');
      return;
    }

    if (!editingId && !canCreate('farms')) {
      alert('Você não tem permissão para criar fazendas');
      return;
    }

    setLoading(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from('farms')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        alert('✅ Fazenda atualizada!');
      } else {
        const { error } = await supabase
          .from('farms')
          .insert([{ ...formData, status: 'active' }]);

        if (error) throw error;
        alert('✅ Fazenda criada!');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        location: '',
        owner: '',
        capacity: '1000',
        default_feed_limit: '800',
      });
      loadFazendas();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (fazenda) => {
    if (!canEdit('farms')) {
      alert('Você não tem permissão para editar fazendas');
      return;
    }

    setFormData({
      name: fazenda.name,
      location: fazenda.location,
      owner: fazenda.owner,
      capacity: fazenda.capacity,
      default_feed_limit: fazenda.default_feed_limit,
    });
    setEditingId(fazenda.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!canDelete('farms')) {
      alert('Você não tem permissão para deletar fazendas');
      return;
    }

    if (!confirm('Deseja realmente deletar esta fazenda?')) return;

    try {
      const { error } = await supabase
        .from('farms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('✅ Fazenda deletada!');
      loadFazendas();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  if (authLoading || !user) {
    return <div className="loading">Carregando...</div>;
  }

  // Bloquear visualizadores e operadores
  if (isViewer() || isOperator()) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>⛔ Acesso Negado</h2>
          <p>Você não tem permissão para acessar esta página.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Fazendas ({fazendas.length})</h1>
          {canCreate('farms') && (
            <button 
              className={styles.btnAdd}
              onClick={() => {
                setShowForm(!showForm);
                setEditingId(null);
                setFormData({
                  name: '',
                  location: '',
                  owner: '',
                  capacity: '1000',
                  default_feed_limit: '800',
                });
              }}
            >
              {showForm ? 'Cancelar' : '+ Nova Fazenda'}
            </button>
          )}
        </div>

        {showForm && (canCreate('farms') || (editingId && canEdit('farms'))) && (
          <div className={styles.formCard}>
            <h2>{editingId ? 'Editar Fazenda' : 'Nova Fazenda'}</h2>
            <form onSubmit={handleSubmit}>
              <div>
                <label>Nome da Fazenda *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className={styles.row}>
                <div>
                  <label>Localização *</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Cidade - UF"
                    required
                  />
                </div>
                <div>
                  <label>Proprietário *</label>
                  <input
                    type="text"
                    value={formData.owner}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div>
                  <label>Capacidade (animais) *</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label>Limite de Ração (kg) *</label>
                  <input
                    type="number"
                    value={formData.default_feed_limit}
                    onChange={(e) => setFormData({ ...formData, default_feed_limit: e.target.value })}
                    min="0"
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Fazenda'}
              </button>
            </form>
          </div>
        )}

        <div className={styles.list}>
          {loading ? (
            <p>Carregando fazendas...</p>
          ) : fazendas.length === 0 ? (
            <p>Nenhuma fazenda cadastrada</p>
          ) : (
            fazendas.map((fazenda) => (
              <div key={fazenda.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>{fazenda.name}</h3>
                  {(canEdit('farms') || canDelete('farms')) && (
                    <div className={styles.actions}>
                      {canEdit('farms') && (
                        <button onClick={() => handleEdit(fazenda)}>Editar</button>
                      )}
                      {canDelete('farms') && (
                        <button onClick={() => handleDelete(fazenda.id)}>Deletar</button>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <p>📍 {fazenda.location}</p>
                  <p>👤 {fazenda.owner}</p>
                  <p>🐂 Capacidade: {fazenda.capacity} animais</p>
                  <p>🥣 Limite ração: {fazenda.default_feed_limit} kg</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
