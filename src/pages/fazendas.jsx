import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import styles from '../styles/Fazendas.module.css';

export default function Fazendas() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
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
      loadFazendas();
    }
  }, [user, authLoading, router]);

  const loadFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      console.error('Erro ao carregar fazendas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        // Atualizar
        const { error } = await supabase
          .from('farms')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        // Criar
        const { error } = await supabase
          .from('farms')
          .insert([{ ...formData, status: 'active' }]);

        if (error) throw error;
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
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (fazenda) => {
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
    if (!confirm('Deseja realmente deletar esta fazenda?')) return;

    try {
      const { error } = await supabase
        .from('farms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadFazendas();
    } catch (error) {
      alert('Erro ao deletar: ' + error.message);
    }
  };

  if (authLoading || !user) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Fazendas</h1>
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
        </div>

        {showForm && (
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
                  <div className={styles.actions}>
                    <button onClick={() => handleEdit(fazenda)}>Editar</button>
                    <button onClick={() => handleDelete(fazenda.id)}>Deletar</button>
                  </div>
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
