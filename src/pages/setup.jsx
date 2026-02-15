import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import styles from '../styles/Setup.module.css';

export default function Setup() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    userName: '',
    farmName: '',
    location: '',
    owner: '',
    capacity: '1000',
    defaultFeedLimit: '800',
    phone: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Criar a fazenda
      const { data: farm, error: farmError } = await supabase
        .from('farms')
        .insert({
          name: formData.farmName,
          location: formData.location,
          owner: formData.owner,
          capacity: parseInt(formData.capacity),
          default_feed_limit: parseFloat(formData.defaultFeedLimit),
          status: 'active'
        })
        .select()
        .single();

      if (farmError) throw farmError;

      // 2. Pegar o role de Administrador Geral
      const { data: adminRole, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('level', 1)
        .single();

      if (roleError) throw roleError;

      // 3. Criar perfil do usuário
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          name: formData.userName,
          email: user.email,
          phone: formData.phone,
          farm_id: farm.id,
          default_farm_id: farm.id,
          role_id: adminRole.id,
          status: 'active'
        });

      if (userError) throw userError;

      // 4. Criar permissões padrão de administrador
      const modules = ['dashboard', 'cattle', 'feeding', 'finance', 'reports', 'settings'];
      const permissions = modules.map(module => ({
        user_id: user.id,
        module: module,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true
      }));

      const { error: permError } = await supabase
        .from('user_permissions')
        .insert(permissions);

      if (permError) throw permError;

      // 5. Atualizar perfil e redirecionar
      await refreshProfile();
      router.push('/dashboard');

    } catch (err) {
      console.error('Erro no setup:', err);
      setError(err.message || 'Erro ao configurar sistema');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.setupBox}>
        <div className={styles.header}>
          <span className={styles.icon}>🎉</span>
          <h1>Bem-vindo ao Sistema de Confinamento!</h1>
          <p>Configure sua fazenda para começar a usar o sistema</p>
        </div>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.section}>
            <h2>Seus Dados</h2>
            
            <div className="form-group">
              <label className="form-label">Seu Nome Completo *</label>
              <input
                type="text"
                className="form-input"
                value={formData.userName}
                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                required
              />
            </div>

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
          </div>

          <div className={styles.section}>
            <h2>Dados da Fazenda</h2>

            <div className="form-group">
              <label className="form-label">Nome da Fazenda *</label>
              <input
                type="text"
                className="form-input"
                value={formData.farmName}
                onChange={(e) => setFormData({ ...formData, farmName: e.target.value })}
                placeholder="Ex: Fazenda Santa Clara"
                required
              />
            </div>

            <div className="grid grid-2">
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
            </div>

            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Capacidade do Confinamento *</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  min="1"
                  required
                />
                <small style={{ fontSize: 'var(--font-xs)', color: 'var(--text-light)' }}>
                  Número de animais
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Limite de Alimentação por Baia *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.defaultFeedLimit}
                  onChange={(e) => setFormData({ ...formData, defaultFeedLimit: e.target.value })}
                  min="0"
                  required
                />
                <small style={{ fontSize: 'var(--font-xs)', color: 'var(--text-light)' }}>
                  Em kg
                </small>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Configurando...' : 'Concluir Configuração'}
          </button>
        </form>
      </div>
    </div>
  );
}
