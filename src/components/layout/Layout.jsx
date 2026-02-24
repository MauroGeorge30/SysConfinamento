import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import Link from 'next/link';
import styles from '../../styles/Layout.module.css';

const NAV_GROUPS = (showAdmin) => [
  { type: 'link', href: '/dashboard',      label: 'Dashboard',  icon: '📊' },
  { type: 'link', href: '/lotes',           label: 'Lotes',      icon: '📦' },
  { type: 'link', href: '/baias',           label: 'Baias',      icon: '🏠' },
  { type: 'link', href: '/gado',            label: 'Gado',       icon: '🐂' },
  {
    type: 'group', label: 'Controle Operacional', icon: '⚙️',
    items: [
      { href: '/racoes',        label: 'Rações',               icon: '🌾' },
      { href: '/batida-vagao',  label: 'Batida de Vagão',      icon: '🚜' },
      { href: '/alimentacao',   label: 'Tratos Diários',       icon: '🌿' },
      { href: '/pesagens',      label: 'Pesagens Individuais', icon: '⚖️' },
      { href: '/pesagens-lote', label: 'Pesagens por Lote',    icon: '📦' },
      { href: '/ocorrencias',   label: 'Ocorrências',          icon: '🚨' },
    ],
  },
  {
    type: 'group', label: 'Movimentação', icon: '🔄',
    items: [
      { href: '/movimentacao', label: 'Transferência', icon: '🔄' },
      { href: '/saidas',       label: 'Saídas',        icon: '🚪' },
    ],
  },
  {
    type: 'group', label: 'Financeiro', icon: '💵',
    items: [
      { href: '/financeiro',      label: 'Lançamentos',        icon: '💵' },
      { href: '/fechamento-lote', label: 'Fechamento de Lote', icon: '📊' },
      { href: '/custo-tratos',    label: 'Custo de Tratos',    icon: '🌿' },
    ],
  },
  { type: 'link', href: '/relatorios', label: 'Relatórios', icon: '📋' },
  ...(showAdmin ? [{
    type: 'group', label: 'Administração', icon: '🛠️',
    items: [
      { href: '/fazendas', label: 'Fazendas', icon: '🏡' },
      { href: '/usuarios', label: 'Usuários', icon: '👤' },
    ],
  }] : []),
];

// ── Dropdown flutuante para sidebar colapsada ──────────────────
function CollapsedDropdown({ item, currentPath, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={styles.collapsedDropdown} ref={ref}>
      <div className={styles.collapsedDropdownTitle}>{item.label}</div>
      {item.items.map(sub => (
        <Link
          key={sub.href}
          href={sub.href}
          className={`${styles.collapsedDropItem} ${currentPath === sub.href ? styles.collapsedDropItemActive : ''}`}
          onClick={onClose}
        >
          <span>{sub.icon}</span>
          <span>{sub.label}</span>
        </Link>
      ))}
    </div>
  );
}

// ── Item de navegação ──────────────────────────────────────────
function NavItem({ item, collapsed, currentPath, onNavigate }) {
  const isActive = item.type === 'link'
    ? currentPath === item.href
    : item.items?.some(i => currentPath === i.href);

  // Grupos: abertos se a página atual está nele, fechados caso contrário
  const [open, setOpen] = useState(isActive && item.type === 'group');
  // Dropdown flutuante quando collapsed
  const [dropOpen, setDropOpen] = useState(false);

  // Quando a rota muda, fecha dropdown flutuante
  useEffect(() => { setDropOpen(false); }, [currentPath]);

  // Quando sidebar colapsa, fecha todos os grupos abertos
  useEffect(() => {
    if (collapsed) setDropOpen(false);
  }, [collapsed]);

  if (item.type === 'link') {
    return (
      <Link
        href={item.href}
        className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
        title={collapsed ? item.label : undefined}
        onClick={onNavigate}
      >
        <span className={styles.navIcon}>{item.icon}</span>
        {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
        {isActive && !collapsed && <span className={styles.activeBar} />}
      </Link>
    );
  }

  // Grupo — sidebar expandida
  if (!collapsed) {
    return (
      <div className={styles.navGroup}>
        <button
          className={`${styles.navGroupBtn} ${isActive ? styles.navGroupBtnActive : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          <span className={styles.navIcon}>{item.icon}</span>
          <span className={styles.navLabel}>{item.label}</span>
          <span className={styles.groupArrow}>{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className={styles.navGroupItems}>
            {item.items.map(sub => (
              <Link
                key={sub.href}
                href={sub.href}
                className={`${styles.navSubLink} ${currentPath === sub.href ? styles.navSubLinkActive : ''}`}
                onClick={onNavigate}
              >
                <span className={styles.subIcon}>{sub.icon}</span>
                <span>{sub.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Grupo — sidebar colapsada: ícone + dropdown flutuante
  return (
    <div className={styles.navGroupCollapsed}>
      <button
        className={`${styles.navGroupBtn} ${isActive ? styles.navGroupBtnActive : ''}`}
        title={item.label}
        onClick={() => setDropOpen(o => !o)}
      >
        <span className={styles.navIcon}>{item.icon}</span>
        {isActive && <span className={styles.activeBarCollapsed} />}
      </button>
      {dropOpen && (
        <CollapsedDropdown
          item={item}
          currentPath={currentPath}
          onClose={() => { setDropOpen(false); onNavigate(); }}
        />
      )}
    </div>
  );
}

// ── Layout principal ───────────────────────────────────────────
export default function Layout({ children }) {
  const router = useRouter();
  const { userProfile, currentFarm, allFarms, switchFarm, signOut } = useAuth();
  const { isAdmin, isManager } = usePermissions();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const showAdminMenu = isAdmin() || isManager();
  const isAdminGeral = userProfile?.role?.level === 1;
  const currentPath = router.pathname;

  // Fecha sidebar mobile em QUALQUER mudança de rota — método mais robusto
  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  const navItems = NAV_GROUPS(showAdminMenu);

  return (
    <div className={`${styles.appShell} ${collapsed ? styles.shellCollapsed : ''}`}>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${mobileOpen ? styles.sidebarMobileOpen : ''}`}>

        {/* Logo + toggle */}
        <div className={styles.sidebarHeader}>
          {!collapsed && <div className={styles.logo}>🐂 Confinamento</div>}
          <button
            className={styles.collapseBtn}
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Fazenda */}
        {!collapsed && (
          <div className={styles.sidebarFarm}>
            {allFarms?.length > 1 ? (
              <select
                className={styles.seletorFazenda}
                value={currentFarm?.id || ''}
                onChange={(e) => switchFarm(e.target.value)}
              >
                {allFarms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            ) : (
              currentFarm && <span className={styles.nomeFazenda}>🏡 {currentFarm.name}</span>
            )}
          </div>
        )}

        {/* Navegação */}
        <nav className={styles.sidebarNav}>
          {navItems.map((item, idx) => (
            <NavItem
              key={idx}
              item={item}
              collapsed={collapsed}
              currentPath={currentPath}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        {/* Rodapé */}
        <div className={styles.sidebarFooter}>
          {!collapsed && userProfile && (
            <div className={styles.userInfo}>
              <span className={styles.userIcon}>👤</span>
              <span className={styles.userName}>{userProfile.name}</span>
            </div>
          )}
          <button onClick={handleSignOut} className={styles.btnSair} title="Sair">
            {collapsed ? '⬅️' : '⬅ Sair'}
          </button>
        </div>
      </aside>

      {/* ── TOPBAR MOBILE ── */}
      <div className={styles.topbarMobile}>
        <button className={styles.hamburger} onClick={() => setMobileOpen(o => !o)}>☰</button>
        <div className={styles.logo}>🐂 Confinamento</div>
        {currentFarm && <span className={styles.topbarFarm}>{currentFarm.name}</span>}
      </div>

      {/* ── MAIN ── */}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
