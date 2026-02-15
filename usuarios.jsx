import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/Users.module.css';

export default function Users() {
  const { userProfile, permissions } = useAuth();
  const [users, setUsers] = useState([]);
  const [farms, setFarms] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    farm_id: '',
    role_id: '',
    phone: '',
    status: 'active'
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carrega usuários
      const { data: usersData } = await supabase
        .from('users')
        .select(`
          *,
          farm:farms(name),
          role:roles(name)
        `)
        .order('name');

      // Carrega fazendas
      const { data: farmsData } = await supabase
        .from('farms')
        .select('*')
        .order('name');

      // Carrega perfis
      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .order('level');

      setUsers(usersData || []);
      setFarms(farmsData || []);
      setRoles(rolesData || []);
    } catch (err) {
      setError('Erro ao carregar dados');
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
        // Atualizar usuário existente
        const { error: updateError } = await supabase
          .from('users')
          .update({
            name: formData.name,
            farm_id: formData.farm_id,
            role_id: formData.role_id,
            phone: formData.phone,
            status: formData.status
          })
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        // Criar novo usuário
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });

        if (authError) throw authError;

        // Criar perfil do usuário
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            name: formData.name,
            email: formData.email,
            farm_id: formData.farm_id,
            role_id: formData.role_id,
            phone: formData.phone,
            status: 'active',
            default_farm_id: formData.farm_id
          });

        if (profileError) throw profileError;

        // Criar permissões padrão baseado no perfil
        await createDefaultPermissions(authData.user.id, formData.role_id);
      }

      resetForm();
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao salvar usuário');
      console.error(err);
    }
  };

  const createDefaultPermissions = async (userId, roleId) => {
    // Define permissões padrão baseado no perfil
    const modules = [
      'dashboard',
      'cattle',
      'feeding',
      'finance',
      'reports',
      'settings'
    ];

    const { data: role } = await supabase
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single();

    const permissions = modules.map(module => ({
      user_id: userId,
      module: module,
      can_view: true,
      can_create: role?.level <= 2, // Admin e Gerente podem criar
      can_edit: role?.level <= 2,
      can_delete: role?.level === 1 // Só admin pode deletar
    }));

    await supabase.from('user_permissions').insert(permissions);
  };

  const handleEdit = (user) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      farm_id: user.farm_id,
      role_id: user.role_id,
      phone: user.phone || '',
      status: user.status
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleDelete = async (userId) => {
    if (!confirm('Deseja realmente excluir este usuário?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId);

      if (error) throw error;
      loadData();
    } catch (err) {
      setError('Erro ao excluir usuário');
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      farm_id: '',
      role_id: '',
      phone: '',
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
          <h1>👥 Gerenciamento de Usuários</h1>
          {canCreate && !showForm && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              + Novo Usuário
            </button>
          )}
        </div>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        {showForm && (
          <div className="card">
            <div className={styles.formHeader}>
              <h2>{editingId ? 'Editar Usuário' : 'Novo Usuário'}</h2>
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
                  <label className="form-label">Nome Completo *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!!editingId}
                    required
                  />
                </div>

                {!editingId && (
                  <div className="form-group">
                    <label className="form-label">Senha *</label>
                    <input
                      type="password"
                      className="form-input"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      minLength={6}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fazenda *</label>
                  <select
                    className="form-select"
                    value={formData.farm_id}
                    onChange={(e) => setFormData({ ...formData, farm_id: e.target.value })}
                    required
                  >
                    <option value="">Selecione...</option>
                    {farms.map(farm => (
                      <option key={farm.id} value={farm.id}>
                        {farm.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Perfil de Acesso *</label>
                  <select
                    className="form-select"
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    required
                  >
                    <option value="">Selecione...</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                {editingId && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
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
          <h2>Usuários Cadastrados</h2>
          
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Fazenda</th>
                  <th>Perfil</th>
                  <th>Telefone</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.farm?.name}</td>
                    <td>{user.role?.name}</td>
                    <td>{user.phone || '-'}</td>
                    <td>
                      <span className={`badge ${
                        user.status === 'active' ? 'badge-success' : 'badge-danger'
                      }`}>
                        {user.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {canEdit && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleEdit(user)}
                          >
                            Editar
                          </button>
                        )}
                        {canDelete && user.status === 'active' && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(user.id)}
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
        </div>
      </div>
    </Layout>
  );
}
