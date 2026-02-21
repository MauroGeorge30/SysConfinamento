import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Saidas.module.css';

export default function Saidas() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canDelete } = usePermissions();

  const [saidas, setSaidas] = useState([]);
  const [gado, setGado] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const [formData, setFormData] = useState({ cattle_id: '', exit_type: 'sold', exit_date: hoje, exit_weight: '', sale_value: '', reason: '' });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: saidasData, error }, { data: gadoData }] = await Promise.all([
        supabase.from('cattle')
          .select('id, tag_number, name, sex, breed, entry_date, entry_weight, exit_date, exit_weight, exit_reason, status, purchase_value')
          .eq('farm_id', currentFarm.id)
          .in('status', ['sold', 'dead'])
          .order('exit_date', { ascending: false }),
        supabase.from('cattle')
          .select('id, tag_number, name, entry_date, entry_weight, current_pen_id')
          .eq('farm_id', currentFarm.id)
          .eq('status', 'active')
          .order('tag_number'),
      ]);
      if (error) throw error;
      setSaidas(saidasData || []);
      setGado(gadoData || []);
    } catch (error) {
      alert('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ cattle_id: '', exit_type: 'sold', exit_date: hoje, exit_weight: '', sale_value: '', reason: '' });
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.cattle_id) return alert('Selecione o animal.');
    if (!formData.exit_weight || isNaN(formData.exit_weight)) return alert('Peso de saída inválido.');
    if (formData.exit_type === 'sold' && (!formData.sale_value || isNaN(formData.sale_value))) return alert('Informe o valor de venda.');

    setLoading(true);
    try {
      const { error } = await supabase.from('cattle').update({
        status: formData.exit_type,
        exit_date: formData.exit_date,
        exit_weight: parseFloat(formData.exit_weight),
        exit_reason: formData.reason || null,
        current_pen_id: null,
        ...(formData.exit_type === 'sold' && { purchase_value: parseFloat(formData.sale_value) }),
      }).eq('id', formData.cattle_id);
      if (error) throw error;

      // Registrar receita se for venda
      if (formData.exit_type === 'sold' && formData.sale_value) {
        const animal = gado.find(a => a.id === formData.cattle_id);
        await supabase.from('financial_records').insert([{
          farm_id: currentFarm.id,
          type: 'income',
          category: 'Venda de Gado',
          description: `Venda do animal Brinco ${animal?.tag_number}`,
          amount: parseFloat(formData.sale_value),
          record_date: formData.exit_date,
          registered_by: user.id,
        }]);
      }

      alert('✅ Saída registrada!');
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
  const totalVendidos = saidas.filter(s => s.status === 'sold').length;
  const totalMortos = saidas.filter(s => s.status === 'dead').length;
  const receitaTotal = saidas.filter(s => s.status === 'sold').reduce((acc, s) => acc + Number(s.purchase_value || 0), 0);

  const calcGMD = (pesoSaida, pesoEntrada, dataEntrada, dataSaida) => {
    if (!pesoEntrada || !dataEntrada || !dataSaida) return '-';
    const dias = Math.floor((new Date(dataSaida) - new Date(dataEntrada)) / (1000 * 60 * 60 * 24));
    if (dias <= 0) return '-';
    return `${((pesoSaida - pesoEntrada) / dias).toFixed(3)} kg/d`;
  };

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🚪 Saída de Gado</h1>
          {canCreate('cattle') && gado.length > 0 && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? 'Cancelar' : '+ Registrar Saída'}
            </button>
          )}
        </div>

        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <span>Animais Ativos</span>
            <strong>{gado.length}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Total Vendidos</span>
            <strong>{totalVendidos}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Total Mortos</span>
            <strong>{totalMortos}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Receita Vendas</span>
            <strong>R$ {receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        {showForm && (
          <div className={styles.formCard}>
            <h2>➕ Registrar Saída</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Animal (Brinco) *</label>
                  <select value={formData.cattle_id} onChange={(e) => setFormData({ ...formData, cattle_id: e.target.value })} required>
                    <option value="">Selecione o animal</option>
                    {gado.map(a => <option key={a.id} value={a.id}>Brinco {a.tag_number}{a.name ? ` — ${a.name}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label>Tipo de Saída *</label>
                  <select value={formData.exit_type} onChange={(e) => setFormData({ ...formData, exit_type: e.target.value })}>
                    <option value="sold">Venda</option>
                    <option value="dead">Morte</option>
                  </select>
                </div>
              </div>
              {animalSelecionado && (
                <div className={styles.infoAnimal}>
                  <span>Peso entrada: <strong>{Number(animalSelecionado.entry_weight).toFixed(1)} kg</strong></span>
                  <span>Data entrada: <strong>{new Date(animalSelecionado.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></span>
                </div>
              )}
              <div className={styles.row}>
                <div>
                  <label>Data de Saída *</label>
                  <input type="date" value={formData.exit_date} onChange={(e) => setFormData({ ...formData, exit_date: e.target.value })} required />
                </div>
                <div>
                  <label>Peso de Saída (kg) *</label>
                  <input type="number" value={formData.exit_weight} onChange={(e) => setFormData({ ...formData, exit_weight: e.target.value })} placeholder="Ex: 480.0" step="0.1" min="0" required />
                </div>
              </div>
              {formData.exit_type === 'sold' && (
                <div className={styles.row}>
                  <div>
                    <label>Valor de Venda (R$) *</label>
                    <input type="number" value={formData.sale_value} onChange={(e) => setFormData({ ...formData, sale_value: e.target.value })} placeholder="Ex: 5500.00" step="0.01" min="0" required />
                  </div>
                  <div>
                    <label>Observação</label>
                    <input type="text" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Ex: Nome do comprador" />
                  </div>
                </div>
              )}
              {formData.exit_type === 'dead' && (
                <div className={styles.rowFull}>
                  <div>
                    <label>Causa da Morte</label>
                    <input type="text" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Ex: Timpanismo, acidente..." />
                  </div>
                </div>
              )}
              {/* Preview GMD se tiver dados */}
              {animalSelecionado && formData.exit_weight && formData.exit_date && (
                <div className={styles.previewGMD}>
                  📊 GMD no período: <strong>{calcGMD(parseFloat(formData.exit_weight), animalSelecionado.entry_weight, animalSelecionado.entry_date, formData.exit_date)}</strong>
                  {formData.exit_weight && <span> | Ganho total: <strong>{(parseFloat(formData.exit_weight) - Number(animalSelecionado.entry_weight)).toFixed(1)} kg</strong></span>}
                </div>
              )}
              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Confirmar Saída'}</button>
              </div>
            </form>
          </div>
        )}

        {loading ? <p className={styles.vazio}>Carregando...</p> :
          saidas.length === 0 ? <p className={styles.vazio}>Nenhuma saída registrada.</p> : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Data Saída</th>
                  <th>Brinco</th>
                  <th>Tipo</th>
                  <th>Peso Entrada</th>
                  <th>Peso Saída</th>
                  <th>Ganho</th>
                  <th>GMD</th>
                  <th>Valor</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {saidas.map((s) => {
                  const ganho = s.exit_weight && s.entry_weight ? Number(s.exit_weight) - Number(s.entry_weight) : null;
                  const gmd = calcGMD(s.exit_weight, s.entry_weight, s.entry_date, s.exit_date);
                  return (
                    <tr key={s.id}>
                      <td>{s.exit_date ? new Date(s.exit_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                      <td><strong>{s.tag_number}</strong>{s.name ? ` — ${s.name}` : ''}</td>
                      <td><span className={s.status === 'sold' ? styles.badgeVenda : styles.badgeMorte}>{s.status === 'sold' ? 'Venda' : 'Morte'}</span></td>
                      <td>{s.entry_weight ? `${Number(s.entry_weight).toFixed(1)} kg` : '-'}</td>
                      <td>{s.exit_weight ? `${Number(s.exit_weight).toFixed(1)} kg` : '-'}</td>
                      <td>{ganho !== null ? <span className={ganho >= 0 ? styles.ganhoPos : styles.ganhoNeg}>{ganho >= 0 ? '+' : ''}{ganho.toFixed(1)} kg</span> : '-'}</td>
                      <td>{gmd}</td>
                      <td>{s.status === 'sold' && s.purchase_value ? `R$ ${Number(s.purchase_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</td>
                      <td>{s.exit_reason || '-'}</td>
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
