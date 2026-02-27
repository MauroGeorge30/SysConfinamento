import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Usuarios.module.css';

export default function Usuarios() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { canCreate, canEdit, canDelete, isViewer, isOperator } = usePermissions();

  const [usuarios, setUsuarios] = useState([]);
  const [fazendas, setFazendas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Painel de acesso a fazendas
  const [accessPanel, setAccessPanel] = useState(null); // { usuario }
  const [userFarmAccess, setUserFarmAccess] = useState([]); // fazendas que o usuário tem acesso
  const [savingAccess, setSavingAccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', phone: '', farm_id: '', role_id: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    } else if (user) {
      if (isViewer() || isOperator()) {
        alert('Você não tem permissão para acessar esta página');
        router.push('/dashboard');
        return;
      }
      loadData();
    }
  }, [user, authLoading, router, userProfile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: usersData }, { data: farmsData }, { data: rolesData }] = await Promise.all([
        supabase.from('users').select('*').order('name', { ascending: true }),
        supabase.from('farms').select('*').order('name', { ascending: true }),
        supabase.from('roles').select('*').order('level', { ascending: true }),
      ]);

      const usuariosComDados = (usersData || []).map(u => ({
        ...u,
        farm_name: farmsData?.find(f => f.id === u.farm_id)?.name,
        role_name: rolesData?.find(r => r.id === u.role_id)?.name,
      }));

      setUsuarios(usuariosComDados);
      setFazendas(farmsData || []);
      setRoles(rolesData || []);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Abrir form novo ──────────────────────────────────────────
  const openNew = () => {
    setEditingId(null);
    setFormData({ name: '', email: '', password: '', phone: '', farm_id: '', role_id: '' });
    setShowForm(true);
    setAccessPanel(null);
  };

  // ── Abrir form edição ────────────────────────────────────────
  const openEdit = (u) => {
    setEditingId(u.id);
    setFormData({ name: u.name, email: u.email, password: '', phone: u.phone || '', farm_id: u.farm_id || '', role_id: u.role_id || '' });
    setShowForm(true);
    setAccessPanel(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', email: '', password: '', phone: '', farm_id: '', role_id: '' });
  };

  // ── Submit: criar ou editar ──────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        // Editar — atualiza campos na tabela users (sem mexer na senha se vazia)
        const updates = {
          name: formData.name,
          phone: formData.phone || null,
          farm_id: formData.farm_id,
          role_id: formData.role_id,
        };
        const { error } = await supabase.from('users').update(updates).eq('id', editingId);
        if (error) throw error;

        // Se informou nova senha, atualiza via RPC (precisa de função no banco)
        if (formData.password && formData.password.length >= 6) {
          const { error: pwErr } = await supabase.rpc('atualizar_senha_usuario', {
            p_user_id: editingId,
            p_password: formData.password,
          });
          // Ignora erro de senha se a função não existir ainda
          if (pwErr) console.warn('Senha não atualizada (função RPC ausente):', pwErr.message);
        }
        alert('✅ Usuário atualizado!');
      } else {
        // Criar novo via RPC existente
        const { data, error } = await supabase.rpc('criar_usuario_completo', {
          p_email: formData.email,
          p_password: formData.password,
          p_name: formData.name,
          p_phone: formData.phone || null,
          p_farm_id: formData.farm_id,
          p_role_id: formData.role_id,
        });
        if (error) throw error;
        if (data && !data.success) throw new Error(data.error);
        alert('✅ Usuário criado com sucesso!');
      }

      closeForm();
      loadData();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Deletar ──────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!canDelete('users')) { alert('Sem permissão'); return; }
    if (!confirm('Deseja realmente deletar este usuário?')) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      alert('✅ Usuário deletado!');
      loadData();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  // ── Painel de acesso a fazendas ──────────────────────────────
  const openAccessPanel = async (usuario) => {
    setAccessPanel(usuario);
    setShowForm(false);
    // Carrega os IDs de fazendas que o usuário já tem acesso
    try {
      const { data, error } = await supabase
        .from('user_farm_access')
        .select('farm_id')
        .eq('user_id', usuario.id);
      if (error) throw error;
      const ids = (data || []).map(r => r.farm_id);
      // Garante que a fazenda principal também está marcada
      if (usuario.farm_id && !ids.includes(usuario.farm_id)) ids.push(usuario.farm_id);
      setUserFarmAccess(ids);
    } catch (err) {
      // Tabela pode não existir ainda — mostra só a fazenda principal
      setUserFarmAccess(usuario.farm_id ? [usuario.farm_id] : []);
    }
  };

  const toggleFarmAccess = (farmId) => {
    // Fazenda principal não pode ser desmarcada
    if (farmId === accessPanel?.farm_id) return;
    setUserFarmAccess(prev =>
      prev.includes(farmId) ? prev.filter(id => id !== farmId) : [...prev, farmId]
    );
  };

  const saveAccessPanel = async () => {
    if (!accessPanel) return;
    setSavingAccess(true);
    try {
      // Deleta acessos extras existentes
      await supabase.from('user_farm_access').delete().eq('user_id', accessPanel.id);

      // Insere os selecionados (exceto a fazenda principal, que já está em users.farm_id)
      const extras = userFarmAccess.filter(id => id !== accessPanel.farm_id);
      if (extras.length > 0) {
        const rows = extras.map(farm_id => ({ user_id: accessPanel.id, farm_id }));
        const { error } = await supabase.from('user_farm_access').insert(rows);
        if (error) throw error;
      }

      alert('✅ Acessos salvos!');
      setAccessPanel(null);
    } catch (err) {
      alert('❌ Erro ao salvar acessos: ' + err.message + '\n\nVerifique se a tabela user_farm_access existe no banco. Execute o SQL de migração fornecido.');
    } finally {
      setSavingAccess(false);
    }
  };

  if (authLoading || !user) return <div>Carregando...</div>;
  if (isViewer() || isOperator()) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>⛔ Acesso Negado</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.container}>

        {/* ── Cabeçalho ── */}
        <div className={styles.header}>
          <h1>👤 Usuários ({usuarios.length})</h1>
          {canCreate('users') && (
            <button className={styles.btnAdd} onClick={showForm && !editingId ? closeForm : openNew}>
              {showForm && !editingId ? '✕ Cancelar' : '+ Novo Usuário'}
            </button>
          )}
        </div>

        {/* ── Formulário criar / editar ── */}
        {showForm && (
          <div className={styles.formCard}>
            <div className={styles.formCardHeader}>
              <h2>{editingId ? '✏️ Editar Usuário' : '➕ Novo Usuário'}</h2>
              <button className={styles.btnFechar} onClick={closeForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div>
                <label>Nome Completo *</label>
                <input type="text" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>

              <div className={styles.row}>
                <div>
                  <label>Email *</label>
                  <input type="email" value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    required disabled={!!editingId}
                    style={editingId ? { background: '#f5f5f5', color: '#999' } : {}} />
                  {editingId && <small style={{color:'#aaa'}}>Email não pode ser alterado</small>}
                </div>
                <div>
                  <label>{editingId ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}</label>
                  <input type="password" value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    minLength={editingId ? 0 : 6}
                    required={!editingId}
                    placeholder={editingId ? 'Digite para alterar...' : ''} />
                </div>
              </div>

              <div>
                <label>Telefone</label>
                <input type="tel" value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000" />
              </div>

              <div className={styles.row}>
                <div>
                  <label>Fazenda Principal *</label>
                  <select value={formData.farm_id}
                    onChange={e => setFormData({ ...formData, farm_id: e.target.value })} required>
                    <option value="">Selecione...</option>
                    {fazendas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Perfil *</label>
                  <select value={formData.role_id}
                    onChange={e => setFormData({ ...formData, role_id: e.target.value })} required>
                    <option value="">Selecione...</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.formBtns}>
                <button type="submit" className={styles.btnSalvar} disabled={loading}>
                  {loading ? 'Salvando...' : editingId ? '💾 Salvar Alterações' : '✅ Criar Usuário'}
                </button>
                <button type="button" className={styles.btnCancelar} onClick={closeForm}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* ── Painel de acesso a fazendas ── */}
        {accessPanel && (
          <div className={styles.accessPanel}>
            <div className={styles.accessPanelHeader}>
              <div>
                <h2>🏡 Acesso a Fazendas</h2>
                <p className={styles.accessPanelSub}>
                  Usuário: <strong>{accessPanel.name}</strong>
                </p>
              </div>
              <button className={styles.btnFechar} onClick={() => setAccessPanel(null)}>✕</button>
            </div>
            <p className={styles.accessPanelInfo}>
              Selecione as fazendas que este usuário poderá acessar além da fazenda principal.
              A fazenda principal (marcada com 🏠) não pode ser removida.
            </p>
            <div className={styles.farmCheckList}>
              {fazendas.map(f => {
                const isPrincipal = f.id === accessPanel.farm_id;
                const checked = userFarmAccess.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className={`${styles.farmCheckItem} ${isPrincipal ? styles.farmCheckPrincipal : ''} ${checked ? styles.farmCheckChecked : ''}`}
                    onClick={() => toggleFarmAccess(f.id)}
                  >
                    <span className={styles.farmCheckBox}>
                      {checked ? '✓' : ''}
                    </span>
                    <span className={styles.farmCheckInfo}>
                      <strong>{f.name}</strong>
                      <small>{f.location}</small>
                    </span>
                    {isPrincipal && <span className={styles.farmPrincipalBadge}>🏠 Principal</span>}
                  </label>
                );
              })}
            </div>
            <div className={styles.accessPanelBtns}>
              <button className={styles.btnSalvar} onClick={saveAccessPanel} disabled={savingAccess}>
                {savingAccess ? 'Salvando...' : '💾 Salvar Acessos'}
              </button>
              <button className={styles.btnCancelar} onClick={() => setAccessPanel(null)}>Cancelar</button>
            </div>
          </div>
        )}

        {/* ── Lista de usuários ── */}
        <div className={styles.list}>
          {loading ? (
            <p>Carregando...</p>
          ) : usuarios.length === 0 ? (
            <p>Nenhum usuário cadastrado</p>
          ) : (
            usuarios.map(u => (
              <div key={u.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>{u.name}</h3>
                    <p className={styles.email}>{u.email}</p>
                  </div>
                  <div className={styles.actions}>
                    <button className={styles.btnAcesso} onClick={() => openAccessPanel(u)}
                      title="Gerenciar acesso a fazendas">
                      🏡 Fazendas
                    </button>
                    {canEdit && (
                      <button className={styles.btnEditar} onClick={() => openEdit(u)}>✏️ Editar</button>
                    )}
                    {canDelete('users') && (
                      <button className={styles.btnDeletar} onClick={() => handleDelete(u.id)}>🗑 Deletar</button>
                    )}
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <span className={styles.infoTag}>📍 {u.farm_name || 'Não definida'}</span>
                  <span className={styles.infoTag}>👤 {u.role_name || 'Não definido'}</span>
                  {u.phone && <span className={styles.infoTag}>📞 {u.phone}</span>}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </Layout>
  );
}
