import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Gado.module.css';

export default function Gado() {
  const { userProfile, currentFarm } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions('cattle');

  const [gado, setGado] = useState([]);
  const [baias, setBaias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [filtros, setFiltros] = useState({ busca: '', sexo: '', status: 'active' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [form, setForm] = useState({
    tag_number: '',
    name: '',
    sex: 'macho',
    breed: '',
    entry_date: new Date().toISOString().split('T')[0],
    entry_weight: '',
    pen_id: '',
    status: 'active',
  });

  const resetForm = () => {
    setForm({
      tag_number: '',
      name: '',
      sex: 'macho',
      breed: '',
      entry_date: new Date().toISOString().split('T')[0],
      entry_weight: '',
      pen_id: '',
      status: 'active',
    });
    setEditando(null);
    setErro('');
  };

  const carregarDados = useCallback(async () => {
    if (!currentFarm?.id) return;
    setLoading(true);
    try {
      const [{ data: gadoData }, { data: baiasData }] = await Promise.all([
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
      setGado(gadoData || []);
      setBaias(baiasData || []);
    } catch (err) {
      setErro('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [currentFarm?.id]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const abrirModal = (animal = null) => {
    if (animal) {
      setEditando(animal);
      setForm({
        tag_number: animal.tag_number || '',
        name: animal.name || '',
        sex: animal.sex || 'macho',
        breed: animal.breed || '',
        entry_date: animal.entry_date || new Date().toISOString().split('T')[0],
        entry_weight: animal.entry_weight || '',
        pen_id: animal.pen_id || '',
        status: animal.status || 'active',
      });
    } else {
      resetForm();
    }
    setShowModal(true);
    setErro('');
    setSucesso('');
  };

  const fecharModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.tag_number.trim()) return setErro('Número do brinco é obrigatório.');
    if (!form.entry_weight || isNaN(form.entry_weight)) return setErro('Peso de entrada inválido.');
    setSalvando(true);
    setErro('');
    try {
      const payload = {
        ...form,
        farm_id: currentFarm.id,
        entry_weight: parseFloat(form.entry_weight),
        pen_id: form.pen_id || null,
        name: form.name || null,
        breed: form.breed || null,
      };
      if (editando) {
        const { error } = await supabase.from('cattle').update(payload).eq('id', editando.id);
        if (error) throw error;
        setSucesso('Animal atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('cattle').insert([payload]);
        if (error) throw error;
        setSucesso('Animal cadastrado com sucesso!');
      }
      fecharModal();
      carregarDados();
      setTimeout(() => setSucesso(''), 4000);
    } catch (err) {
      setErro(err.message || 'Erro ao salvar animal.');
    } finally {
      setSalvando(false);
    }
  };

  const deletar = async (id) => {
    try {
      const { error } = await supabase.from('cattle').delete().eq('id', id);
      if (error) throw error;
      setSucesso('Animal removido.');
      setConfirmDelete(null);
      carregarDados();
      setTimeout(() => setSucesso(''), 3000);
    } catch (err) {
      setErro('Erro ao remover animal.');
    }
  };

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

  const totalMachos = gado.filter((a) => a.sex === 'macho' && a.status === 'active').length;
  const totalFemeas = gado.filter((a) => a.sex === 'femea' && a.status === 'active').length;
  const totalAtivos = gado.filter((a) => a.status === 'active').length;

  if (!currentFarm) {
    return (
      <Layout>
        <div className={styles.semFazenda}>Nenhuma fazenda selecionada.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.container}>
        {/* Cabeçalho */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.titulo}>🐂 Cadastro de Gado</h1>
            <p className={styles.subtitulo}>{currentFarm.name}</p>
          </div>
          {canCreate && (
            <button className={styles.btnPrimario} onClick={() => abrirModal()}>
              + Novo Animal
            </button>
          )}
        </div>

        {/* Cards de Resumo */}
        <div className={styles.resumo}>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Total Ativo</span>
            <span className={styles.cardValor}>{totalAtivos}</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>🐂 Machos</span>
            <span className={styles.cardValor}>{totalMachos}</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>🐄 Fêmeas</span>
            <span className={styles.cardValor}>{totalFemeas}</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Baias Ativas</span>
            <span className={styles.cardValor}>{baias.length}</span>
          </div>
        </div>

        {/* Alertas */}
        {sucesso && <div className={styles.alertSucesso}>{sucesso}</div>}
        {erro && !showModal && <div className={styles.alertErro}>{erro}</div>}

        {/* Filtros */}
        <div className={styles.filtros}>
          <input
            type="text"
            placeholder="Buscar por brinco, nome ou raça..."
            value={filtros.busca}
            onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
            className={styles.inputBusca}
          />
          <select
            value={filtros.sexo}
            onChange={(e) => setFiltros((f) => ({ ...f, sexo: e.target.value }))}
            className={styles.selectFiltro}
          >
            <option value="">Todos os sexos</option>
            <option value="macho">Macho</option>
            <option value="femea">Fêmea</option>
          </select>
          <select
            value={filtros.status}
            onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}
            className={styles.selectFiltro}
          >
            <option value="active">Ativo</option>
            <option value="sold">Vendido</option>
            <option value="dead">Morto</option>
            <option value="">Todos</option>
          </select>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className={styles.loading}>Carregando...</div>
        ) : gadoFiltrado.length === 0 ? (
          <div className={styles.vazio}>
            {gado.length === 0
              ? 'Nenhum animal cadastrado. Clique em "+ Novo Animal" para começar.'
              : 'Nenhum animal encontrado com os filtros aplicados.'}
          </div>
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
                  {(canEdit || canDelete) && <th>Ações</th>}
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
                    {(canEdit || canDelete) && (
                      <td className={styles.acoes}>
                        {canEdit && (
                          <button className={styles.btnEditar} onClick={() => abrirModal(animal)}>
                            ✏️
                          </button>
                        )}
                        {canDelete && (
                          <button className={styles.btnDeletar} onClick={() => setConfirmDelete(animal)}>
                            🗑️
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.totalRegistros}>
          {gadoFiltrado.length} animal(is) exibido(s)
        </div>
      </div>

      {/* Modal Formulário */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={fecharModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editando ? 'Editar Animal' : 'Novo Animal'}</h2>
              <button className={styles.btnFechar} onClick={fecharModal}>✕</button>
            </div>
            <form onSubmit={salvar} className={styles.form}>
              {erro && <div className={styles.alertErro}>{erro}</div>}

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Nº Brinco *</label>
                  <input
                    type="text"
                    name="tag_number"
                    value={form.tag_number}
                    onChange={handleChange}
                    placeholder="Ex: 001, A-023"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Nome (opcional)</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Ex: Boiada, Valentão"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Sexo *</label>
                  <select name="sex" value={form.sex} onChange={handleChange} required>
                    <option value="macho">Macho</option>
                    <option value="femea">Fêmea</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Raça</label>
                  <input
                    type="text"
                    name="breed"
                    value={form.breed}
                    onChange={handleChange}
                    placeholder="Ex: Nelore, Angus, Brangus"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Data de Entrada *</label>
                  <input
                    type="date"
                    name="entry_date"
                    value={form.entry_date}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Peso de Entrada (kg) *</label>
                  <input
                    type="number"
                    name="entry_weight"
                    value={form.entry_weight}
                    onChange={handleChange}
                    placeholder="Ex: 320.5"
                    step="0.1"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Baia</label>
                  <select name="pen_id" value={form.pen_id} onChange={handleChange}>
                    <option value="">Sem baia definida</option>
                    {baias.map((b) => (
                      <option key={b.id} value={b.id}>
                        Baia {b.pen_number} ({b.current_occupancy}/{b.capacity})
                      </option>
                    ))}
                  </select>
                </div>
                {editando && (
                  <div className={styles.formGroup}>
                    <label>Status</label>
                    <select name="status" value={form.status} onChange={handleChange}>
                      <option value="active">Ativo</option>
                      <option value="sold">Vendido</option>
                      <option value="dead">Morto</option>
                    </select>
                  </div>
                )}
              </div>

              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnSecundario} onClick={fecharModal}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimario} disabled={salvando}>
                  {salvando ? 'Salvando...' : editando ? 'Atualizar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação Delete */}
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
              <button className={styles.btnSecundario} onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button className={styles.btnDanger} onClick={() => deletar(confirmDelete.id)}>
                Sim, Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
