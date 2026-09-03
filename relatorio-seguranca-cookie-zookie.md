# 🔒 Relatório de Segurança — Cookie Zookie

**50 ideias para impedir furto, roubo, mudanças sem seu conhecimento, exclusão de dados e hackeamento.**

Gerado por 10 especialistas (esquadrão) com auditoria manual do código real. Cada ideia tem: **prioridade** (🔴 Crítica / 🟠 Alta / 🟡 Média / 🟢 Baixa) e **esforço** (Fácil / Médio / Difícil).

---

## ⚠️ O problema nº 1 (confirmado por mim hoje)

Baixei o arquivo JavaScript do seu site do ar e **os hashes das duas senhas estão lá, de graça**, para qualquer funcionário ou hacker que abrir as ferramentas do navegador (F12):

- Hash da senha de edição (`CookiZo0406`) → `70e58a3a...`
- Hash da senha de auditoria (`CoZooAdm0406`) → `231d78fc...`

SHA-256 de senha é rápido de quebrar. Com um computador comum, dá pra descobrir essas senhas em **minutos**. Ou seja: hoje o site **não está seguro de verdade** — a senha só esconde as telas por fora. Quem souber mexer no navegador vê tudo. **A boa notícia: dá pra consertar (ideias 1–6 e 13–20).**

---

## Categoria 1 — 🚪 Impedir furto interno (pessoas da casa/equipe)

| # | Ideia | O que resolve | Prioridade | Esforço |
|---|-------|---------------|------------|---------|
| 1 | **Cada funcionário com login próprio (Google)** | Fim da senha compartilhada; dá pra saber quem fez cada coisa | 🔴 Crítica | Fácil |
| 2 | **Remover serviço de senha e usar login real do Firebase** | Senha que vive no site é frágil; login Google gerenciado pelo Google é forte | 🔴 Crítica | Médio |
| 3 | **Permissões por cargo (admin / vendedor / auditor)** | Vendedor só vê vendas dele; não mexe em preço, custo ou exclusão | 🔴 Crítica | Médio |
| 4 | **Log de quem viu/baixou relatório (com data e quem)** | Você descobre quem abriu lista de clientes ou exportou vendas | 🟠 Alta | Médio |
| 5 | **Indicador na tela de quem está logado (avatar + nome)** | Ninguém usa o aparelho "de outro"; todo mundo sabe quem está ali | 🟠 Alta | Fácil |
| 6 | **Alerta por e-mail/WhatsApp quando entra de dispositivo novo** | Roubo de conta é percebido na hora | 🟡 Média | Fácil |
| 7 | **Mascarar valores R$ \*\*\* (mostrar só com toque longo)** | Cliente ou funcionário não vê faturamento no ombro | 🟡 Média | Fácil |
| 8 | **Ocultar CPF/telefone de cliente (revelar só com senha/biometria)** | Protege dados de menores e contatos (LGPD) | 🟡 Média | Médio |
| 9 | **Sessão expira por inatividade (bloquear em 5 min)** | Celular esquecido no balcão não fica aberto à toa | 🔴 Crítica | Fácil |
| 10 | **Botão "Bloquear agora" na tela do celular** | Trava na hora quando precisa, sem caçar menu | 🟡 Média | Fácil |
| 11 | **Limpar tudo ao fechar a aba/navegador** | Se esqueceu de sair, fechar a aba já resolve | 🔴 Crítica | Fácil |

---

## Categoria 2 — ✏️ Impedir mudanças sem seu conhecimento

| # | Ideia | O que resolve | Prioridade | Esforço |
|---|-------|---------------|------------|---------|
| 12 | **Histórico de versões (quem mudou preço, quando, valor anterior)** | Qualquer alteração fica gravada e reversível | 🔴 Crítica | Médio |
| 13 | **Auditoria imutável (regra Firebase: ninguém pode apagar log)** | Funcionário não apaga o rastro da própria fraude | 🔴 Crítica | Médio |
| 14 | **Notificação no Telegram/WhatsApp a cada venda/mudança importante** | Você fica sabendo em tempo real | 🟡 Média | Médio |
| 15 | **Confirmação dupla para exclusão (digitar "EXCLUIR" + checkbox)** | Clique errado no celular não apaga nada | 🟠 Alta | Fácil |
| 16 | **Aprovação de 2 pessoas para regras de frete/desconto/preço** | Muda regra importante só com uma segunda pessoa | 🟠 Alta | Médio |
| 17 | **Notificação quando produto fica indisponível** | Não há alteração oculta de estoque | 🟡 Média | Fácil |
| 18 | **Registrar mudanças com quem fez + antes/depois** | Diferença exata gravada, não só "algo mudou" | 🟠 Alta | Médio |
| 19 | **Alerta de login de conta fora do horário normal** | Acesso estranho (madrugada) salta aos olhos | 🟡 Média | Fácil |

---

## Categoria 3 — 🗑️ Impedir exclusão permanente de dados

| # | Ideia | O que resolve | Prioridade | Esforço |
|---|-------|---------------|------------|---------|
| 20 | **"Lixeira" de 30 dias: exclusão vira lixeira, volta com 1 clique** | Nada é apagado de vez na hora | 🔴 Crítica | Fácil |
| 21 | **Regra Firebase: bloquear delete direto (só soft-delete)** | Nem hacker nem funcionário apagam em massa | 🔴 Crítica | Médio |
| 22 | **Exclusão definitiva exige senha/reautenticação fresca** | Não apaga coisa importante com a tela já aberta | 🟠 Alta | Médio |
| 23 | **Backup automático diário em lugar separado (Cloud Storage)** | Mesmo que apaguem o Firestore, tem cópia externa | 🟠 Alta | Médio |
| 24 | **Reautenticar (digitar senha de novo) antes de ações destrutivas** | A tecla errada não é desastre | 🟠 Alta | Fácil |
| 25 | **Permitir apagar de vez só o admin** | Vendedor apaga? Sim, mas vai pra lixeira | 🟠 Alta | Fácil |
| 26 | **Teste de restauração trimestral (simular desastre)** | Garante que o backup funciona quando você precisar | 🟡 Média | Difícil |

---

## Categoria 4 — 🛡️ Impedir hackeamento (ataque externo)

| # | Ideia | O que resolve | Prioridade | Esforço |
|---|-------|---------------|------------|---------|
| 27 | **Regras de segurança no Firebase (só dono lê CPF; só admin apaga)** | Bloqueia acesso anônimo via API; é o conserto nº 1 | 🔴 Crítica | Médio |
| 28 | **Remover os hashes de senha do arquivo público do site** | Fecha a falha que confirmei hoje | 🔴 Crítica | Médio |
| 29 | **MFA (2º fator) no Google / contas admin** | Senha roubada sozinha não basta mais | 🔴 Crítica | Fácil |
| 30 | **Trocar SHA-256 por senha forte (PBKDF2/argon2) com salt** | Se mantiver senha, que não dê pra quebrar rápido | 🟠 Alta | Médio |
| 31 | **Limitar tentativas de senha (5 erros → bloquear 15 min)** | Força bruta fica impossível | 🟠 Alta | Fácil |
| 32 | **Firebase App Check (só seu site pode falar com o banco)** | Bot/script externo não lê dados pela API | 🟠 Alta | Médio |
| 33 | **Criptografar dados guardados no navegador (localStorage)** | Quem tiver acesso físico ao aparelho não lê os dados | 🟠 Alta | Médio |
| 34 | **Não mostrar dados sensíveis no HTML enquanto bloqueado** | "Blur" dá pra burlar; não renderizar é seguro | 🟠 Alta | Fácil |
| 35 | **Header de segurança (CSP) no site** | Se um script malicioso entrar, ele não roda | 🟡 Média | Fácil |
| 36 | **Sanitizar textos digitados (impedir injeção/XSS)** | Nome com código malicioso não roda no seu site | 🟡 Média | Médio |
| 37 | **IDs aleatórios seguros (crypto.randomUUID)** | Não dá pra adivinhar/abrir dados de outro | 🟢 Baixa | Fácil |
| 38 | **Desligar métodos de login que não usa (email/senha)** | Menos portas de entrada para atacar | 🟡 Média | Fácil |
| 39 | **Scanner de vulnerabilidades semanal automático** | Acha brecha antes do criminoso | 🟡 Média | Fácil |
| 40 | **Atualizar dependências (npm audit + Dependabot)** | Fecha falhas conhecidas em bibliotecas | 🟢 Baixa | Fácil |
| 41 | **Alertas de orçamento/uso no Firebase** | Detona se alguém começar a puxar dados em massa | 🟡 Média | Fácil |
| 42 | **Bloqueio de captura de tela em dados sensíveis** | Print do CPF/valor não sai fácil | 🟢 Baixa | Médio |
| 43 | **Senha-mestra guardada fora do código (variável de ambiente)** | Nenhuma senha vive no arquivo do site | 🟠 Alta | Médio |

---

## Categoria 5 — 💾 Backup e recuperação (plano B)

| # | Ideia | O que resolve | Prioridade | Esforço |
|---|-------|---------------|------------|---------|
| 44 | **Backup criptografado com senha (AES)** | Backup roubado não vaza dados | 🟠 Alta | Médio |
| 45 | **Hash de integridade em cada backup (detectar corrupção)** | Backup danificado é percebido antes de precisar dele | 🟠 Alta | Fácil |
| 46 | **Backup diário automático do Firestore + usuários** | Cópia da nuvem mesmo de madrugada | 🔴 Crítica | Médio |
| 47 | **Restaurar sem apagar tudo (modo "mesclar" com visualização)** | Volta atrás num erro sem perder o resto | 🟠 Alta | Médio |
| 48 | **Versionamento por dia (ver como estava ontem)** | Estado de qualquer dia acessível | 🟡 Média | Médio |
| 49 | **Runbook de 1 página: subir o site do zero em 30 min** | Se tudo falhar, você tem o passo a passo | 🟠 Alta | Médio |
| 50 | **Backup offline mensal (pen drive criptografado fora de casa)** | Proteção contra incêndio/roubo físico | 🟡 Média | Difícil |

---

## 🎯 Ordem recomendada — comece por aqui

**Semana 1 (Críticas e fáceis):**
1. Cara a cara: remover senha do site e adotar login Google com permissões (`#1, #2, #3`)
2. MFA em todas as contas admin (`#29`)
3. Lixeira de 30 dias + reautenticar antes de apagar (`#20, #24`)
4. Sessão expira em 5 min + bloquear agora (`#9, #10, #11`)
5. Backup diário automático (`#46`)

**Semana 2 (Críticas médias):**
6. Regras de segurança Firebase — bloquear acesso anônimo (`#27`)
7. Remover hashes do arquivo público (`#28, #43`)
8. Auditoria imutável (ninguém apaga log) (`#13`)
9. Histórico de versões de preços (`#12`)

**Depois (altas):** App Check, criptografia de dados no navegador, rate limit, confirmação 2 pessoas, backup criptografado, CSP.

---

### Por que essas 5 ações juntas resolvem seu medo
- **Furto/roubo interno** → login individual + permissões + log + bloqueio por inatividade (`#1–11`)
- **Mudanças sem você saber** → histórico + auditoria imutável + alerta em tempo real (`#12–19`)
- **Exclusão permanente** → lixeira + bloqueio de delete + backup externo (`#20–26`)
- **Hackeamento** → regras Firebase + fim da senha no arquivo + MFA + App Check (`#27–43`)
- **E se tudo falhar** → backup diário + runbook (`#44–50`)
