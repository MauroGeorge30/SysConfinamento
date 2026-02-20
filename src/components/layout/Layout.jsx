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
        <div>🐂 Confinamento</div>
        <div className={styles.headerRight}>
          {currentFarm && <span>{currentFarm.name}</span>}
          {userProfile && <span>{userProfile.name}</span>}
          <button onClick={handleSignOut}>Sair</button>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
