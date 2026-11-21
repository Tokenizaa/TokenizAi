# Modelo de domínio — NettosCorp Enterprise

Este documento define o modelo conceitual inicial. Não representa ainda um esquema SQL homologado.

## 1. Entidades centrais

| Entidade | Responsabilidade |
|---|---|
| Organization | Empresa/organização e limites de tenant |
| HumanUser | Usuário humano autenticado |
| Department | Unidade organizacional |
| Position | Cargo ou posição no organograma |
| AuthorityPolicy | Escopo e limites de autoridade |
| AgentProfile | Perfil profissional reutilizável |
| AgentProfileVersion | Versão imutável do perfil |
| AgentSkill | Competência/skill associada ao perfil |
| Methodology | Metodologia ou runbook |
| MethodologyVersion | Versão de metodologia |
| AgentInstance | Instância organizacional de um perfil |
| RuntimeConfig | Configuração de execução da instância |
| RuntimeProvider | Provedor ou ambiente de execução |
| ToolDefinition | Ferramenta disponível |
| Team | Equipe com objetivo, membros e liderança |
| TeamMembership | Participação e papel de cada membro |
| Project | Projeto empresarial |
| Task | Unidade de trabalho |
| TaskAssignment | Responsável e atribuições |
| Delegation | Ato e relação de delegação |
| Conversation | Conversa contextual |
| ConversationParticipant | Participantes da conversa |
| Message | Mensagem |
| Execution | Execução de agente ou equipe |
| Heartbeat | Sinal de atividade/saúde |
| UsageRecord | Consumo medido ou estimado |
| Budget | Limite financeiro aprovado |
| Approval | Aprovação exigida por política |
| AuditEvent | Registro de ação relevante |
| Artifact | Arquivo, entrega ou evidência |

## 2. Relações fundamentais

- Uma organização possui departamentos, posições, projetos, usuários e políticas.
- Um perfil profissional pode possuir várias versões.
- Um perfil profissional pode originar várias instâncias.
- Uma instância ocupa uma posição organizacional e pode ter um gestor.
- Uma posição pertence a um departamento; a hierarquia entre posições deve ser configurável.
- Uma equipe contém membros humanos e/ou instâncias de agentes.
- Uma equipe pode estar vinculada a um projeto e a uma metodologia.
- Uma tarefa pertence a um contexto de trabalho e possui atribuições e histórico.
- Uma delegação registra delegante, destinatário, escopo, prazo e autoridade.
- Uma conversa possui participantes e pode estar vinculada a projeto, equipe ou tarefa.
- Uma execução referencia a instância, configuração de runtime, tarefa/contexto e resultado.
- Uso medido deve ser distinguível de estimativa.
- Eventos de auditoria registram ator, ação, alvo, instante, origem e resultado.

## 3. Separações que não podem ser violadas

### AgentProfile versus AgentInstance

O perfil descreve o profissional digital. A instância representa uma utilização organizacional concreta. Alterar gestor, cargo ou projeto de uma instância não deve alterar o perfil original.

### Team versus Department

Departamento é unidade organizacional persistente. Equipe é grupo de trabalho montado para um objetivo, podendo ser temporário, multidisciplinar e composto por membros de vários departamentos.

### Position versus AgentInstance

Cargo/posição define uma necessidade e um lugar na organização. Instância é o ocupante digital. A plataforma deve permitir vagas ou posições ainda não ocupadas.

### Task versus Execution

Tarefa descreve o trabalho esperado. Execução registra uma tentativa concreta de realizá-lo. Uma tarefa pode ter múltiplas execuções, revisões e tentativas.

### Conversation versus Task

Conversa registra comunicação. Tarefa registra compromisso de trabalho. Uma mensagem pode originar uma tarefa, mas não deve ser automaticamente tratada como tarefa concluída.

### Budget versus UsageRecord

Orçamento é autorização/limite. Consumo é registro observado ou estimado. Não confundir os dois.

## 4. Hierarquia e autoridade

A relação `reports_to` deve ser modelada com integridade e histórico. A cadeia de comando não substitui as políticas de autoridade: um gestor pode coordenar trabalho sem receber poderes financeiros ou executivos ilimitados.

A autorização efetiva deve considerar:
- Identidade autenticada.
- Organização e escopo.
- Cargo/posição.
- Relação hierárquica vigente.
- Política de autoridade.
- Permissão específica para a ação.
- Estado do recurso e aprovações exigidas.

## 5. Proveniência e versionamento

Perfis e metodologias importados devem guardar repositório de origem, caminho, identificador, commit, versão, hash, data de importação e histórico de transformação. A versão original deve permanecer recuperável.

## 6. Próxima etapa de modelagem

Antes de migrations, produzir ERD, dicionário de dados, regras de integridade, cardinalidades, índices, política de exclusão, retenção e estratégia de migração. Validar o modelo contra fluxos reais e dados existentes.
