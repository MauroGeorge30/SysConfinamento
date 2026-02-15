import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/Dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();
  const { user, userProfile, currentFarm, loading } = useAuth();

  useEffect(() => {
    // Se não está logado, volta para login
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Enquanto carrega, mostra loading
  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
      </div>
    );
  }

  // Se não está logado, não renderiza nada
  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>📊 Dashboard</h1>
          {currentFarm && (
            <p className={styles.subtitle}>Fazenda: {currentFarm.name}</p>
          )}
        </div>

        <div className={styles.welcome}>
          <h2>Bem-vindo, {userProfile?.name || 'Usuário'}! 👋</h2>
          <p>Sistema funcionando corretamente.</p>
        </div>

        {!currentFarm && (
          <div className={styles.alert}>
            <p>⚠️ Você ainda não tem uma fazenda vinculada.</p>
            <p>Entre em contato com o administrador.</p>
          </div>
        )}

        <div className={styles.info}>
          <h3>Informações do Sistema</h3>
          <ul>
            <li>✅ Login funcionando</li>
            <li>✅ Autenticação ativa</li>
            <li>✅ Perfil carregado</li>
            {currentFarm && <li>✅ Fazenda vinculada</li>}
          </ul>
        </div>
      </div>
    </Layout>
  );
}
