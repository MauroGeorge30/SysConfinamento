import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/layout/Layout';
import styles from '../styles/Dashboard.module.css';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const { user, userProfile, currentFarm, loading: authLoading } = useAuth();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
      const mesAtual = hoje.substring(0, 7);

      const [
        { data: gado },
        { data: baias },
        { data: pesagens },
        { data: alimentacaoHoje },
        { data: financeiro },
        { data: movimentacoes },
      ] = await Promise.all([
        supabase.from('cattle').select('id, status, sex, entry_weight, entry_date, current_pen_id').eq('farm_id', currentFarm.id),
        supabase.from('pens').select('id, pen_number, capacity, current_occupancy, status').eq('farm_id', currentFarm.id),
        supabase.from('weighing_records').select('cattle_id, weight_kg, weighing_date, cattle(entry_weight, entry_date)').eq('farm_id', currentFarm.id).order('weighing_date', { ascending: false }).limit(500),
        supabase.from('feeding_records').select('quantity_kg, feed_types(cost_per_kg)').eq('farm_id', currentFarm.id).eq('feeding_date', hoje),
        supabase.from('financial_records').select('type, amount, record_date').eq('farm_id', currentFarm.id),
        supabase.from('pen_movements').select('id, movement_date').eq('farm_id', currentFarm.id).eq('movement_date', hoje),
      ]);

      const gadoAtivo = (gado || []).filter(a => a.status === 'active');
      const machos = gadoAtivo.filter(a => a.sex === 'macho').length;
      const femeas = gadoAtivo.filter(a => a.sex === 'femea').length;
      const baiasAtivas = (baias || []).filter(b => b.status === 'active');
      const ocupacaoTotal = baiasAtivas.reduce((acc, b) => acc + (b.current_occupancy || 0), 0);
      const capacidadeTotal = baiasAtivas.reduce((acc, b) => acc + (b.capacity || 0), 0);

      // GMD médio das últimas pesagens por animal (uma por animal)
      const ultimasPesagens = {};
      (pesagens || []).forEach(p => {
        if (!ultimasPesagens[p.cattle_id]) ultimasPesagens[p.cattle_id] = p;
      });
      const gmds = Object.values(ultimasPesagens).map(p => {
        if (!p.cattle?.entry_weight || !p.cattle?.entry_date) return null;
        const dias = Math.floor((new Date(p.weighing_date) - new Date(p.cattle.entry_date)) / 86400000);
        if (dias <= 0) return null;
        return (p.weight_kg - p.cattle.entry_weight) / dias;
      }).filter(Boolean);
      const gmdMedio = gmds.length > 0 ? gmds.reduce((a, b) => a + b, 0) / gmds.length : null;

      // Financeiro do mês
      const finMes = (financeiro || []).filter(r => r.record_date?.startsWith(mesAtual));
      const receitaMes = finMes.filter(r => r.type === 'income').reduce((acc, r) => acc + Number(r.amount), 0);
      const despesaMes = finMes.filter(r => r.type === 'expense').reduce((acc, r) => acc + Number(r.amount), 0);

      // Alimentação hoje
      const kgHoje = (alimentacaoHoje || []).reduce((acc, r) => acc + Number(r.quantity_kg), 0);
      const custoHoje = (alimentacaoHoje || []).reduce((acc, r) => acc + Number(r.quantity_kg) * Number(r.feed_types?.cost_per_kg || 0), 0);
      const kgPorCabeca = gadoAtivo.length > 0 ? kgHoje / gadoAtivo.length : 0;

      // Baias por ocupação
      const baiasDetalhes = baiasAtivas.map(b => ({
        ...b,
        pct: b.capacity > 0 ? Math.round((b.current_occupancy / b.capacity) * 100) : 0,
      })).sort((a, b) => b.pct - a.pct);

      setDados({
        gadoAtivo: gadoAtivo.length, machos, femeas,
        baiasAtivas: baiasAtivas.length, ocupacaoTotal, capacidadeTotal,
        gmdMedio, receitaMes, despesaMes, saldoMes: receitaMes - despesaMes,
        kgHoje, custoHoje, kgPorCabeca,
        movimentacoesHoje: (movimentacoes || []).length,
        baiasDetalhes, hoje, mesAtual,
      });
    } catch (error) {
      console.error('Erro dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.topBar}>
          <div>
            <h1>Dashboard</h1>
            <p className={styles.sub}>Bem-vindo, <strong>{userProfile?.name}</strong> — {currentFarm?.name}</p>
          </div>
          <button className={styles.btnAtualizar} onClick={loadDados}>↻ Atualizar</button>
        </div>

        {loading ? <p className={styles.vazio}>Carregando dados...</p> : !dados ? <p className={styles.vazio}>Erro ao carregar.</p> : (
          <>
            {/* Seção Gado */}
            <div className={styles.secaoTitulo}>🐂 Rebanho</div>
            <div className={styles.grid4}>
              <div className={styles.card}>
                <span>Total Ativo</span>
                <strong>{dados.gadoAtivo}</strong>
                <small>{dados.machos} machos · {dados.femeas} fêmeas</small>
              </div>
              <div className={styles.card}>
                <span>Ocupação das Baias</span>
                <strong>{dados.ocupacaoTotal} / {dados.capacidadeTotal}</strong>
                <small>{dados.capacidadeTotal > 0 ? Math.round((dados.ocupacaoTotal / dados.capacidadeTotal) * 100) : 0}% da capacidade</small>
              </div>
              <div className={styles.card}>
                <span>GMD Médio</span>
                <strong>{dados.gmdMedio ? `${dados.gmdMedio.toFixed(3)} kg/d` : '-'}</strong>
                <small>Ganho médio diário</small>
              </div>
              <div className={styles.card}>
                <span>Movimentações Hoje</span>
                <strong>{dados.movimentacoesHoje}</strong>
                <small>Transferências entre baias</small>
              </div>
            </div>

            {/* Seção Alimentação */}
            <div className={styles.secaoTitulo}>🌿 Alimentação de Hoje</div>
            <div className={styles.grid3}>
              <div className={styles.card}>
                <span>Total Fornecido</span>
                <strong>{dados.kgHoje.toFixed(0)} kg</strong>
                <small>{dados.kgPorCabeca.toFixed(1)} kg/cabeça</small>
              </div>
              <div className={styles.card}>
                <span>Custo Alimentação</span>
                <strong>R$ {dados.custoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                <small>Custo do dia de hoje</small>
              </div>
              <div className={styles.card}>
                <span>Baias Alimentadas</span>
                <strong>{dados.baiasAtivas}</strong>
                <small>Baias ativas no sistema</small>
              </div>
            </div>

            {/* Seção Financeiro */}
            <div className={styles.secaoTitulo}>💰 Financeiro — {mesNome}</div>
            <div className={styles.grid3}>
              <div className={`${styles.card} ${styles.cardVerde}`}>
                <span>Receitas do Mês</span>
                <strong>R$ {dados.receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className={`${styles.card} ${styles.cardVermelho}`}>
                <span>Despesas do Mês</span>
                <strong>R$ {dados.despesaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className={`${styles.card} ${dados.saldoMes >= 0 ? styles.cardAzul : styles.cardLaranja}`}>
                <span>Saldo do Mês</span>
                <strong>R$ {dados.saldoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            {/* Ocupação das Baias */}
            {dados.baiasDetalhes.length > 0 && (
              <>
                <div className={styles.secaoTitulo}>🏠 Ocupação por Baia</div>
                <div className={styles.baiasGrid}>
                  {dados.baiasDetalhes.map(b => (
                    <div key={b.id} className={styles.baiaCard}>
                      <div className={styles.baiaHeader}>
                        <strong>Baia {b.pen_number}</strong>
                        <span className={b.pct >= 90 ? styles.pctAlto : b.pct >= 60 ? styles.pctMedio : styles.pctBaixo}>{b.pct}%</span>
                      </div>
                      <div className={styles.baiaBar}>
                        <div className={`${styles.baiaBarFill} ${b.pct >= 90 ? styles.barVermelho : b.pct >= 60 ? styles.barLaranja : styles.barVerde}`} style={{ width: `${b.pct}%` }} />
                      </div>
                      <div className={styles.baiaInfo}>{b.current_occupancy} / {b.capacity} animais</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
