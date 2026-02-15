# 📁 Estrutura do Projeto

```
confinamento-gado/
│
├── 📁 database/
│   └── schema.sql                    # Script SQL completo do banco
│
├── 📁 public/
│   └── 📁 images/                    # Imagens e assets
│
├── 📁 src/
│   ├── 📁 components/
│   │   ├── 📁 layout/
│   │   │   └── Layout.jsx            # Layout principal com menu
│   │   ├── 📁 forms/                 # Componentes de formulários
│   │   └── 📁 common/                # Componentes reutilizáveis
│   │
│   ├── 📁 contexts/
│   │   └── AuthContext.js            # Contexto de autenticação
│   │
│   ├── 📁 hooks/                     # Custom hooks
│   │
│   ├── 📁 lib/
│   │   └── supabase.js               # Cliente Supabase
│   │
│   ├── 📁 pages/
│   │   ├── _app.jsx                  # Configuração global do Next.js
│   │   ├── index.jsx                 # Página de login
│   │   ├── dashboard.jsx             # Dashboard principal
│   │   ├── usuarios.jsx              # Gerenciamento de usuários
│   │   ├── fazendas.jsx              # Gerenciamento de fazendas
│   │   ├── gado.jsx                  # [A CRIAR] Cadastro de gado
│   │   ├── baias.jsx                 # [A CRIAR] Cadastro de baias
│   │   ├── racoes.jsx                # [A CRIAR] Cadastro de rações
│   │   ├── alimentacao.jsx           # [A CRIAR] Controle de alimentação
│   │   ├── pesagem.jsx               # [A CRIAR] Registro de pesagens
│   │   ├── movimentacao.jsx          # [A CRIAR] Movimentação de gado
│   │   ├── despesas.jsx              # [A CRIAR] Controle de despesas
│   │   ├── receitas.jsx              # [A CRIAR] Controle de receitas
│   │   ├── relatorios.jsx            # [A CRIAR] Geração de relatórios
│   │   ├── configuracoes.jsx         # [A CRIAR] Configurações do sistema
│   │   └── painel-tv.jsx             # [A CRIAR] Modo painel para TV
│   │
│   └── 📁 styles/
│       ├── globals.css               # Estilos globais + responsivo
│       ├── Layout.module.css         # Estilos do layout
│       ├── Login.module.css          # Estilos da página de login
│       ├── Dashboard.module.css      # Estilos do dashboard
│       ├── Users.module.css          # Estilos de usuários
│       └── Farms.module.css          # Estilos de fazendas
│
├── .env.example                      # Exemplo de variáveis de ambiente
├── .env.local                        # Variáveis locais (não commitado)
├── .gitignore                        # Arquivos ignorados pelo Git
├── next.config.js                    # Configuração do Next.js
├── package.json                      # Dependências do projeto
├── README.md                         # Documentação principal
└── DEPLOY.md                         # Guia de deploy

```

## 📝 Descrição dos Diretórios

### `/database`
Contém scripts SQL para configuração do banco de dados Supabase.

### `/public`
Arquivos estáticos acessíveis publicamente (imagens, ícones, etc).

### `/src/components`
Componentes React reutilizáveis organizados por categoria:
- **layout/** - Componentes de estrutura (header, sidebar, footer)
- **forms/** - Componentes de formulários
- **common/** - Componentes genéricos (botões, cards, modais)

### `/src/contexts`
Contextos React para gerenciamento de estado global:
- **AuthContext** - Autenticação e dados do usuário

### `/src/hooks`
Custom hooks personalizados para lógica reutilizável.

### `/src/lib`
Bibliotecas e configurações:
- **supabase.js** - Cliente e helpers do Supabase

### `/src/pages`
Páginas da aplicação (Next.js routing automático).
Cada arquivo `.jsx` vira uma rota automaticamente.

### `/src/styles`
Arquivos CSS:
- **globals.css** - Estilos globais e variáveis CSS
- **[Nome].module.css** - CSS modules específicos de cada página

## 🎨 Convenções de Código

### Nomenclatura
- **Componentes:** PascalCase (`Layout.jsx`)
- **Arquivos CSS:** camelCase + `.module.css`
- **Funções:** camelCase (`loadData()`)
- **Constantes:** UPPER_CASE (`MAX_UPLOAD_SIZE`)

### Estrutura de Componentes
```jsx
import { useState, useEffect } from 'react';
import styles from '../styles/Component.module.css';

export default function ComponentName() {
  const [state, setState] = useState(initialValue);
  
  useEffect(() => {
    // Effects
  }, [dependencies]);
  
  const handleEvent = () => {
    // Handler logic
  };
  
  return (
    <div className={styles.container}>
      {/* JSX */}
    </div>
  );
}
```

### Classes CSS
- Use CSS Modules para evitar conflitos
- Variáveis CSS em `:root` no globals.css
- Mobile-first approach na responsividade

## 🔄 Fluxo de Dados

```
Usuário
  ↓
Componente (React)
  ↓
Context (Estado Global)
  ↓
Supabase Client
  ↓
Banco de Dados (PostgreSQL)
```

## 🚀 Próximas Páginas a Criar

1. **gado.jsx** - Cadastro de gado (individual/lote)
2. **baias.jsx** - Gerenciamento de baias
3. **racoes.jsx** - Cadastro de tipos de ração
4. **alimentacao.jsx** - Controle diário de alimentação
5. **pesagem.jsx** - Registros de pesagem
6. **movimentacao.jsx** - Movimentação entre baias
7. **despesas.jsx** - Controle financeiro de despesas
8. **receitas.jsx** - Controle de receitas
9. **relatorios.jsx** - Geração de PDF
10. **configuracoes.jsx** - Configurações gerais
11. **painel-tv.jsx** - Dashboard para TV

## 📱 Responsividade

Todas as páginas seguem o padrão:
- **Mobile (≤430px):** Layout vertical, fontes menores
- **Tablet (431-1024px):** Layout intermediário
- **Desktop (>1024px):** Layout completo

## 🔐 Segurança

- RLS habilitado em todas as tabelas
- Autenticação via Supabase Auth
- Permissões por perfil de usuário
- Dados isolados por fazenda

---

**Esta estrutura foi projetada para ser escalável e organizada!**
