# Matriz de aderência — arquitetura-alvo versus TokenizAi atual

**Status:** avaliação preliminar baseada na inspeção inicial do código. Deve ser atualizada após auditoria local completa.

| Capacidade | Base identificada no TokenizAi | Situação preliminar | Trabalho necessário |
|---|---|---|---|
| Aplicação e navegação | AppShell, App.tsx, módulos | Implementado no código | Validar fluxos e consistência |
| Gestão empresarial | Executive, Finance, Commercial, Customers, Marketing, Products | Parcial | Validar CRUD, persistência e integrações |
| Projetos | Projects e tipos EnterpriseProject | Parcial | Integrar equipes, tarefas, metodologia e orçamento |
| Biblioteca profissional | AgencyLibraryModule, agencyLibrary.ts | Parcial | Comparar com corpus original e versionar |
| Identidade de agentes | Campos de personalidade, competências e responsabilidades | Parcial | Normalizar schema, proveniência e versões |
| Skills e runbooks | Skills e runbook nos perfis | Parcial | Biblioteca independente e execução governada |
| NEXUS | Presets e referências no domínio | Parcial/não verificado | Modelar fases, handoffs e critérios executáveis |
| Composição de equipes | TeamComposerModule | Parcial | Melhorar recomendação, explicabilidade e formação real |
| Cadastro operacional | OperationalAgentsModule | Parcial | Separar perfil, posição e instância |
| Organograma | Tipos OrgPosition e permissões relacionadas | Não verificado | Validar CRUD, hierarquia e integridade |
| Relações reports_to | Modelo a confirmar | Não verificado | Modelar cadeia e histórico |
| Chat individual | ChatModule e tipos de conversa/mensagem | Parcial | Validar persistência e permissões |
| Chat entre agentes | Fluxos identificados na inspeção | Parcial | Validar runtime e rastreabilidade |
| Chat de equipe | Não comprovado na inspeção inicial | Não verificado | Implementar/validar conversas coletivas |
| Delegação hierárquica | Operations e ProjectTask | Parcial | Delegante, destinatário, autoridade e escalonamento |
| Tarefas e entregas | Operations, ProjectTask | Parcial | Ciclo completo, revisões e evidências |
| Runtime/adaptadores | adapters e integração Gemini/Paperclip | Parcial | Contrato e execução efetiva |
| Heartbeat | Não comprovado | Não verificado | Implementar/validar sinais reais |
| Sessões e execuções | AgentExecutionSession | Parcial | Eventos, estados e histórico confiável |
| Custos e orçamento | Finance e estimativas de consumo | Parcial | Separar estimado de medido e integrar orçamento |
| Governança | GovernanceModule e permissions.ts | Parcial | Aplicar autoridade no backend |
| Autenticação | Não comprovada nos fluxos inspecionados | Crítico/não verificado | Identidade autenticada e sessão verificável |
| Autorização backend | getCallerRole lê x-nettoscorp-role | Risco crítico observado | Remover confiança em papel declarado pelo cliente |
| Persistência durável | JSON em /tmp | Insuficiente | Banco durável, transações e migrações |
| Auditoria | GovernanceRecord e appendServerAudit | Parcial | Integridade, escopo, retenção e cobertura |
| Supabase | Variáveis/integração mencionadas anteriormente | Não comprovado | Validar conexão, schema e uso real |

## Critérios de atualização

Cada linha deve conter:
- Estado revisado.
- Arquivos e símbolos.
- Teste ou procedimento executado.
- Resultado observado.
- Responsável e data.
- Pendências e risco residual.

## Definições de status

- **Implementado e validado:** fluxo exercitado com evidência.
- **Implementado parcialmente:** existe, mas não atende integralmente ao critério.
- **Demonstrativo:** mock, seed, fixture ou estimativa.
- **Não verificado:** faltam evidências suficientes.
- **Ausente:** não há implementação identificada após inspeção adequada.
- **Crítico:** risco que impede considerar a capacidade segura ou confiável.
