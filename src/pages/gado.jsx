import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Gado.module.css';

export default function Gado() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canEdit, canDelete, isViewer } = usePermissions();

  const [gado, setGado] = useState([]);
  const [baias, setBaias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filtros, setFiltros] = useState({ busca: '', sexo: '', status: 'active' });

  const [formData, setFormData] = useState({
    tag_number: '',
    name: '',
    sex: 'macho',
    breed: '',
    entry_date: new Date().toISOString().split('T')[0],
    entry_weight: '',
    pen_id: '',
    status: 'active',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    } else if (user && currentFarm) {
      loadDados();
    }
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    try {
      const [{ data: gadoData, error: gadoError }, { data: baiasData }] = await Promise.all([
        supabase
          .from('cattle')
          .select('*, pens(pen_number)')
          .eq('farm_id', currentFarm.id)
          .order('tag_number'),
        supabase
          .from('pens')
          .select('id, pen_number, capacity, current_occupancy')
          .eq('farm_id', currentFarm.id)
          .eq('status', 'active')
          .order('pen_number'),
      ]);

      if (gadoError) throw gadoError;
      setGado(gadoData || []);
      setBaias(baiasData || []);
    } catch (error) {
      console.error('Erro ao carregar:', error);
      alert('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      tag_number: '',
      name: '',
      sex: 'macho',
      breed: '',
      entry_date: new Date().toISOString().split('T')[0],
      entry_weight: '',
      pen_id: '',
      status: 'active',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.tag_number.trim()) {
      alert('Número do brinco é obrigatório.');
      return;
    }
    if (!formData.entry_weight || isNaN(formData.entry_weight)) {
      alert('Peso de entrada inválido.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        tag_number: formData.tag_number,
        name: formData.name || null,
        sex: formData.sex,
        breed: formData.breed || null,
        entry_date: formData.entry_date,
        entry_weight: parseFloat(formData.entry_weight),
        pen_id: formData.pen_id || null,
        status: formData.status,
        farm_id: currentFarm.id,
      };

      if (editingId) {
        const { error } = await supabase.from('cattle').update(payload).eq('id', editingId);
        if (error) throw error;
        alert('✅ Animal atualizado!');
      } else {
        const { error } = await supabase.from('cattle').insert([payload]);
        if (error) throw error;
        alert('✅ Animal cadastrado!');
      }

      resetForm();
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (animal) => {
    setFormData({
      tag_number: animal.tag_number || '',
      name: animal.name || '',
      sex: animal.sex || 'macho',
      breed: animal.breed || '',
      entry_date: animal.entry_date || new Date().toISOString().split('T')[0],
      entry_weight: animal.entry_weight || '',
      pen_id: animal.pen_id || '',
      status: animal.status || 'active',
    });
    setEditingId(animal.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('cattle').delete().eq('id', id);
      if (error) throw error;
      alert('✅ Animal removido!');
      setConfirmDelete(null);
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  if (authLoading || !user) {
    return <div className="loading">Carregando...</div>;
  }

  const gadoFiltrado = gado.filter((a) => {
    const buscaMatch =
      !filtros.busca ||
      a.tag_number?.toLowerCase().includes(filtros.busca.toLowerCase()) ||
      a.name?.toLowerCase().includes(filtros.busca.toLowerCase()) ||
      a.breed?.toLowerCase().includes(filtros.busca.toLowerCase());
    const sexoMatch = !filtros.sexo || a.sex === filtros.sexo;
    const statusMatch = !filtros.status || a.status === filtros.status;
    return buscaMatch && sexoMatch && statusMatch;
  });

  const totalAtivos = gado.filter((a) => a.status === 'active').length;
  const totalMachos = gado.filter((a) => a.sex === 'macho' && a.status === 'active').length;
  const totalFemeas = gado.filter((a) => a.sex === 'femea' && a.status === 'active').length;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🐂 Cadastro de Gado ({totalAtivos} ativos)</h1>
          {canCreate('cattle') && (
            <button
              className={styles.btnAdd}
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
            >
              {showForm && !editingId ? 'Cancelar' : '+ Novo Animal'}
            </button>
          )}
        </div>

        {/* Resumo */}
        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <span>Total Ativo</span>
            <strong>{totalAtivos}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>🐂 Machos</span>
            <strong>{totalMachos}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>🐄 Fêmeas</span>
            <strong>{totalFemeas}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Baias Ativas</span>
            <strong>{baias.length}</strong>
          </div>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className={styles.formCard}>
            <h2>{editingId ? 'Editar Animal' : 'Novo Animal'}</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Nº Brinco *</label>
                  <input
                    type="text"
                    value={formData.tag_number}
                    onChange={(e) => setFormData({ ...formData, tag_number: e.target.value })}
                    placeholder="Ex: 001, A-023"
                    required
                  />
                </div>
                <div>
                  <label>Nome (opcional)</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Valentão"
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div>
                  <label>Sexo *</label>
                  <select
                    value={formData.sex}
                    onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                    required
                  >
                    <option value="macho">Macho</option>
                    <option value="femea">Fêmea</option>
                  </select>
                </div>
                <div>
                  <label>Raça</label>
                  <input
                    type="text"
                    value={formData.breed}
                    onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                    placeholder="Ex: Nelore, Angus"
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div>
                  <label>Data de Entrada *</label>
                  <input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Peso de Entrada (kg) *</label>
                  <input
                    type="number"
                    value={formData.entry_weight}
                    onChange={(e) => setFormData({ ...formData, entry_weight: e.target.value })}
                    placeholder="Ex: 320.5"
                    step="0.1"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div>
                  <label>Baia</label>
                  <select
                    value={formData.pen_id}
                    onChange={(e) => setFormData({ ...formData, pen_id: e.target.value })}
                  >
                    <option value="">Sem baia definida</option>
                    {baias.map((b) => (
                      <option key={b.id} value={b.id}>
                        Baia {b.pen_number} ({b.current_occupancy}/{b.capacity})
                      </option>
                    ))}
                  </select>
                </div>
                {editingId && (
                  <div>
                    <label>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Ativo</option>
                      <option value="sold">Vendido</option>
                      <option value="dead">Morto</option>
                    </select>
                  </div>
                )}
              </div>

              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : editingId ? 'Atualizar Animal' : 'Cadastrar Animal'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filtros */}
        <div className={styles.filtros}>
          <input
            type="text"
            placeholder="Buscar por brinco, nome ou raça..."
            value={filtros.busca}
            onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
            className={styles.inputBusca}
          />
          <select
            value={filtros.sexo}
            onChange={(e) => setFiltros({ ...filtros, sexo: e.target.value })}
          >
            <option value="">Todos os sexos</option>
            <option value="macho">Macho</option>
            <option value="femea">Fêmea</option>
          </select>
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
          >
            <option value="active">Ativo</option>
            <option value="sold">Vendido</option>
            <option value="dead">Morto</option>
            <option value="">Todos</option>
          </select>
        </div>

        {/* Lista */}
        {loading ? (
          <p>Carregando...</p>
        ) : gadoFiltrado.length === 0 ? (
          <p className={styles.vazio}>
            {gado.length === 0
              ? 'Nenhum animal cadastrado.'
              : 'Nenhum animal encontrado com os filtros aplicados.'}
          </p>
        ) : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Brinco</th>
                  <th>Nome</th>
                  <th>Sexo</th>
                  <th>Raça</th>
                  <th>Peso Entrada</th>
                  <th>Data Entrada</th>
                  <th>Baia</th>
                  <th>Status</th>
                  {(canEdit('cattle') || canDelete('cattle')) && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {gadoFiltrado.map((animal) => (
                  <tr key={animal.id}>
                    <td><strong>{animal.tag_number}</strong></td>
                    <td>{animal.name || '-'}</td>
                    <td>
                      <span className={animal.sex === 'macho' ? styles.badgeMacho : styles.badgeFemea}>
                        {animal.sex === 'macho' ? '🐂 Macho' : '🐄 Fêmea'}
                      </span>
                    </td>
                    <td>{animal.breed || '-'}</td>
                    <td>{animal.entry_weight ? `${Number(animal.entry_weight).toFixed(1)} kg` : '-'}</td>
                    <td>{animal.entry_date ? new Date(animal.entry_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                    <td>{animal.pens?.pen_number ? `Baia ${animal.pens.pen_number}` : '-'}</td>
                    <td>
                      <span className={styles[`status_${animal.status}`]}>
                        {animal.status === 'active' ? 'Ativo' : animal.status === 'sold' ? 'Vendido' : 'Morto'}
                      </span>
                    </td>
                    {(canEdit('cattle') || canDelete('cattle')) && (
                      <td className={styles.acoes}>
                        {canEdit('cattle') && (
                          <button className={styles.btnEditar} onClick={() => handleEdit(animal)}>Editar</button>
                        )}
                        {canDelete('cattle') && (
                          <button className={styles.btnDeletar} onClick={() => setConfirmDelete(animal)}>Deletar</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className={styles.totalRegistros}>{gadoFiltrado.length} animal(is) exibido(s)</p>
      </div>

      {/* Modal Confirmar Delete */}
      {confirmDelete && (
        <div className={styles.modalOverlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.modalConfirm} onClick={(e) => e.stopPropagation()}>
            <h3>Remover Animal</h3>
            <p>
              Tem certeza que deseja remover o animal{' '}
              <strong>Brinco {confirmDelete.tag_number}</strong>
              {confirmDelete.name ? ` (${confirmDelete.name})` : ''}?
            </p>
            <p className={styles.avisoDelete}>Esta ação não pode ser desfeita.</p>
            <div className={styles.formAcoes}>
              <button className={styles.btnCancelar} onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button className={styles.btnDanger} onClick={() => handleDelete(confirmDelete.id)}>
                Sim, Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
