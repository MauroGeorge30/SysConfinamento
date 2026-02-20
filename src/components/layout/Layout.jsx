import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import Link from 'next/link';
import styles from '../../styles/Layout.module.css';

export default function Layout({ children }) {
  const { userProfile, currentFarm, allFarms, switchFarm, signOut } = useAuth();
  const { isAdmin, isManager } = usePermissions();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  const showAdminMenu = isAdmin() || isManager();
  const isAdminGeral = userProfile?.role?.level === 1;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>🐂 Confinamento</div>
          <nav className={styles.nav}>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/gado">Gado</Link>
            <Link href="/baias">Baias</Link>
            <Link href="/racoes">Rações</Link>
            <Link href="/alimentacao">Alimentação</Link>
            {showAdminMenu && <Link href="/fazendas">Fazendas</Link>}
            {showAdminMenu && <Link href="/usuarios">Usuários</Link>}
          </nav>
        </div>
        <div className={styles.headerRight}>
          {isAdminGeral && allFarms.length > 1 ? (
            <select className={styles.seletorFazenda} value={currentFarm?.id || ''} onChange={(e) => switchFarm(e.target.value)}>
              {allFarms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          ) : (
            currentFarm && <span className={styles.nomeFazenda}>{currentFarm.name}</span>
          )}
          {userProfile && <span>{userProfile.name}</span>}
          <button onClick={handleSignOut}>Sair</button>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
