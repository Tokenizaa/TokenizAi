# Integrações e runtimes

## 1. Princípio

A identidade profissional não deve ser acoplada a um provedor, modelo ou runtime. Uma instância operacional seleciona uma configuração compatível, versionada e governada.

## 2. Componentes

- RuntimeProvider: fornecedor/ambiente.
- RuntimeAdapter: implementação do contrato de execução.
- ModelConfiguration: modelo e parâmetros.
- ToolRegistry: ferramentas disponíveis.
- SecretReference: referência segura a credencial.
- RuntimeConfig: composição aplicada à instância.
- Execution: tentativa de execução.
- ExecutionEvent: eventos de progresso e resultado.
- UsageRecord: consumo observado ou estimado.

## 3. Contrato mínimo de adaptador

Um adaptador deve definir operações equivalentes a:
- Validar configuração e capacidades.
- Iniciar execução.
- Consultar estado.
- Receber eventos.
- Cancelar execução.
- Recuperar resultado.
- Informar consumo quando suportado.
- Expor erro normalizado.
- Identificar correlação e idempotência.

O contrato deve explicitar capacidades não suportadas. Não presumir que todos os runtimes oferecem streaming, cancelamento, heartbeat ou medição de custo.

## 4. Hermes e Paperclip

Hermes pode atuar como runtime de agentes e ferramentas. Paperclip pode fornecer conceitos e mecanismos operacionais a serem incorporados ou encapsulados. A arquitetura final deve decidir, com evidência, quais componentes serão reutilizados e quais serão substituídos por serviços nativos.

Não marcar um adaptador como Paperclip/Hermes só porque a configuração contém esse nome. Registrar o adaptador efetivamente chamado e a execução efetiva.

## 5. Segurança

- Credenciais armazenadas em cofre/secret manager ou mecanismo seguro.
- Browser nunca recebe chaves privadas de provedor.
- Ferramentas são concedidas por política e instância.
- Escopo mínimo de permissões.
- Logs não devem vazar segredos ou dados sensíveis.
- Execuções devem respeitar orçamento, timeout, concorrência e limites.
- Aprovações são exigidas para ações de alto impacto.

## 6. Observabilidade

Cada execução deve registrar:
- Identificador e correlação.
- Agente/instância e versão de configuração.
- Runtime e modelo efetivamente utilizados.
- Tarefa e conversa relacionadas.
- Início, fim, duração e estado.
- Eventos e erros.
- Uso medido e origem da medição.
- Resultado/artefatos.
- Cancelamento ou retry.

## 7. Estados operacionais

Separar:
- Estado administrativo da instância.
- Estado de disponibilidade do runtime.
- Estado de uma execução específica.
- Estado de heartbeat.
- Estado de homologação.

Um agente cadastrado não está necessariamente implantado; implantado não significa ativo; ativo não significa que uma execução esteja em andamento.

## 8. Validação

Criar testes de contrato para cada adaptador, incluindo configuração inválida, indisponibilidade, timeout, retry, cancelamento, falha parcial, idempotência, resultado, medição e auditoria.
