import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/layout/Layout';
import styles from '../styles/Dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();
  const { user, userProfile, currentFarm, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className={styles.container}>
        <h1>Dashboard</h1>
        <div className={styles.welcome}>
          <h2>Bem-vindo, {userProfile?.name}! 👋</h2>
          {currentFarm && <p>Fazenda: {currentFarm.name}</p>}
        </div>
        <div className={styles.info}>
          <p>✅ Sistema funcionando</p>
          <p>✅ Login OK</p>
          <p>✅ Perfil carregado</p>
        </div>
      </div>
    </Layout>
  );
}
