import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import styles from '../styles/Relatorios.module.css';

export default function Relatorios() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const [aba, setAba] = useState('gado');
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState(null);

  // Filtros
  const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const primeiroDiaMes = hoje.substring(0, 7) + '-01';
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes);
  const [dataFim, setDataFim] = useState(hoje);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user && currentFarm) gerarRelatorio();
  }, [aba, currentFarm]);

  const gerarRelatorio = async () => {
    setLoading(true);
    setDados(null);
    try {
      if (aba === 'gado') {
        const { data, error } = await supabase.from('cattle')
          .select('*, pens!cattle_current_pen_id_fkey(pen_number)')
          .eq('farm_id', currentFarm.id)
          .order('tag_number', { ascending: true });
        if (error) throw error;
        setDados(data || []);

      } else if (aba === 'pesagens') {
        const { data, error } = await supabase.from('weighing_records')
          .select('*, cattle(tag_number, name, entry_weight, entry_date, sex)')
          .eq('farm_id', currentFarm.id)
          .gte('weighing_date', dataInicio)
          .lte('weighing_date', dataFim)
          .order('weighing_date', { ascending: false });
        if (error) throw error;
        setDados(data || []);

      } else if (aba === 'alimentacao') {
        const { data, error } = await supabase.from('feeding_records')
          .select('*, pens(pen_number), feed_types(name, cost_per_kg)')
          .eq('farm_id', currentFarm.id)
          .gte('feeding_date', dataInicio)
          .lte('feeding_date', dataFim)
          .order('feeding_date', { ascending: false });
        if (error) throw error;
        setDados(data || []);

      } else if (aba === 'financeiro') {
        const { data, error } = await supabase.from('financial_records')
          .select('*')
          .eq('farm_id', currentFarm.id)
          .gte('record_date', dataInicio)
          .lte('record_date', dataFim)
          .order('record_date', { ascending: false });
        if (error) throw error;
        setDados(data || []);
      }
    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calcGMD = (pesoAtual, pesoEntrada, dataEntrada, dataPesagem) => {
    if (!pesoEntrada || !dataEntrada) return '-';
    const dias = Math.floor((new Date(dataPesagem) - new Date(dataEntrada)) / 86400000);
    if (dias <= 0) return '-';
    return ((pesoAtual - pesoEntrada) / dias).toFixed(3);
  };

  const imprimir = () => window.print();

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  // Totalizadores
  const totalKg = aba === 'alimentacao' && dados ? dados.reduce((acc, r) => acc + Number(r.quantity_kg), 0) : 0;
  const totalCustoAlim = aba === 'alimentacao' && dados ? dados.reduce((acc, r) => acc + Number(r.quantity_kg) * Number(r.feed_types?.cost_per_kg || 0), 0) : 0;
  const totalReceita = aba === 'financeiro' && dados ? dados.filter(r => r.type === 'income').reduce((acc, r) => acc + Number(r.amount), 0) : 0;
  const totalDespesa = aba === 'financeiro' && dados ? dados.filter(r => r.type === 'expense').reduce((acc, r) => acc + Number(r.amount), 0) : 0;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>📊 Relatórios</h1>
          <button className={styles.btnImprimir} onClick={imprimir}>🖨️ Imprimir</button>
        </div>

        {/* Abas */}
        <div className={styles.abas}>
          {[
            { id: 'gado', label: '🐂 Gado' },
            { id: 'pesagens', label: '⚖️ Pesagens' },
            { id: 'alimentacao', label: '🌿 Alimentação' },
            { id: 'financeiro', label: '💰 Financeiro' },
          ].map(a => (
            <button key={a.id} className={`${styles.aba} ${aba === a.id ? styles.abaAtiva : ''}`} onClick={() => setAba(a.id)}>{a.label}</button>
          ))}
        </div>

        {/* Filtro de período (exceto gado) */}
        {aba !== 'gado' && (
          <div className={styles.filtros}>
            <div>
              <label>De:</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label>Até:</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <button className={styles.btnGerar} onClick={gerarRelatorio}>Gerar Relatório</button>
          </div>
        )}

        {loading ? <p className={styles.vazio}>Gerando relatório...</p> : !dados ? null : (
          <div className={styles.relatorio}>

            {/* RELATÓRIO GADO */}
            {aba === 'gado' && (
              <>
                <div className={styles.relatorioHeader}>
                  <h2>Relatório de Gado — {currentFarm?.name}</h2>
                  <span>{dados.length} animais</span>
                </div>
                <div className={styles.resumoRel}>
                  <span>Ativos: <strong>{dados.filter(a => a.status === 'active').length}</strong></span>
                  <span>Vendidos: <strong>{dados.filter(a => a.status === 'sold').length}</strong></span>
                  <span>Mortos: <strong>{dados.filter(a => a.status === 'dead').length}</strong></span>
                  <span>Machos: <strong>{dados.filter(a => a.sex === 'macho').length}</strong></span>
                  <span>Fêmeas: <strong>{dados.filter(a => a.sex === 'femea').length}</strong></span>
                </div>
                <div className={styles.tabelaWrapper}>
                  <table className={styles.tabela}>
                    <thead><tr><th>Brinco</th><th>Nome</th><th>Sexo</th><th>Raça</th><th>Baia</th><th>Peso Entrada</th><th>Data Entrada</th><th>Status</th></tr></thead>
                    <tbody>
                      {dados.map(a => (
                        <tr key={a.id}>
                          <td><strong>{a.tag_number}</strong></td>
                          <td>{a.name || '-'}</td>
                          <td>{a.sex === 'macho' ? '🐂 Macho' : '🐄 Fêmea'}</td>
                          <td>{a.breed || '-'}</td>
                          <td>{a['pens!cattle_current_pen_id_fkey']?.pen_number ? `Baia ${a['pens!cattle_current_pen_id_fkey'].pen_number}` : '-'}</td>
                          <td>{a.entry_weight ? `${Number(a.entry_weight).toFixed(1)} kg` : '-'}</td>
                          <td>{a.entry_date ? new Date(a.entry_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                          <td>{a.status === 'active' ? 'Ativo' : a.status === 'sold' ? 'Vendido' : 'Morto'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* RELATÓRIO PESAGENS */}
            {aba === 'pesagens' && (
              <>
                <div className={styles.relatorioHeader}>
                  <h2>Relatório de Pesagens — {new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}</h2>
                  <span>{dados.length} registros</span>
                </div>
                {dados.length === 0 ? <p className={styles.vazio}>Nenhuma pesagem no período.</p> : (
                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead><tr><th>Data</th><th>Brinco</th><th>Nome</th><th>Sexo</th><th>Peso Entrada</th><th>Peso Pesagem</th><th>Ganho Total</th><th>GMD (kg/d)</th></tr></thead>
                      <tbody>
                        {dados.map(p => {
                          const ganho = p.cattle?.entry_weight ? Number(p.weight_kg) - Number(p.cattle.entry_weight) : null;
                          const gmd = calcGMD(p.weight_kg, p.cattle?.entry_weight, p.cattle?.entry_date, p.weighing_date);
                          return (
                            <tr key={p.id}>
                              <td>{new Date(p.weighing_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                              <td><strong>{p.cattle?.tag_number || '-'}</strong></td>
                              <td>{p.cattle?.name || '-'}</td>
                              <td>{p.cattle?.sex === 'macho' ? 'Macho' : 'Fêmea'}</td>
                              <td>{p.cattle?.entry_weight ? `${Number(p.cattle.entry_weight).toFixed(1)} kg` : '-'}</td>
                              <td><strong>{Number(p.weight_kg).toFixed(1)} kg</strong></td>
                              <td>{ganho !== null ? `${ganho >= 0 ? '+' : ''}${ganho.toFixed(1)} kg` : '-'}</td>
                              <td>{gmd}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* RELATÓRIO ALIMENTAÇÃO */}
            {aba === 'alimentacao' && (
              <>
                <div className={styles.relatorioHeader}>
                  <h2>Relatório de Alimentação — {new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}</h2>
                  <span>{dados.length} registros</span>
                </div>
                <div className={styles.resumoRel}>
                  <span>Total fornecido: <strong>{totalKg.toFixed(1)} kg</strong></span>
                  <span>Custo total: <strong>R$ {totalCustoAlim.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                </div>
                {dados.length === 0 ? <p className={styles.vazio}>Nenhum registro no período.</p> : (
                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead><tr><th>Data</th><th>Baia</th><th>Ração</th><th>Quantidade</th><th>Custo</th></tr></thead>
                      <tbody>
                        {dados.map(r => (
                          <tr key={r.id}>
                            <td>{new Date(r.feeding_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                            <td>{r.pens?.pen_number ? `Baia ${r.pens.pen_number}` : '-'}</td>
                            <td>{r.feed_types?.name || '-'}</td>
                            <td>{Number(r.quantity_kg).toFixed(1)} kg</td>
                            <td>R$ {(Number(r.quantity_kg) * Number(r.feed_types?.cost_per_kg || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="3"><strong>Total</strong></td>
                          <td><strong>{totalKg.toFixed(1)} kg</strong></td>
                          <td><strong>R$ {totalCustoAlim.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* RELATÓRIO FINANCEIRO */}
            {aba === 'financeiro' && (
              <>
                <div className={styles.relatorioHeader}>
                  <h2>Relatório Financeiro — {new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}</h2>
                  <span>{dados.length} lançamentos</span>
                </div>
                <div className={styles.resumoRel}>
                  <span>Receitas: <strong className={styles.verde}>R$ {totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                  <span>Despesas: <strong className={styles.vermelho}>R$ {totalDespesa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                  <span>Saldo: <strong className={totalReceita - totalDespesa >= 0 ? styles.verde : styles.vermelho}>R$ {(totalReceita - totalDespesa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                </div>
                {dados.length === 0 ? <p className={styles.vazio}>Nenhum lançamento no período.</p> : (
                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead>
                      <tbody>
                        {dados.map(r => (
                          <tr key={r.id}>
                            <td>{new Date(r.record_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                            <td>{r.type === 'income' ? '💵 Receita' : '💸 Despesa'}</td>
                            <td>{r.category}</td>
                            <td>{r.description || '-'}</td>
                            <td className={r.type === 'income' ? styles.verde : styles.vermelho}>
                              {r.type === 'income' ? '+' : '-'} R$ {Number(r.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="4"><strong>Saldo do período</strong></td>
                          <td className={(totalReceita - totalDespesa) >= 0 ? styles.verde : styles.vermelho}>
                            <strong>R$ {(totalReceita - totalDespesa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
