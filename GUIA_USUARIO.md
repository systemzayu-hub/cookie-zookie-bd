# Guia do Usuário — Cookie Zookie (cookie-app-v2)

---

## 📋 Visão Geral
Este é o sistema de vendas **Cookie Zookie** — um app React + TypeScript + Vite que roda 100% no navegador.  
Hoje todos os dados ficam no **localStorage** do seu notebook (offline, sem nuvem).

---

## 1️⃣ Como enviar o site para os funcionários

### ⚠️ O que acontece hoje (localStorage)
- Os dados **só existem no navegador deste notebook**.
- Se você abrir o site em outro computador/celular, **não verá as vendas, produtos nem clientes** cadastrados aqui.
- Limpar o cache do navegador **apaga tudo**.

### ✅ Opção A — Backup manual (JSON) — **Já funciona hoje**
Use os botões no **rodapé da sidebar** (menu lateral esquerdo):

| Botão | Para que serve |
|-------|----------------|
| **Exportar backup** | Baixa um arquivo `cookie-zookie-backup-YYYY-MM-DD.json` com **todos** os produtos, vendas e clientes. |
| **Importar backup** | Seleciona um `.json` exportado anteriormente e restaura tudo no app. |

**Passo a passo para compartilhar com um funcionário:**
1. Abra o app no seu notebook.
2. Clique em **Exportar backup** → salve o `.json` no WhatsApp / e-mail / Google Drive.
3. Mande o arquivo para o funcionário.
4. O funcionário abre o app no **seu** notebook → clica **Importar backup** → escolhe o `.json` → pronto.

> ⚠️ Isso cria uma **cópia** dos dados no momento da exportação. Alterações futuras de um lado **não sincronizam** automaticamente.

---

### ✅ Opção B — Hospedagem com backend (nuvem) — **Para sincronismo real**
Para que todos vejam os mesmos dados em tempo real, você precisa de um backend. O código já tem o ponto de extensão preparado em `src/db.ts` (comentário `PLUGUE O FIREBASE AQUI`).

**Caminho recomendado (baixo custo, rápido):**
1. Crie um projeto no **Firebase Console** (console.firebase.google.com).
2. Ative **Firestore Database** (modo teste para começar).
3. Copie o `firebaseConfig` (apiKey, projectId, etc.).
4. Em `src/db.ts`, preencha `FIREBASE_CONFIG` com esse objeto e mude `ready: true`.
5. Adicione a lógica de `syncFirebase` (ler/gravar em `doc(db, 'loja', 'dados')`).
6. Faça o deploy no **Vercel**, **Netlify** ou **Firebase Hosting** (grátis).
7. Compartilhe a **URL pública** com a equipe — todos acessam os mesmos dados.

> 💡 O backup JSON (Opção A) serve também para **migrar** seus dados atuais para o Firebase na primeira sincronização.

---

## 2️⃣ Como rodar o projeto

### Pré-requisitos
- **Node.js 18+** instalado (verifique com `node -v`).
- Terminal (PowerShell, Git Bash ou CMD).

### Passo a passo

```bash
# 1. Entre na pasta do projeto
cd "C:\Users\Admin\Documents\Default Project\cookie-app-v2"

# 2. Instale as dependências (só na primeira vez)
npm install

# 3. Rode em modo desenvolvimento (hot reload)
npm run dev
# → Abre em http://localhost:5173 (ou porta indicada no terminal)

# 4. Para testar a build de produção localmente
npm run build
npm run preview
# → Abre em http://localhost:4173
```

**Scripts disponíveis (`package.json`):**
| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de dev com Vite (recarrega ao salvar). |
| `npm run build` | Compila TypeScript + gera pasta `dist/` pronta para deploy. |
| `npm run preview` | Serve a pasta `dist/` localmente para testar o build. |

---

## 3️⃣ Onde estão os dados

### No navegador (localStorage)
As chaves usadas (visíveis no DevTools → Application → LocalStorage):

| Chave | Conteúdo |
|-------|----------|
| `cc_products` | Array de produtos (nome, preço, categoria, estoque, emoji). |
| `cc_sales` | Array de vendas (itens, pagamento, canal, status, total, cliente, data). |
| `cc_customers` | Array de clientes (nome, contato, data de cadastro). |
| `cc_theme` | `true`/`false` — tema escuro/claro. |

### No código-fonte
- **Dados iniciais (seeds):** `src/data.ts` → `seedProducts`, `seedCustomers`, `seedSales`.
- **Persistência:** `src/data.ts` → funções `load()` / `save()` (wrappers do localStorage).
- **Backup JSON:** `src/db.ts` → `exportarDados()`, `baixarBackup()`, `aplicarBackup()`.
- **Ponto de integração Firebase:** `src/db.ts` → constante `FIREBASE_CONFIG` + comentários.

### No build de produção
- A pasta `dist/` contém apenas arquivos estáticos (HTML, JS, CSS).  
- **Não há banco de dados** no `dist/` — os dados continuam no localStorage de quem abre o site.

---

## 📌 Resumo rápido para o dia a dia

| Ação | Como fazer |
|------|------------|
| Abrir o app | `npm run dev` → clique no link do terminal |
| Fazer backup antes de formatar o PC | Sidebar → **Exportar backup** → guarde o `.json` na nuvem |
| Passar dados para novo notebook | Sidebar → **Importar backup** → selecione o `.json` salvo |
| Compartilhar com a equipe (manual) | Exportar backup → enviar arquivo → cada um importa |
| Compartilhar com a equipe (automático) | Implementar Firebase + deploy (ver Opção B acima) |
| Ver dados no navegador | F12 → Application → LocalStorage → chaves `cc_*` |

---

## 🆘 Problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| "Dados sumiram" | Limpeza de cache / modo anônimo | Importar backup anterior |
| `npm run dev` falha | `node_modules` corrompido | `rm -rf node_modules package-lock.json && npm install` |
| Porta 5173 ocupada | Outro Vite rodando | `npm run dev -- --port 3000` |
| Build falha no TypeScript | Erro de tipo novo | Rode `npx tsc --noEmit` para ver o erro exato |

---

**Versão do guia:** 1.0  
**Projeto:** `C:\Users\Admin\Documents\Default Project\cookie-app-v2`  
**Dono:** Cookie Zookie