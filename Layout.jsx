import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../styles/Layout.module.css';

export default function Layout({ children }) {
  const { userProfile, currentFarm, switchFarm, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [farms, setFarms] = useState([]);
  const [showFarmSelector, setShowFarmSelector] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className={styles.layoutContainer}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.menuToggle} onClick={toggleMenu}>
          ☰
        </button>
        
        <div className={styles.logo}>
          🐂 Sistema de Confinamento
        </div>

        <div className={styles.headerRight}>
          {currentFarm && (
            <button 
              className={styles.farmSelector}
              onClick={() => setShowFarmSelector(!showFarmSelector)}
            >
              📍 {currentFarm.name}
            </button>
          )}
          
          <div className={styles.userInfo}>
            <span>{userProfile?.name}</span>
            <button onClick={handleSignOut} className={styles.btnLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className={styles.mainWrapper}>
        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}>
          <nav className={styles.nav}>
            <div className={styles.navSection}>
              <div className={styles.navTitle}>Principal</div>
              <a href="/dashboard" className={styles.navLink}>
                📊 Dashboard
              </a>
            </div>

            <div className={styles.navSection}>
              <div className={styles.navTitle}>Cadastros</div>
              <a href="/usuarios" className={styles.navLink}>
                👥 Usuários
              </a>
              <a href="/fazendas" className={styles.navLink}>
                🏡 Fazendas
              </a>
              <a href="/gado" className={styles.navLink}>
                🐂 Gado
              </a>
              <a href="/baias" className={styles.navLink}>
                🚪 Baias
              </a>
              <a href="/racoes" className={styles.navLink}>
                🌾 Rações
              </a>
            </div>

            <div className={styles.navSection}>
              <div className={styles.navTitle}>Operações</div>
              <a href="/alimentacao" className={styles.navLink}>
                🥣 Alimentação
              </a>
              <a href="/pesagem" className={styles.navLink}>
                ⚖️ Pesagem
              </a>
              <a href="/movimentacao" className={styles.navLink}>
                🔄 Movimentação
              </a>
            </div>

            <div className={styles.navSection}>
              <div className={styles.navTitle}>Financeiro</div>
              <a href="/despesas" className={styles.navLink}>
                💸 Despesas
              </a>
              <a href="/receitas" className={styles.navLink}>
                💰 Receitas
              </a>
              <a href="/relatorios" className={styles.navLink}>
                📄 Relatórios
              </a>
            </div>

            <div className={styles.navSection}>
              <div className={styles.navTitle}>Sistema</div>
              <a href="/configuracoes" className={styles.navLink}>
                ⚙️ Configurações
              </a>
              <a href="/painel-tv" className={styles.navLink}>
                📺 Modo Painel
              </a>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className={styles.mainContent}>
          {children}
        </main>
      </div>

      {/* Overlay para fechar menu em mobile */}
      {menuOpen && (
        <div 
          className={styles.overlay} 
          onClick={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
