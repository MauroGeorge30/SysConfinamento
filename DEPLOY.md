# 📚 Guia Completo de Deploy

## 🗄️ PASSO 1: Configurar o Supabase

### 1.1 Criar Projeto
1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em "New Project"
3. Preencha:
   - Nome do projeto: `confinamento-gado`
   - Database Password: (escolha uma senha forte)
   - Region: `South America (São Paulo)`
4. Aguarde a criação do projeto (2-3 minutos)

### 1.2 Executar o Script SQL
1. No dashboard do Supabase, vá em **SQL Editor**
2. Clique em "+ New Query"
3. Copie todo o conteúdo do arquivo `database/schema.sql`
4. Cole no editor e clique em **Run**
5. Aguarde a execução (deve aparecer "Success")

### 1.3 Copiar Credenciais
1. Vá em **Settings** > **API**
2. Copie:
   - `Project URL` (ex: https://xxxxx.supabase.co)
   - `anon public` key (chave longa que começa com eyJ...)
3. Guarde essas informações

### 1.4 Configurar Autenticação
1. Vá em **Authentication** > **Providers**
2. Habilite **Email** (já deve estar habilitado)
3. Em **Email Templates**, personalize se desejar

## 📂 PASSO 2: Preparar o Código

### 2.1 Criar Repositório no GitHub
```bash
# No terminal, na pasta do projeto:
git init
git add .
git commit -m "Initial commit - Sistema de Confinamento"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/confinamento-gado.git
git push -u origin main
```

### 2.2 Criar arquivo .env.local
Na raiz do projeto, crie `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...sua_chave_aqui
```

## 🚀 PASSO 3: Deploy na Vercel

### 3.1 Via Interface Web (Recomendado)
1. Acesse [vercel.com](https://vercel.com)
2. Faça login com GitHub
3. Clique em **Add New** > **Project**
4. Selecione o repositório `confinamento-gado`
5. Configure:
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

6. Em **Environment Variables**, adicione:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...sua_chave
   ```

7. Clique em **Deploy**
8. Aguarde 2-3 minutos
9. ✅ Pronto! Seu sistema está no ar!

### 3.2 Via CLI (Alternativo)
```bash
# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Configurar variáveis de ambiente
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Novo deploy com as variáveis
vercel --prod
```

## 👥 PASSO 4: Criar Primeiro Usuário

### 4.1 Via Supabase Dashboard
1. No Supabase, vá em **Authentication** > **Users**
2. Clique em **Add user** > **Create new user**
3. Preencha:
   - Email: `admin@fazenda.com`
   - Password: `senha123` (troque depois)
   - Auto Confirm User: ✅ SIM
4. Copie o **UUID** do usuário criado

### 4.2 Criar Fazenda e Vincular Usuário
1. Vá em **Table Editor** > **farms**
2. Clique em **Insert** > **Insert row**
3. Preencha:
   - name: `Fazenda Principal`
   - location: `Sua Cidade - UF`
   - owner: `Seu Nome`
   - capacity: `1000`
   - default_feed_limit: `800`
   - status: `active`
4. Copie o **UUID** da fazenda criada

### 4.3 Vincular Usuário à Fazenda
1. Vá em **Table Editor** > **users**
2. Clique em **Insert** > **Insert row**
3. Preencha:
   - id: (UUID do usuário copiado no passo 4.1)
   - name: `Administrador`
   - email: `admin@fazenda.com`
   - farm_id: (UUID da fazenda)
   - default_farm_id: (UUID da fazenda)
   - role_id: (Selecione "Administrador Geral")
   - status: `active`

## ✅ PASSO 5: Testar o Sistema

1. Acesse seu site na Vercel: `https://seu-projeto.vercel.app`
2. Faça login com:
   - Email: `admin@fazenda.com`
   - Senha: `senha123`
3. ✅ Sucesso! Você deve ver o Dashboard

## 🔄 PASSO 6: Atualizações Futuras

Sempre que fizer alterações:

```bash
git add .
git commit -m "Descrição da alteração"
git push

# A Vercel faz deploy automático!
```

## 🔒 PASSO 7: Segurança (IMPORTANTE!)

### 7.1 Alterar Senha do Primeiro Usuário
1. Entre no sistema
2. Vá em Configurações > Perfil
3. Altere a senha padrão

### 7.2 Configurar RLS no Supabase
O script SQL já ativa o RLS, mas verifique:
1. Vá em **Table Editor**
2. Clique em qualquer tabela
3. Na aba **Policies**, deve aparecer "RLS enabled"

### 7.3 Limitar Acesso ao Dashboard Supabase
1. Nunca compartilhe as credenciais do Supabase
2. Use apenas o `anon key` no frontend
3. O `service role key` NUNCA deve ir para o código

## 📱 PASSO 8: Configurar WhatsApp (Opcional)

### 8.1 Z-API
1. Acesse [z-api.io](https://z-api.io)
2. Crie uma conta e conecte o WhatsApp
3. Copie o Token da API
4. Na Vercel, adicione variável de ambiente:
   ```
   WHATSAPP_API_KEY = seu_token_aqui
   ```

### 8.2 Twilio (Alternativo)
1. Acesse [twilio.com](https://twilio.com)
2. Crie conta e configure WhatsApp Business
3. Copie credenciais
4. Configure na Vercel

## 🎯 Checklist Final

- [ ] Supabase configurado
- [ ] Script SQL executado
- [ ] Código no GitHub
- [ ] Deploy na Vercel feito
- [ ] Variáveis de ambiente configuradas
- [ ] Primeira fazenda criada
- [ ] Primeiro usuário criado e vinculado
- [ ] Login funcionando
- [ ] Dashboard carregando
- [ ] Senha padrão alterada
- [ ] RLS ativo

## 🆘 Problemas Comuns

### Erro: "Invalid API Key"
- Verifique se copiou corretamente as keys do Supabase
- Certifique-se que as variáveis estão no formato correto

### Erro: "Table does not exist"
- Execute o script SQL novamente no Supabase
- Verifique se todas as tabelas foram criadas

### Erro: "Cannot read property of undefined"
- Limpe o cache do navegador
- Faça hard refresh (Ctrl + Shift + R)

### Deploy falhou na Vercel
- Verifique os logs de build
- Certifique-se que o package.json está correto
- Tente fazer deploy novamente

## 📞 Suporte

Se encontrar dificuldades, verifique:
1. Logs de erro no console do navegador (F12)
2. Logs de build na Vercel
3. Logs de queries no Supabase

---

**Pronto! Seu sistema está completo e funcionando! 🎉**
