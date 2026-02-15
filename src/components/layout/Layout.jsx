import { useAuth } from '../../contexts/AuthContext';
import styles from '../../styles/Layout.module.css';

export default function Layout({ children }) {
  const { userProfile, currentFarm, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          🐂 Sistema de Confinamento
        </div>
        
        <div className={styles.headerRight}>
          {currentFarm && (
            <span className={styles.farm}>📍 {currentFarm.name}</span>
          )}
          
          {userProfile && (
            <span className={styles.user}>{userProfile.name}</span>
          )}
          
          <button onClick={handleSignOut} className={styles.btnLogout}>
            Sair
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
