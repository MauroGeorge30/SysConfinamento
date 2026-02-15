import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/Farms.module.css';

export default function Farms() {
  const { userProfile, permissions } = useAuth();
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    owner: '',
    capacity: '',
    default_feed_limit: '',
    area_hectares: '',
    cnpj: '',
    phone: '',
    email: '',
    status: 'active'
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFarms();
  }, []);

  const loadFarms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .order('name');

      if (error) throw error;
      setFarms(data || []);
    } catch (err) {
      setError('Erro ao carregar fazendas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        // Atualizar fazenda existente
        const { error: updateError } = await supabase
          .from('farms')
          .update({
            name: formData.name,
            location: formData.location,
            owner: formData.owner,
            capacity: parseInt(formData.capacity),
            default_feed_limit: parseFloat(formData.default_feed_limit),
            area_hectares: formData.area_hectares ? parseFloat(formData.area_hectares) : null,
            cnpj: formData.cnpj,
            phone: formData.phone,
            email: formData.email,
            status: formData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        // Criar nova fazenda
        const { error: insertError } = await supabase
          .from('farms')
          .insert({
            name: formData.name,
            location: formData.location,
            owner: formData.owner,
            capacity: parseInt(formData.capacity),
            default_feed_limit: parseFloat(formData.default_feed_limit),
            area_hectares: formData.area_hectares ? parseFloat(formData.area_hectares) : null,
            cnpj: formData.cnpj,
            phone: formData.phone,
            email: formData.email,
            status: 'active'
          });

        if (insertError) throw insertError;
      }

      resetForm();
      loadFarms();
    } catch (err) {
      setError(err.message || 'Erro ao salvar fazenda');
      console.error(err);
    }
  };

  const handleEdit = (farm) => {
    setFormData({
      name: farm.name,
      location: farm.location || '',
      owner: farm.owner || '',
      capacity: farm.capacity?.toString() || '',
      default_feed_limit: farm.default_feed_limit?.toString() || '',
      area_hectares: farm.area_hectares?.toString() || '',
      cnpj: farm.cnpj || '',
      phone: farm.phone || '',
      email: farm.email || '',
      status: farm.status
    });
    setEditingId(farm.id);
    setShowForm(true);
  };

  const handleDelete = async (farmId) => {
    if (!confirm('Deseja realmente excluir esta fazenda? Esta ação não pode ser desfeita.')) return;

    try {
      // Verifica se há dados vinculados
      const { data: cattle } = await supabase
        .from('cattle')
        .select('id')
        .eq('farm_id', farmId)
        .limit(1);

      if (cattle && cattle.length > 0) {
        setError('Não é possível excluir esta fazenda pois há animais cadastrados nela.');
        return;
      }

      const { error } = await supabase
        .from('farms')
        .update({ status: 'inactive' })
        .eq('id', farmId);

      if (error) throw error;
      loadFarms();
    } catch (err) {
      setError('Erro ao excluir fazenda');
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      owner: '',
      capacity: '',
      default_feed_limit: '',
      area_hectares: '',
      cnpj: '',
      phone: '',
      email: '',
      status: 'active'
    });
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const canCreate = permissions.settings?.can_create || userProfile?.role?.level <= 2;
  const canEdit = permissions.settings?.can_edit || userProfile?.role?.level <= 2;
  const canDelete = permissions.settings?.can_delete || userProfile?.role?.level === 1;

  if (loading) {
    return (
      <Layout>
        <div className="loading-overlay">
          <div className="spinner" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🏡 Gerenciamento de Fazendas</h1>
          {canCreate && !showForm && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              + Nova Fazenda
            </button>
          )}
        </div>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        {showForm && (
          <div className="card">
            <div className={styles.formHeader}>
              <h2>{editingId ? 'Editar Fazenda' : 'Nova Fazenda'}</h2>
              <button 
                className="btn btn-sm"
                onClick={resetForm}
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Nome da Fazenda *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Localização *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Cidade - UF"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Proprietário *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.owner}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">CNPJ</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Capacidade de Confinamento *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    min="1"
                    required
                  />
                  <small className="form-help">Número de animais</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Limite Padrão de Alimentação por Baia *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={formData.default_feed_limit}
                    onChange={(e) => setFormData({ ...formData, default_feed_limit: e.target.value })}
                    min="0"
                    required
                  />
                  <small className="form-help">Em kg</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Área Total (hectares)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={formData.area_hectares}
                    onChange={(e) => setFormData({ ...formData, area_hectares: e.target.value })}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 0000-0000"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                {editingId && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Ativa</option>
                      <option value="inactive">Inativa</option>
                    </select>
                  </div>
                )}
              </div>

              <div className={styles.formActions}>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Atualizar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <h2>Fazendas Cadastradas</h2>
          
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Localização</th>
                  <th>Proprietário</th>
                  <th>Capacidade</th>
                  <th>Limite Alimentação</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {farms.map(farm => (
                  <tr key={farm.id}>
                    <td><strong>{farm.name}</strong></td>
                    <td>{farm.location}</td>
                    <td>{farm.owner}</td>
                    <td>{farm.capacity} animais</td>
                    <td>{farm.default_feed_limit} kg/baia</td>
                    <td>
                      <span className={`badge ${
                        farm.status === 'active' ? 'badge-success' : 'badge-danger'
                      }`}>
                        {farm.status === 'active' ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {canEdit && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleEdit(farm)}
                          >
                            Editar
                          </button>
                        )}
                        {canDelete && farm.status === 'active' && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(farm.id)}
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {farms.length === 0 && (
            <div className={styles.emptyState}>
              <p>Nenhuma fazenda cadastrada ainda.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
