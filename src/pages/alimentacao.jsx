import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Alimentacao.module.css';

export default function Alimentacao() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canDelete, isViewer } = usePermissions();

  const [registros, setRegistros] = useState([]);
  const [baias, setBaias] = useState([]);
  const [racoes, setRacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtroBaia, setFiltroBaia] = useState('');
  const [filtroData, setFiltroData] = useState('');

  const hoje = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const [formData, setFormData] = useState({
    pen_id: '', feed_type_id: '', quantity_kg: '', feeding_date: hoje, notes: '',
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: regData, error: regError }, { data: baiasData }, { data: racoesData }] = await Promise.all([
        supabase.from('feeding_records')
          .select('*, pens(pen_number), feed_types(name, cost_per_kg)')
          .eq('farm_id', currentFarm.id)
          .order('feeding_date', { ascending: false })
          .limit(200),
        supabase.from('pens').select('id, pen_number').eq('farm_id', currentFarm.id).eq('status', 'active').order('pen_number'),
        supabase.from('feed_types').select('id, name, cost_per_kg').eq('farm_id', currentFarm.id).order('name'),
      ]);
      if (regError) throw regError;
      setRegistros(regData || []);
      setBaias(baiasData || []);
      setRacoes(racoesData || []);
    } catch (error) {
      alert('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ pen_id: '', feed_type_id: '', quantity_kg: '', feeding_date: hoje, notes: '' });
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.pen_id) return alert('Selecione uma baia.');
    if (!formData.feed_type_id) return alert('Selecione o tipo de ração.');
    if (!formData.quantity_kg || isNaN(formData.quantity_kg)) return alert('Quantidade inválida.');
    setLoading(true);
    try {
      const { error } = await supabase.from('feeding_records').insert([{
        pen_id: formData.pen_id,
        feed_type_id: formData.feed_type_id,
        quantity_kg: parseFloat(formData.quantity_kg),
        feeding_date: formData.feeding_date,
        farm_id: currentFarm.id,
        registered_by: user.id,
      }]);
      if (error) throw error;
      alert('✅ Alimentação registrada!');
      resetForm();
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja remover este registro?')) return;
    try {
      const { error } = await supabase.from('feeding_records').delete().eq('id', id);
      if (error) throw error;
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  const registrosFiltrados = registros.filter((r) => {
    const baiaMatch = !filtroBaia || r.pen_id === filtroBaia;
    const dataMatch = !filtroData || r.feeding_date === filtroData;
    return baiaMatch && dataMatch;
  });

  // Totais do dia de hoje
  const registrosHoje = registros.filter(r => r.feeding_date === hoje);
  const totalKgHoje = registrosHoje.reduce((acc, r) => acc + Number(r.quantity_kg), 0);
  const totalCustoHoje = registrosHoje.reduce((acc, r) => acc + (Number(r.quantity_kg) * Number(r.feed_types?.cost_per_kg || 0)), 0);
  const baiasAlimentadasHoje = new Set(registrosHoje.map(r => r.pen_id)).size;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🌿 Registro de Alimentação</h1>
          {canCreate('feeding_records') && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? 'Cancelar' : '+ Registrar Alimentação'}
            </button>
          )}
        </div>

        {/* Resumo do dia */}
        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <span>Baias Alimentadas Hoje</span>
            <strong>{baiasAlimentadasHoje}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Total Fornecido Hoje</span>
            <strong>{totalKgHoje.toFixed(0)} kg</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Custo Hoje</span>
            <strong>R$ {totalCustoHoje.toFixed(2)}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Registros Hoje</span>
            <strong>{registrosHoje.length}</strong>
          </div>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className={styles.formCard}>
            <h2>➕ Registrar Alimentação</h2>
            {racoes.length === 0 && (
              <div className={styles.aviso}>⚠️ Nenhuma ração cadastrada. Cadastre em <strong>Rações</strong> primeiro.</div>
            )}
            {baias.length === 0 && (
              <div className={styles.aviso}>⚠️ Nenhuma baia cadastrada. Cadastre em <strong>Baias</strong> primeiro.</div>
            )}
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Data *</label>
                  <input type="date" value={formData.feeding_date} onChange={(e) => setFormData({ ...formData, feeding_date: e.target.value })} required />
                </div>
                <div>
                  <label>Baia *</label>
                  <select value={formData.pen_id} onChange={(e) => setFormData({ ...formData, pen_id: e.target.value })} required>
                    <option value="">Selecione a baia</option>
                    {baias.map(b => <option key={b.id} value={b.id}>Baia {b.pen_number}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Tipo de Ração *</label>
                  <select value={formData.feed_type_id} onChange={(e) => setFormData({ ...formData, feed_type_id: e.target.value })} required>
                    <option value="">Selecione a ração</option>
                    {racoes.map(r => <option key={r.id} value={r.id}>{r.name} — R$ {Number(r.cost_per_kg).toFixed(2)}/kg</option>)}
                  </select>
                </div>
                <div>
                  <label>Quantidade (kg) *</label>
                  <input type="number" value={formData.quantity_kg} onChange={(e) => setFormData({ ...formData, quantity_kg: e.target.value })} placeholder="Ex: 150" step="0.1" min="0" required />
                </div>
              </div>
              {/* Preview custo */}
              {formData.quantity_kg && formData.feed_type_id && (() => {
                const racao = racoes.find(r => r.id === formData.feed_type_id);
                if (!racao) return null;
                const custo = parseFloat(formData.quantity_kg) * Number(racao.cost_per_kg);
                return <div className={styles.previewCusto}>💰 Custo estimado: <strong>R$ {custo.toFixed(2)}</strong></div>;
              })()}
              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Filtros */}
        <div className={styles.filtros}>
          <input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} className={styles.inputData} title="Filtrar por data" />
          <select value={filtroBaia} onChange={(e) => setFiltroBaia(e.target.value)}>
            <option value="">Todas as baias</option>
            {baias.map(b => <option key={b.id} value={b.id}>Baia {b.pen_number}</option>)}
          </select>
          {(filtroBaia || filtroData) && (
            <button className={styles.btnLimpar} onClick={() => { setFiltroBaia(''); setFiltroData(''); }}>✕ Limpar filtros</button>
          )}
        </div>

        {/* Tabela */}
        {loading ? <p className={styles.vazio}>Carregando...</p> :
          registrosFiltrados.length === 0 ? <p className={styles.vazio}>Nenhum registro encontrado.</p> : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Baia</th>
                  <th>Ração</th>
                  <th>Quantidade</th>
                  <th>Custo</th>
                  {canDelete('feeding_records') && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {registrosFiltrados.map((r) => {
                  const custo = Number(r.quantity_kg) * Number(r.feed_types?.cost_per_kg || 0);
                  return (
                    <tr key={r.id}>
                      <td>{new Date(r.feeding_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                      <td>{r.pens?.pen_number ? `Baia ${r.pens.pen_number}` : '-'}</td>
                      <td>{r.feed_types?.name || '-'}</td>
                      <td>{Number(r.quantity_kg).toFixed(1)} kg</td>
                      <td>R$ {custo.toFixed(2)}</td>
                      {canDelete('feeding_records') && (
                        <td><button className={styles.btnDeletar} onClick={() => handleDelete(r.id)}>Deletar</button></td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3"><strong>Total filtrado</strong></td>
                  <td><strong>{registrosFiltrados.reduce((acc, r) => acc + Number(r.quantity_kg), 0).toFixed(1)} kg</strong></td>
                  <td><strong>R$ {registrosFiltrados.reduce((acc, r) => acc + Number(r.quantity_kg) * Number(r.feed_types?.cost_per_kg || 0), 0).toFixed(2)}</strong></td>
                  {canDelete('feeding_records') && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
