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
          <h2>Bem-vindo, {userProfile?.name || 'Usuário'}! 👋</h2>
          {currentFarm ? (
            <p>📍 Fazenda: <strong>{currentFarm.name}</strong></p>
          ) : (
            <p>⚠️ Nenhuma fazenda vinculada</p>
          )}
        </div>

        <div className={styles.info}>
          <p>✅ Sistema funcionando</p>
          <p>✅ Login OK</p>
          <p>✅ Perfil carregado</p>
          {currentFarm && <p>✅ Fazenda: {currentFarm.name}</p>}
          {userProfile?.role && <p>✅ Perfil: {userProfile.role.name}</p>}
        </div>

        <div className={styles.info} style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Dados do Usuário</h3>
          <p><strong>ID:</strong> {user.id}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Nome:</strong> {userProfile?.name || 'Não definido'}</p>
          {currentFarm && (
            <>
              <p><strong>Fazenda ID:</strong> {currentFarm.id}</p>
              <p><strong>Fazenda:</strong> {currentFarm.name}</p>
              <p><strong>Localização:</strong> {currentFarm.location}</p>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
