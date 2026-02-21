import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Movimentacao.module.css';

export default function Movimentacao() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canDelete } = usePermissions();

  const [movimentacoes, setMovimentacoes] = useState([]);
  const [gado, setGado] = useState([]);
  const [baias, setBaias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const hoje = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [formData, setFormData] = useState({ cattle_id: '', pen_id_to: '', movement_date: hoje, reason: '' });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: movData, error: movError }, { data: gadoData }, { data: baiasData }] = await Promise.all([
        supabase.from('pen_movements')
          .select('*, cattle(tag_number, name), pen_from:pens!pen_movements_pen_id_from_fkey(pen_number), pen_to:pens!pen_movements_pen_id_to_fkey(pen_number)')
          .eq('farm_id', currentFarm.id)
          .order('movement_date', { ascending: false })
          .limit(200),
        supabase.from('cattle').select('id, tag_number, name, current_pen_id').eq('farm_id', currentFarm.id).eq('status', 'active').order('tag_number'),
        supabase.from('pens').select('id, pen_number, capacity, current_occupancy').eq('farm_id', currentFarm.id).eq('status', 'active').order('pen_number'),
      ]);
      if (movError) throw movError;
      setMovimentacoes(movData || []);
      setGado(gadoData || []);
      setBaias(baiasData || []);
    } catch (error) {
      alert('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ cattle_id: '', pen_id_to: '', movement_date: hoje, reason: '' });
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.cattle_id) return alert('Selecione o animal.');
    if (!formData.pen_id_to) return alert('Selecione a baia de destino.');

    const animal = gado.find(a => a.id === formData.cattle_id);
    if (animal?.current_pen_id === formData.pen_id_to) return alert('Animal já está nesta baia.');

    setLoading(true);
    try {
      // 1. Registrar movimentação
      const { error: movError } = await supabase.from('pen_movements').insert([{
        cattle_id: formData.cattle_id,
        pen_id_from: animal?.current_pen_id || null,
        pen_id_to: formData.pen_id_to,
        movement_date: formData.movement_date,
        reason: formData.reason || null,
        farm_id: currentFarm.id,
        registered_by: user.id,
      }]);
      if (movError) throw movError;

      // 2. Atualizar baia do animal
      const { error: cattleError } = await supabase.from('cattle')
        .update({ current_pen_id: formData.pen_id_to })
        .eq('id', formData.cattle_id);
      if (cattleError) throw cattleError;

      alert('✅ Movimentação registrada!');
      resetForm();
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  const animalSelecionado = gado.find(a => a.id === formData.cattle_id);
  const baiaAtualAnimal = baias.find(b => b.id === animalSelecionado?.current_pen_id);
  const baiaDestino = baias.find(b => b.id === formData.pen_id_to);
  const vagasDestino = baiaDestino ? baiaDestino.capacity - baiaDestino.current_occupancy : null;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🔄 Movimentação de Gado</h1>
          {canCreate('pen_movements') && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? 'Cancelar' : '+ Nova Movimentação'}
            </button>
          )}
        </div>

        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <span>Total Movimentações</span>
            <strong>{movimentacoes.length}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Hoje</span>
            <strong>{movimentacoes.filter(m => m.movement_date === hoje).length}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Animais Ativos</span>
            <strong>{gado.length}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Baias Ativas</span>
            <strong>{baias.length}</strong>
          </div>
        </div>

        {showForm && (
          <div className={styles.formCard}>
            <h2>➕ Registrar Movimentação</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Data *</label>
                  <input type="date" value={formData.movement_date} onChange={(e) => setFormData({ ...formData, movement_date: e.target.value })} required />
                </div>
                <div>
                  <label>Animal (Brinco) *</label>
                  <select value={formData.cattle_id} onChange={(e) => setFormData({ ...formData, cattle_id: e.target.value })} required>
                    <option value="">Selecione o animal</option>
                    {gado.map(a => <option key={a.id} value={a.id}>Brinco {a.tag_number}{a.name ? ` — ${a.name}` : ''}</option>)}
                  </select>
                </div>
              </div>

              {animalSelecionado && (
                <div className={styles.infoMovimento}>
                  <span>📍 Baia atual: <strong>{baiaAtualAnimal ? `Baia ${baiaAtualAnimal.pen_number}` : 'Sem baia'}</strong></span>
                </div>
              )}

              <div className={styles.row}>
                <div>
                  <label>Baia Destino *</label>
                  <select value={formData.pen_id_to} onChange={(e) => setFormData({ ...formData, pen_id_to: e.target.value })} required>
                    <option value="">Selecione a baia de destino</option>
                    {baias.filter(b => b.id !== animalSelecionado?.current_pen_id).map(b => (
                      <option key={b.id} value={b.id}>
                        Baia {b.pen_number} — {b.current_occupancy}/{b.capacity} animais
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Motivo</label>
                  <input type="text" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Ex: Separação por peso, doença..." />
                </div>
              </div>

              {baiaDestino && (
                <div className={vagasDestino > 0 ? styles.previewOk : styles.previewAlerta}>
                  {vagasDestino > 0
                    ? `✅ Baia ${baiaDestino.pen_number} tem ${vagasDestino} vaga(s) disponível(is)`
                    : `⚠️ Baia ${baiaDestino.pen_number} está na capacidade máxima!`}
                </div>
              )}

              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Registrar Movimentação'}</button>
              </div>
            </form>
          </div>
        )}

        {loading ? <p className={styles.vazio}>Carregando...</p> :
          movimentacoes.length === 0 ? <p className={styles.vazio}>Nenhuma movimentação registrada.</p> : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Brinco</th>
                  <th>Nome</th>
                  <th>Baia Origem</th>
                  <th>Baia Destino</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.movement_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td><strong>{m.cattle?.tag_number || '-'}</strong></td>
                    <td>{m.cattle?.name || '-'}</td>
                    <td>{m.pen_from?.pen_number ? `Baia ${m.pen_from.pen_number}` : 'Sem baia'}</td>
                    <td>{m.pen_to?.pen_number ? `Baia ${m.pen_to.pen_number}` : '-'}</td>
                    <td>{m.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
