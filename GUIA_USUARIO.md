# Guia do usuário — Cookie Zookie

## Acesso e sincronização

Entre com a conta Google autorizada. O cargo recebido da equipe define as telas e ações disponíveis: o dono administra acessos e auditoria; administradores podem operar e gerenciar a loja; funcionários registram operações permitidas; contas **viewer** ficam em modo de consulta e acessos bloqueados não operam.

O indicador no menu mostra o estado da conexão:

- **Sincronizado com a equipe**: a loja foi confirmada no servidor.
- **Sincronizando**: há uma atualização em andamento; aguarde antes de editar ou excluir registros sensíveis.
- **Offline · salvo neste aparelho**: a conexão caiu e a cópia local foi preservada. Reconecte para enviar as alterações.
- **Conflito entre aparelhos**: outro aparelho alterou o mesmo registro. Exporte a cópia solicitada na tela e siga a orientação para carregar a versão da equipe.

Os dados compartilhados são separados por área:

| Área | Fonte compartilhada | Cópia e limites locais |
|---|---|---|
| Produtos, vendas e clientes | Firestore da loja | O navegador mantém uma cópia operacional para carregar a tela e trabalhar durante falhas de conexão. |
| Compras e ingredientes | Firestore próprio de compras | Há uma cópia local no navegador. Rascunhos e fotos continuam neste aparelho; fotos não são sincronizadas entre aparelhos. |
| Pagamentos | Firestore próprio de pagamentos | Há uma cópia local no navegador. |
| Custos e perdas | Não são compartilhados pelo Firestore da loja | Permanecem neste navegador. |
| Tema, rascunhos e preferências | Configuração local | Podem desaparecer se os dados do navegador forem apagados. |

## Rotina de uso

Em **Produtos & Estoque**, cadastre sabor, preço, categoria e quantidade. Ajustes de estoque e alterações de produtos entram na sincronização da loja.

Em **Vendas**, registre uma venda manualmente ou cole uma lista. Para uma venda pendente, selecione o cliente. Em **Clientes & Cobrança**, consulte o saldo por cliente, registre pagamentos parciais ou confirme a quitação depois de conferir o valor.

Em **Compras**, registre ingredientes, quantidades, preços e vencimentos. A foto anexada serve para conferência e fica no aparelho que a recebeu. Use **Exportar compras e fotos** para transportar esses registros e imagens; o backup próprio de compras preserva registros já existentes ao importar e não duplica IDs.

Em **Pagamentos**, registre saídas em dinheiro e acompanhe cookies debitados. A quitação ou reabertura de um débito deve ser confirmada nessa área para manter a venda e o histórico consistentes. Essa tela só permite alterações quando os dados estão confirmados pelo servidor.

## Backups

No menu **Backup e instalação**, **Exportar backup** gera o backup da loja depois de uma nova confirmação Google. Ele inclui:

- produtos, vendas e clientes da loja;
- custos e perdas locais.

Esse arquivo não inclui compras nem pagamentos. Compras têm os botões próprios **Exportar compras e fotos**, **Backup anterior à sincronização** e **Importar backup** na tela Compras. O histórico de pagamentos permanece na área Pagamentos e não é incluído no backup da loja.

Antes de importar um backup da loja, confira a confirmação com a quantidade de produtos, clientes e vendas. Faça uma exportação atual antes de restaurar uma versão antiga.

## Auditoria do dono

Abra **Auditoria** com o acesso do dono. A lista agrupa os registros por dia e mostra uma descrição curta da operação, o responsável e o horário. Use a busca para localizar uma pessoa ou alteração; **Filtros** abre as opções de área, tipo de operação e período.

Abra **Ver detalhes** para consultar a descrição completa, a conta, a origem e os valores **Antes/Depois**, agrupados por produto, venda ou cliente. Esses valores descrevem aquela alteração; mudanças posteriores podem ter ocorrido. **Informações do registro** permite conferir o ID quando necessário. Registros antigos sem os dados de comparação mostram essa limitação.

Use **Buscar registros mais antigos** para ampliar o histórico. A busca, os filtros e **Exportar histórico** consideram somente os registros carregados; **Sobre esta auditoria** explica essa abrangência. Os horários seguem Brasília. Nos detalhes, quando **Desfazer** estiver disponível, confira a prévia e confirme a reversão. Conflitos com alterações posteriores impedem a reversão, e registros já desfeitos ficam identificados.

As operações da loja e da equipe usam o histórico compartilhado, para que as ações de diferentes aparelhos possam ser conferidas. A auditoria não é um extrato financeiro completo: pagamentos têm histórico próprio e custos/perdas permanecem locais, portanto essas áreas devem ser conferidas nas telas correspondentes.

## Cuidados com cópias locais

Limpar os dados do navegador pode remover tema, rascunhos, fotos, custos, perdas e cópias locais de compras ou pagamentos. Para compras e pagamentos, o Firestore continua sendo a fonte compartilhada; custos, perdas e fotos dependem dos registros e backups locais. Mantenha os backups próprios quando precisar recuperar dados locais ou imagens.
