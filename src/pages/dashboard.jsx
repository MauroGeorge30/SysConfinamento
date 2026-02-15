import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/Dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();
  const { currentFarm, userProfile, user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalCattle: 0,
    maleCount: 0,
    femaleCount: 0,
    activePens: 0,
    totalExpenses: 0,
    totalRevenues: 0,
    avgWeight: 0,
    avgDailyGain: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Aguarda carregar autenticação
    if (authLoading) return;

    // Se não está logado, redireciona para login
    if (!user) {
      router.push('/');
      return;
    }

    // Se está logado mas não tem perfil, redireciona para setup
    if (!userProfile) {
      router.push('/setup');
      return;
    }

    // Se tem perfil mas não tem fazenda, redireciona para setup
    if (!currentFarm) {
      router.push('/setup');
      return;
    }

    // Se está tudo ok, carrega os dados
    loadDashboardData();
  }, [authLoading, user, userProfile, currentFarm, router]);

  const loadDashboardData = async () => {
    if (!currentFarm) return;

    setLoading(true);
    try {
      const { count: cattleCount } = await supabase
        .from('cattle')
        .select('*', { count: 'exact', head: true })
        .eq('farm_id', currentFarm.id)
        .eq('status', 'active');

      const { data: cattleData } = await supabase
        .from('cattle')
        .select('sex, entry_weight')
        .eq('farm_id', currentFarm.id)
        .eq('status', 'active');

      const maleCount = cattleData?.filter(c => c.sex === 'macho').length || 0;
      const femaleCount = cattleData?.filter(c => c.sex === 'femea').length || 0;
      
      const avgWeight = cattleData?.length > 0
        ? cattleData.reduce((sum, c) => sum + (c.entry_weight || 0), 0) / cattleData.length
        : 0;

      const { count: pensCount } = await supabase
        .from('pens')
        .select('*', { count: 'exact', head: true })
        .eq('farm_id', currentFarm.id)
        .eq('status', 'active');

      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('farm_id', currentFarm.id);

      const totalExpenses = expensesData?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

      const { data: revenuesData } = await supabase
        .from('revenues')
        .select('amount')
        .eq('farm_id', currentFarm.id);

      const totalRevenues = revenuesData?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;

      setStats({
        totalCattle: cattleCount || 0,
        maleCount,
        femaleCount,
        activePens: pensCount || 0,
        totalExpenses,
        totalRevenues,
        avgWeight: avgWeight.toFixed(2),
        avgDailyGain: 0
      });

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Enquanto carrega, mostra loading
  if (authLoading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
      </div>
    );
  }

  // Se não está logado ou não tem perfil, não renderiza nada (já redirecionou)
  if (!user || !userProfile || !currentFarm) {
    return null;
  }

  if (loading) {
    return (
      <Layout>
        <div className="loading-overlay">
          <div className="spinner" />
        </div>
      </Layout>
    );
  }

  const profit = stats.totalRevenues - stats.totalExpenses;
  const profitPerCattle = stats.totalCattle > 0 ? profit / stats.totalCattle : 0;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>📊 Dashboard</h1>
            <p className={styles.farmName}>{currentFarm.name}</p>
          </div>
          <div className={styles.welcomeUser}>
            Olá, <strong>{userProfile?.name}</strong>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🐂</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Total de Animais</div>
              <div className={styles.statValue}>{stats.totalCattle}</div>
              <div className={styles.statDetail}>
                {stats.maleCount} machos • {stats.femaleCount} fêmeas
              </div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>⚖️</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Peso Médio</div>
              <div className={styles.statValue}>{stats.avgWeight} kg</div>
              <div className={styles.statDetail}>Por animal</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>🚪</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Baias Ativas</div>
              <div className={styles.statValue}>{stats.activePens}</div>
              <div className={styles.statDetail}>
                Capacidade: {currentFarm.capacity} animais
              </div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>💸</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Total de Despesas</div>
              <div className={styles.statValue}>
                R$ {stats.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className={styles.statDetail}>
                R$ {(stats.totalExpenses / (stats.totalCattle || 1)).toFixed(2)} por animal
              </div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>💰</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Total de Receitas</div>
              <div className={styles.statValue}>
                R$ {stats.totalRevenues.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className={styles.statDetail}>Vendas e bonificações</div>
            </div>
          </div>

          <div className={`${styles.statCard} ${profit >= 0 ? styles.statPositive : styles.statNegative}`}>
            <div className={styles.statIcon}>{profit >= 0 ? '📈' : '📉'}</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Resultado</div>
              <div className={styles.statValue}>
                R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className={styles.statDetail}>
                R$ {profitPerCattle.toFixed(2)} por animal
              </div>
            </div>
          </div>
        </div>

        <div className={styles.quickActions}>
          <h2>Ações Rápidas</h2>
          <div className={styles.actionsGrid}>
            <a href="/gado" className={styles.actionCard}>
              <span className={styles.actionIcon}>🐂</span>
              <span className={styles.actionLabel}>Cadastrar Gado</span>
            </a>
            <a href="/alimentacao" className={styles.actionCard}>
              <span className={styles.actionIcon}>🥣</span>
              <span className={styles.actionLabel}>Registrar Alimentação</span>
            </a>
            <a href="/pesagem" className={styles.actionCard}>
              <span className={styles.actionIcon}>⚖️</span>
              <span className={styles.actionLabel}>Registrar Pesagem</span>
            </a>
            <a href="/relatorios" className={styles.actionCard}>
              <span className={styles.actionIcon}>📄</span>
              <span className={styles.actionLabel}>Gerar Relatórios</span>
            </a>
          </div>
        </div>

        <div className={styles.alerts}>
          <h2>⚠️ Alertas Recentes</h2>
          <div className={styles.alertsList}>
            <p className={styles.noAlerts}>Nenhum alerta no momento</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
