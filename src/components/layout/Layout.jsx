import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import Link from 'next/link';
import styles from '../../styles/Layout.module.css';

export default function Layout({ children }) {
  const { userProfile, currentFarm, signOut } = useAuth();
  const { isAdmin, isManager } = usePermissions();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  // Admins e Gerentes veem Fazendas e Usuários
  const showAdminMenu = isAdmin() || isManager();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>🐂 Confinamento</div>
          <nav className={styles.nav}>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/gado">Gado</Link>
            <Link href="/baias">Baias</Link>
            {showAdminMenu && <Link href="/fazendas">Fazendas</Link>}
            {showAdminMenu && <Link href="/usuarios">Usuários</Link>}
          </nav>
        </div>
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
