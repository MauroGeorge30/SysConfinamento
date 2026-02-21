import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Financeiro.module.css';

const CATEGORIAS_DESPESA = ['Ração', 'Medicamentos', 'Mão de Obra', 'Combustível', 'Manutenção', 'Energia', 'Outros'];
const CATEGORIAS_RECEITA = ['Venda de Gado', 'Outros'];

export default function Financeiro() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canDelete } = usePermissions();

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroMes, setFiltroMes] = useState('');

  const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const mesAtual = hoje.substring(0, 7);

  const [formData, setFormData] = useState({ type: 'expense', category: 'Ração', description: '', amount: '', record_date: hoje });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('financial_records')
        .select('*')
        .eq('farm_id', currentFarm.id)
        .order('record_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      setRegistros(data || []);
    } catch (error) {
      alert('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ type: 'expense', category: 'Ração', description: '', amount: '', record_date: hoje });
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || isNaN(formData.amount)) return alert('Valor inválido.');
    setLoading(true);
    try {
      const { error } = await supabase.from('financial_records').insert([{
        farm_id: currentFarm.id,
        type: formData.type,
        category: formData.category,
        description: formData.description || null,
        amount: parseFloat(formData.amount),
        record_date: formData.record_date,
        registered_by: user.id,
      }]);
      if (error) throw error;
      alert('✅ Registro salvo!');
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
      const { error } = await supabase.from('financial_records').delete().eq('id', id);
      if (error) throw error;
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  // Filtros
  const registrosFiltrados = registros.filter(r => {
    const tipoMatch = !filtroTipo || r.type === filtroTipo;
    const mesMatch = !filtroMes || r.record_date?.startsWith(filtroMes);
    return tipoMatch && mesMatch;
  });

  // Totais do mês atual
  const regMesAtual = registros.filter(r => r.record_date?.startsWith(mesAtual));
  const receitaMes = regMesAtual.filter(r => r.type === 'income').reduce((acc, r) => acc + Number(r.amount), 0);
  const despesaMes = regMesAtual.filter(r => r.type === 'expense').reduce((acc, r) => acc + Number(r.amount), 0);
  const saldoMes = receitaMes - despesaMes;

  // Totais geral
  const receitaTotal = registros.filter(r => r.type === 'income').reduce((acc, r) => acc + Number(r.amount), 0);
  const despesaTotal = registros.filter(r => r.type === 'expense').reduce((acc, r) => acc + Number(r.amount), 0);

  // Totais filtrados
  const receitaFiltrada = registrosFiltrados.filter(r => r.type === 'income').reduce((acc, r) => acc + Number(r.amount), 0);
  const despesaFiltrada = registrosFiltrados.filter(r => r.type === 'expense').reduce((acc, r) => acc + Number(r.amount), 0);

  const categorias = formData.type === 'expense' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>💰 Financeiro</h1>
          {canCreate('financial_records') && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? 'Cancelar' : '+ Novo Lançamento'}
            </button>
          )}
        </div>

        {/* Cards resumo mês atual */}
        <div className={styles.mesLabel}>📅 Mês atual — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
        <div className={styles.resumo}>
          <div className={`${styles.resumoCard} ${styles.cardReceita}`}>
            <span>Receitas do Mês</span>
            <strong>R$ {receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div className={`${styles.resumoCard} ${styles.cardDespesa}`}>
            <span>Despesas do Mês</span>
            <strong>R$ {despesaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div className={`${styles.resumoCard} ${saldoMes >= 0 ? styles.cardSaldoPos : styles.cardSaldoNeg}`}>
            <span>Saldo do Mês</span>
            <strong>R$ {saldoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Saldo Geral</span>
            <strong>R$ {(receitaTotal - despesaTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className={styles.formCard}>
            <h2>➕ Novo Lançamento</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Tipo *</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value, category: e.target.value === 'expense' ? 'Ração' : 'Venda de Gado' })}>
                    <option value="expense">💸 Despesa</option>
                    <option value="income">💵 Receita</option>
                  </select>
                </div>
                <div>
                  <label>Categoria *</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Data *</label>
                  <input type="date" value={formData.record_date} onChange={(e) => setFormData({ ...formData, record_date: e.target.value })} required />
                </div>
                <div>
                  <label>Valor (R$) *</label>
                  <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="Ex: 1500.00" step="0.01" min="0" required />
                </div>
              </div>
              <div className={styles.rowFull}>
                <div>
                  <label>Descrição</label>
                  <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Ex: Compra de silagem — Fornecedor X" />
                </div>
              </div>
              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Lançamento'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Filtros */}
        <div className={styles.filtros}>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
          </select>
          <input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className={styles.inputMes} title="Filtrar por mês" />
          {(filtroTipo || filtroMes) && (
            <button className={styles.btnLimpar} onClick={() => { setFiltroTipo(''); setFiltroMes(''); }}>✕ Limpar</button>
          )}
          <span className={styles.resumoFiltro}>
            Receitas: <strong className={styles.verde}>R$ {receitaFiltrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            {' '}| Despesas: <strong className={styles.vermelho}>R$ {despesaFiltrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            {' '}| Saldo: <strong className={receitaFiltrada - despesaFiltrada >= 0 ? styles.verde : styles.vermelho}>R$ {(receitaFiltrada - despesaFiltrada).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          </span>
        </div>

        {/* Tabela */}
        {loading ? <p className={styles.vazio}>Carregando...</p> :
          registrosFiltrados.length === 0 ? <p className={styles.vazio}>Nenhum lançamento encontrado.</p> : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  {canDelete('financial_records') && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {registrosFiltrados.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.record_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td><span className={r.type === 'income' ? styles.badgeReceita : styles.badgeDespesa}>{r.type === 'income' ? '💵 Receita' : '💸 Despesa'}</span></td>
                    <td>{r.category}</td>
                    <td>{r.description || '-'}</td>
                    <td className={r.type === 'income' ? styles.valorReceita : styles.valorDespesa}>
                      {r.type === 'income' ? '+' : '-'} R$ {Number(r.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    {canDelete('financial_records') && (
                      <td><button className={styles.btnDeletar} onClick={() => handleDelete(r.id)}>Deletar</button></td>
                    )}
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
