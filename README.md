# 🐂 Sistema de Gerenciamento de Confinamento de Gado

Sistema web completo, moderno e profissional para gerenciamento de confinamento de gado, desenvolvido com Next.js, React e Supabase.

## 🚀 Tecnologias

- **Frontend:** Next.js 14 + React 18
- **Backend:** Supabase (PostgreSQL + Auth)
- **Estilização:** CSS Modules (responsivo)
- **Deploy:** Vercel
- **Versionamento:** Git/GitHub

## 📱 Responsividade

O sistema é totalmente responsivo com suporte para:
- 📱 **iPhone** (até 430px) - Fontes menores e layout otimizado
- 📱 **Tablet** (431px - 1024px) - Layout intermediário
- 💻 **Desktop** (acima de 1024px) - Layout completo

## ⚙️ Instalação

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/confinamento-gado.git
cd confinamento-gado
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o Supabase

1. Crie uma conta em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Execute o script `database/schema.sql` no SQL Editor do Supabase
4. Copie as credenciais do projeto

### 4. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
WHATSAPP_API_KEY=sua_chave_whatsapp (opcional)
```

### 5. Execute o projeto

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## 📦 Deploy na Vercel

### Via GitHub

1. Faça push do código para o GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Importe o repositório
4. Configure as variáveis de ambiente
5. Deploy automático!

### Via CLI

```bash
npm install -g vercel
vercel login
vercel
```

## 🗄️ Estrutura do Banco de Dados

O sistema utiliza as seguintes tabelas principais:

- **farms** - Fazendas
- **users** - Usuários do sistema
- **roles** - Perfis de acesso
- **user_permissions** - Permissões por módulo
- **cattle** - Gado individual
- **cattle_batches** - Lotes de gado
- **pens** - Baias
- **feed_types** - Tipos de ração
- **feed_records** - Registros de alimentação
- **weight_records** - Registros de pesagem
- **movements** - Movimentações de gado
- **expenses** - Despesas
- **revenues** - Receitas
- **alerts** - Alertas do sistema
- **notifications** - Notificações WhatsApp

## 👥 Perfis de Acesso

1. **Administrador Geral** - Acesso total
2. **Administrador da Fazenda** - Gerencia uma fazenda
3. **Gerente** - Operações diárias
4. **Operador** - Registros de alimentação e pesagem
5. **Visualizador** - Apenas visualização

## 🔒 Segurança

- Autenticação JWT via Supabase Auth
- Row Level Security (RLS) - Dados separados por fazenda
- Controle de permissões por módulo
- Logs de auditoria

## 📋 Funcionalidades Implementadas

### ✅ Fase 1 (Atual)
- [x] Autenticação de usuários
- [x] Cadastro de usuários com perfis
- [x] Cadastro de fazendas
- [x] Dashboard inicial com estatísticas
- [x] Layout responsivo (iPhone, Tablet, Desktop)
- [x] Menu lateral com navegação
- [x] Sistema de permissões
- [x] Alternância entre fazendas

### 🚧 Próximas Fases
- [ ] Cadastro de gado (individual e lote)
- [ ] Controle de baias
- [ ] Cadastro de tipos de ração
- [ ] Registro de alimentação
- [ ] Alertas automáticos via WhatsApp
- [ ] Registro de pesagens
- [ ] Cálculo de GMD (Ganho Médio Diário)
- [ ] Controle financeiro (despesas e receitas)
- [ ] Relatórios em PDF
- [ ] Modo Painel (TV)
- [ ] Gráficos e análises

## 🎨 Tema Visual

- **Cores principais:** Verde (campo) e Marrom (terra)
- **Estilo:** Profissional e limpo
- **Ícones:** Emojis temáticos

## 📱 Funcionalidade Especial

**Sistema NÃO recarrega ao trocar abas:**
- Utiliza React Context para manter estado
- Dados permanecem em memória
- Formulários não perdem informações

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 📧 Contato

Para dúvidas ou sugestões, entre em contato.

---

**Desenvolvido para gestão profissional de confinamento de gado** 🐂
