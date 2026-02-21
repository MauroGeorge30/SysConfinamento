import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Pesagens.module.css';

export default function Pesagens() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canDelete } = usePermissions();

  const [pesagens, setPesagens] = useState([]);
  const [gado, setGado] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtroBrinco, setFiltroBrinco] = useState('');

  const hoje = new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [formData, setFormData] = useState({ cattle_id: '', weight_kg: '', weighing_date: hoje });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: pesData, error: pesError }, { data: gadoData }] = await Promise.all([
        supabase.from('weighing_records')
          .select('*, cattle(tag_number, name, entry_weight, entry_date)')
          .eq('farm_id', currentFarm.id)
          .order('weighing_date', { ascending: false })
          .limit(300),
        supabase.from('cattle')
          .select('id, tag_number, name, entry_weight, entry_date')
          .eq('farm_id', currentFarm.id)
          .eq('status', 'active')
          .order('tag_number'),
      ]);
      if (pesError) throw pesError;
      setPesagens(pesData || []);
      setGado(gadoData || []);
    } catch (error) {
      alert('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ cattle_id: '', weight_kg: '', weighing_date: hoje });
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.cattle_id) return alert('Selecione o animal.');
    if (!formData.weight_kg || isNaN(formData.weight_kg)) return alert('Peso inválido.');
    setLoading(true);
    try {
      const { error } = await supabase.from('weighing_records').insert([{
        cattle_id: formData.cattle_id,
        weight_kg: parseFloat(formData.weight_kg),
        weighing_date: formData.weighing_date,
        farm_id: currentFarm.id,
        registered_by: user.id,
      }]);
      if (error) throw error;
      alert('✅ Pesagem registrada!');
      resetForm();
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja remover esta pesagem?')) return;
    try {
      const { error } = await supabase.from('weighing_records').delete().eq('id', id);
      if (error) throw error;
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  const calcGMD = (pesoAtual, pesoEntrada, dataEntrada, dataPesagem) => {
    if (!pesoEntrada || !dataEntrada) return '-';
    const dias = Math.floor((new Date(dataPesagem) - new Date(dataEntrada)) / (1000 * 60 * 60 * 24));
    if (dias <= 0) return '-';
    const gmd = (pesoAtual - pesoEntrada) / dias;
    return `${gmd.toFixed(3)} kg/dia`;
  };

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  const pesagensFiltradas = pesagens.filter(p =>
    !filtroBrinco || p.cattle?.tag_number?.toLowerCase().includes(filtroBrinco.toLowerCase())
  );

  // Animal selecionado para preview
  const animalSelecionado = gado.find(a => a.id === formData.cattle_id);
  const gmdPreview = animalSelecionado && formData.weight_kg
    ? calcGMD(parseFloat(formData.weight_kg), animalSelecionado.entry_weight, animalSelecionado.entry_date, formData.weighing_date)
    : null;

  const totalPesagens = pesagens.length;
  const pesagensHoje = pesagens.filter(p => p.weighing_date === hoje).length;
  const mediaGMD = pesagens.filter(p => {
    const animal = gado.find(a => a.id === p.cattle_id);
    if (!animal?.entry_weight || !animal?.entry_date) return false;
    const dias = Math.floor((new Date(p.weighing_date) - new Date(animal.entry_date)) / (1000 * 60 * 60 * 24));
    return dias > 0;
  }).reduce((acc, p, _, arr) => {
    const animal = gado.find(a => a.id === p.cattle_id);
    const dias = Math.floor((new Date(p.weighing_date) - new Date(animal.entry_date)) / (1000 * 60 * 60 * 24));
    return acc + (p.weight_kg - animal.entry_weight) / dias / arr.length;
  }, 0);

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>⚖️ Registro de Pesagens</h1>
          {canCreate('weighing_records') && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? 'Cancelar' : '+ Registrar Pesagem'}
            </button>
          )}
        </div>

        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <span>Total de Pesagens</span>
            <strong>{totalPesagens}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Pesagens Hoje</span>
            <strong>{pesagensHoje}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>GMD Médio Geral</span>
            <strong>{pesagens.length > 0 ? `${mediaGMD.toFixed(3)} kg/d` : '-'}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Animais Ativos</span>
            <strong>{gado.length}</strong>
          </div>
        </div>

        {showForm && (
          <div className={styles.formCard}>
            <h2>➕ Nova Pesagem</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Data da Pesagem *</label>
                  <input type="date" value={formData.weighing_date} onChange={(e) => setFormData({ ...formData, weighing_date: e.target.value })} required />
                </div>
                <div>
                  <label>Animal (Brinco) *</label>
                  <select value={formData.cattle_id} onChange={(e) => setFormData({ ...formData, cattle_id: e.target.value })} required>
                    <option value="">Selecione o animal</option>
                    {gado.map(a => <option key={a.id} value={a.id}>Brinco {a.tag_number}{a.name ? ` — ${a.name}` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Peso Atual (kg) *</label>
                  <input type="number" value={formData.weight_kg} onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })} placeholder="Ex: 380.5" step="0.1" min="0" required />
                </div>
                <div>
                  {animalSelecionado && (
                    <div className={styles.infoAnimal}>
                      <span>Peso entrada: <strong>{Number(animalSelecionado.entry_weight).toFixed(1)} kg</strong></span>
                      {gmdPreview && gmdPreview !== '-' && (
                        <span>GMD estimado: <strong>{gmdPreview}</strong></span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Registrar Pesagem'}</button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.filtros}>
          <input type="text" placeholder="Buscar por brinco..." value={filtroBrinco} onChange={(e) => setFiltroBrinco(e.target.value)} className={styles.inputBusca} />
          {filtroBrinco && <button className={styles.btnLimpar} onClick={() => setFiltroBrinco('')}>✕ Limpar</button>}
        </div>

        {loading ? <p className={styles.vazio}>Carregando...</p> :
          pesagensFiltradas.length === 0 ? <p className={styles.vazio}>Nenhuma pesagem registrada.</p> : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Brinco</th>
                  <th>Nome</th>
                  <th>Peso Entrada</th>
                  <th>Peso Atual</th>
                  <th>Ganho</th>
                  <th>GMD</th>
                  {canDelete('weighing_records') && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {pesagensFiltradas.map((p) => {
                  const ganho = p.cattle?.entry_weight ? Number(p.weight_kg) - Number(p.cattle.entry_weight) : null;
                  const gmd = calcGMD(p.weight_kg, p.cattle?.entry_weight, p.cattle?.entry_date, p.weighing_date);
                  return (
                    <tr key={p.id}>
                      <td>{new Date(p.weighing_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                      <td><strong>{p.cattle?.tag_number || '-'}</strong></td>
                      <td>{p.cattle?.name || '-'}</td>
                      <td>{p.cattle?.entry_weight ? `${Number(p.cattle.entry_weight).toFixed(1)} kg` : '-'}</td>
                      <td><strong>{Number(p.weight_kg).toFixed(1)} kg</strong></td>
                      <td>
                        {ganho !== null && (
                          <span className={ganho >= 0 ? styles.ganhoPositivo : styles.ganhoNegativo}>
                            {ganho >= 0 ? '+' : ''}{ganho.toFixed(1)} kg
                          </span>
                        )}
                      </td>
                      <td><span className={styles.gmdBadge}>{gmd}</span></td>
                      {canDelete('weighing_records') && (
                        <td><button className={styles.btnDeletar} onClick={() => handleDelete(p.id)}>Deletar</button></td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
