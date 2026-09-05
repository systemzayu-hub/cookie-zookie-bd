# Cargos e auditoria no plano gratuito

A implementação usa Firebase Authentication com Google, transações do Firestore e regras verificadas no servidor. Não depende de Cloud Functions nem de faturamento Blaze.

| Operação | Funcionário | Administrador | Dono |
| --- | --- | --- | --- |
| Catálogo e venda paga/pendente | Sim | Sim | Sim |
| Preços, estoque, clientes e pagamentos antigos | Não | Sim | Sim |
| Financeiro, relatórios, backup, auditoria e desfazer | Não | Sim | Sim |
| Adicionar, bloquear e alterar cargos | Não | Não | Sim |
| Alterar o próprio cargo ou o dono | Não | Não | Não |

Sem cadastro autorizado = sem acesso. O dono autoriza a conta Google em **Auditoria → Equipe e acessos**. Não há senhas internas nem promoção automática no primeiro login.

## Validação

- `npm ci && npm run verify`: tipos, testes de aplicação e build.
- Com Java 21 e Firebase CLI: `firebase emulators:start --only firestore --project demo-cookie-zookie --config firebase.emulators.json`.
- Em outro terminal: `npm run test:rules`. Os testes usam somente o emulador local na porta 8089 e verificam permissões, fraude, concorrência e reversão.
- `functions/` e seus testes com adaptador são a implementação anterior, preservada como referência; não são implantados por firebase.json nem usados pelo site.

## Implantação inicial

`node scripts/activate-free.mjs --firebase-tools CAMINHO_PARA_LIB_DA_CLI` verifica a identidade dona do projeto, confirma faturamento desativado e cria backup privado fora do repositório. Sem `--apply`, não altera produção.

Depois de verificar testes e build, executar com `--apply`. O script publica as regras, normaliza os registros existentes sem alterar suas quantidades e cria catálogos, registro de IDs e cargo inicial por e-mail verificado. Uma precondição de versão impede sobrescrever uma venda concorrente. Se a gravação inicial falhar, restaura as regras anteriores. Recusa repetir a migração quando já existem acessos.

Publicar o build de `dist/` no GitHub Pages na mesma janela. Clientes antigos precisam recarregar o site. A conta Google dona do projeto recebe o cargo Dono; outras contas precisam ser autorizadas por ela.

## Auditoria e limites

- Novas alterações compartilhadas têm registro imutável e dados anteriores/posteriores gravados na mesma transação. Falha na auditoria cancela a operação.
- **Auditoria → Histórico → Desfazer** mostra os registros envolvidos. A reversão preserva alterações posteriores compatíveis e recusa conflitos e repetição.
- Vendas de funcionários permitem até cinco sabores diferentes por venda, com preço e estoque conferidos nas regras. Quantidade de unidades não está limitada a cinco.
- Funcionários recebem produtos e nomes/IDs dos clientes; não podem ler contatos, financeiro ou histórico de vendas de outras pessoas.
- Ações antigas sem dados de recuperação não podem ser desfeitas automaticamente.
- Custos/perdas e suas reversões continuam locais ao aparelho/conta; exigem navegador com Web Locks.
- Cargos são corrigidos escolhendo outro cargo pela equipe; não há transferência do dono pela interface.
- O Firestore possui cotas gratuitas e limite de tamanho por documento. O modelo mantém no máximo 500 produtos, 2.000 clientes e 5.000 vendas, sujeito ao tamanho real dos dados. Atingir um limite exige manutenção; não ativa cobrança automaticamente.
- Snapshots e auditoria ocupam armazenamento. A interface carrega os 500 registros mais recentes por fonte; dados mais antigos continuam no banco.
