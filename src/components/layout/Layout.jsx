import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import Link from 'next/link';
import styles from '../../styles/Layout.module.css';

function DropdownMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={styles.dropdown} ref={ref}>
      <button className={styles.dropbtn} onClick={() => setOpen(!open)}>
        {label} <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={styles.dropMenu}>
          {items.map(item => (
            <Link key={item.href} href={item.href} className={styles.dropItem} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

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
            <Link href="/lotes">Lotes</Link>
            <Link href="/baias">Baias</Link>
            <Link href="/gado">Gado</Link>

            <DropdownMenu label="Controle Operacional" items={[
              { href: '/racoes',         label: '🌾 Rações' },
              { href: '/alimentacao',    label: '🌿 Tratos Diários' },
              { href: '/pesagens',       label: '⚖️ Pesagens Individuais' },
              { href: '/pesagens-lote',  label: '📦 Pesagens por Lote' },
              { href: '/ocorrencias',    label: '🚨 Ocorrências' },
            ]} />

            <DropdownMenu label="Movimentação" items={[
              { href: '/movimentacao', label: '🔄 Transferência' },
              { href: '/saidas',       label: '🚪 Saídas' },
            ]} />

            <Link href="/financeiro">Financeiro</Link>
            <Link href="/relatorios">Relatórios</Link>

            {showAdminMenu && (
              <DropdownMenu label="Administração" items={[
                ...(showAdminMenu ? [{ href: '/fazendas', label: '🏡 Fazendas' }] : []),
                ...(showAdminMenu ? [{ href: '/usuarios', label: '👤 Usuários' }] : []),
              ]} />
            )}
          </nav>
        </div>
        <div className={styles.headerRight}>
          {isAdminGeral && allFarms?.length > 1 ? (
            <select className={styles.seletorFazenda} value={currentFarm?.id || ''} onChange={(e) => switchFarm(e.target.value)}>
              {allFarms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          ) : (
            currentFarm && <span className={styles.nomeFazenda}>{currentFarm.name}</span>
          )}
          {userProfile && <span className={styles.nomeUsuario}>{userProfile.name}</span>}
          <button onClick={handleSignOut} className={styles.btnSair}>Sair</button>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
