import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import styles from '../styles/Usuarios.module.css';

export default function Usuarios() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [fazendas, setFazendas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    farm_id: '',
    role_id: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    } else if (user) {
      loadData();
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: farmsData } = await supabase
        .from('farms')
        .select('*')
        .order('name');

      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .order('level');

      const usuariosComDados = (usersData || []).map(u => {
        const farm = farmsData?.find(f => f.id === u.farm_id);
        const role = rolesData?.find(r => r.id === u.role_id);
        return {
          ...u,
          farm_name: farm?.name,
          role_name: role?.name
        };
      });

      setUsuarios(usuariosComDados);
      setFazendas(farmsData || []);
      setRoles(rolesData || []);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Chamar função SQL que cria tudo de uma vez
      const { data, error } = await supabase.rpc('criar_usuario_completo', {
        p_email: formData.email,
        p_password: formData.password,
        p_name: formData.name,
        p_phone: formData.phone || null,
        p_farm_id: formData.farm_id,
        p_role_id: formData.role_id
      });

      if (error) {
        throw error;
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Erro ao criar usuário');
      }

      alert('✅ Usuário criado com sucesso!');
      
      setShowForm(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        farm_id: '',
        role_id: '',
      });
      loadData();
    } catch (error) {
      console.error('Erro:', error);
      alert('❌ Erro ao criar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja realmente deletar este usuário?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('✅ Usuário deletado!');
      loadData();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  if (authLoading || !user) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Usuários ({usuarios.length})</h1>
          <button 
            className={styles.btnAdd}
            onClick={() => {
              setShowForm(!showForm);
              setFormData({
                name: '',
                email: '',
                password: '',
                phone: '',
                farm_id: '',
                role_id: '',
              });
            }}
          >
            {showForm ? 'Cancelar' : '+ Novo Usuário'}
          </button>
        </div>

        {showForm && (
          <div className={styles.formCard}>
            <h2>Novo Usuário</h2>
            <form onSubmit={handleSubmit}>
              <div>
                <label>Nome Completo *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className={styles.row}>
                <div>
                  <label>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Senha *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    minLength="6"
                    required
                  />
                </div>
              </div>

              <div>
                <label>Telefone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className={styles.row}>
                <div>
                  <label>Fazenda *</label>
                  <select
                    value={formData.farm_id}
                    onChange={(e) => setFormData({ ...formData, farm_id: e.target.value })}
                    required
                  >
                    <option value="">Selecione...</option>
                    {fazendas.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Perfil *</label>
                  <select
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    required
                  >
                    <option value="">Selecione...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Criando...' : 'Criar Usuário'}
              </button>
            </form>
          </div>
        )}

        <div className={styles.list}>
          {loading ? (
            <p>Carregando...</p>
          ) : usuarios.length === 0 ? (
            <p>Nenhum usuário cadastrado</p>
          ) : (
            usuarios.map((usuario) => (
              <div key={usuario.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>{usuario.name}</h3>
                    <p className={styles.email}>{usuario.email}</p>
                  </div>
                  <div className={styles.actions}>
                    <button onClick={() => handleDelete(usuario.id)}>Deletar</button>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <p>📍 {usuario.farm_name || 'Não definida'}</p>
                  <p>👤 {usuario.role_name || 'Não definido'}</p>
                  {usuario.phone && <p>📞 {usuario.phone}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
