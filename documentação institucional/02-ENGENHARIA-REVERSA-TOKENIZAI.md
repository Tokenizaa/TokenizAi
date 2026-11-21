# Engenharia reversa — TokenizAi

**Repositório:** Tokenizaa/TokenizAi  
**Referência inspecionada:** branch `main`  
**Natureza:** inspeção inicial estática de código; não equivale a homologação de produção.

## 1. Interpretação

O TokenizAi já contém uma tentativa de plataforma empresarial para uma organização híbrida de pessoas e agentes digitais. Há módulos de gestão, catálogo de agentes, composição de equipes, chat, operações, projetos e governança.

A direção recomendada é evoluir essa base, não iniciar uma reescrita indiscriminada.

## 2. Stack identificada

- React 19 e TypeScript.
- Vite e Tailwind CSS 4.
- Node.js e Express 4.
- Google Gemini por `@google/genai`.
- Server-Sent Events (SSE).
- Persistência local em arquivos JSON.
- PWA com Vite PWA.
- Bun lockfile presente.

Referências:
- `package.json`
- `server.ts`
- `src/App.tsx`

## 3. Estrutura funcional identificada

A aplicação contém módulos ou domínios de:
- Executive.
- Chat.
- Finance.
- Commercial.
- Customers.
- Marketing.
- Products.
- Projects.
- Software Factory.
- Intelligence Factory.
- Operations.
- Agency Library.
- Team Composer.
- Operational Agents.
- People.
- Governance.
- Admin.

A navegação principal está em `src/components/Layout/AppShell.tsx` e a composição de módulos em `src/App.tsx`.

## 4. Capacidades existentes que merecem ser preservadas

### Biblioteca e identidade profissional

`src/domain/agencyLibrary.ts` contém perfis com atributos como especialidade, arquétipo, personalidade, estilo de comunicação, estilo de trabalho, tomada de decisão, competências, conhecimentos, skills, responsabilidades, limitações e runbook.

É uma base valiosa, mas precisa ser comparada com o corpus original do Agency Agents. A existência de `AGENCY_AGENTS_283` não prova, por si só, fidelidade integral, atualização ou proveniência de todos os perfis.

### Composição de equipes

O módulo Team Composer e os tipos `TeamCompositionRecord`, `DeterministicRecommendation` e `NexusPresetTeam` indicam uma base para recomendação e composição de equipes.

A auditoria deve separar:
- Regras determinísticas.
- Recomendações geradas por IA.
- Presets fixos.
- Lacunas de competência.
- Decisões efetivamente aprovadas por um usuário ou gestor.

### Chat e comunicação entre agentes

O domínio inclui `ChatConversation`, `ChatMessage` e `AgentExecutionSession`. A inspeção inicial identificou fluxos de chat, diálogo entre agentes e propagação de eventos SSE.

É necessário verificar se existem conversas de equipe, associação de conversas a tarefas, controle de participantes, autorização por contexto e persistência confiável.

### Operações e projetos

Os tipos `ProjectTask`, `EnterpriseProject` e os módulos Operations/Projects fornecem uma base para tarefas e execução vinculadas a projetos. A auditoria deve validar delegação real, histórico, evidências, revisão e escalonamento.

### Governança

`src/domain/permissions.ts` define papéis, níveis de autoridade e capacidades. A modelagem é aproveitável como referência de domínio, mas não deve ser considerada segura apenas por existir no frontend.

## 5. Problemas técnicos identificados na inspeção inicial

### Persistência

Em `server.ts`:
- `DB_PATH = '/tmp/nettoscorp-tokenizai-db.json'`
- `SYNC_STORE_PATH = '/tmp/nettoscorp-enterprise-sync.json'`

A persistência principal é baseada em arquivo local temporário. O código captura falhas de gravação e usa fallback, o que não oferece garantias de durabilidade, concorrência, transação ou recuperação necessárias para uma plataforma corporativa.

### Identidade e autorização

A função `getCallerRole(req)` lê `x-nettoscorp-role` do cabeçalho e assume `direcao_executiva` quando ausente. Um papel declarado pelo cliente não é uma identidade autenticada. A autorização deve derivar de sessão/token validado no servidor e ser aplicada em cada endpoint e operação.

### Adaptador Paperclip

A inspeção inicial do fluxo de envio de mensagem identificou uma condição em que a ausência de `PAPERCLIP_ENDPOINT` registra integração pendente; quando a variável está presente, o fluxo ainda pode seguir para `getGeminiClient()`. Isso não comprova chamada real ao Paperclip. Também é necessário conferir se `adapterUsed` reflete o runtime efetivamente acionado.

### Custos e execução

Custos estimados por regra fixa não devem ser apresentados como consumo medido. Estados de agente, sessões, heartbeat e disponibilidade precisam derivar de eventos reais do runtime ou ser explicitamente identificados como simulados.

## 6. Classificação preliminar

| Área | Situação preliminar |
|---|---|
| Shell e navegação | Implementados no código; validar UX e acessibilidade |
| Módulos empresariais | Estrutura presente; validar fluxos e persistência |
| Biblioteca de agentes | Implementada parcialmente; validar proveniência e fidelidade |
| Team Composer | Implementado parcialmente; validar recomendação e composição real |
| Chat | Base implementada; validar chat de equipe e contexto |
| Operations | Base implementada; validar delegação hierárquica |
| Organograma | Tipos e permissões sugerem suporte; validar CRUD e regras |
| Runtime | Parcial; validar adaptadores reais |
| Persistência | Insuficiente para produção conforme inspeção inicial |
| Autenticação/autorização | Não comprovada; risco crítico no modelo observado |
| Paperclip adapter | Não comprovado como integração funcional |
| Supabase | Não comprovado como persistência efetiva |

## 7. Auditoria local ainda necessária

A equipe deve inspecionar o checkout real, mapear todas as rotas e endpoints, rastrear cada fluxo do frontend até a persistência, executar testes seguros, identificar mocks e seeds, validar dependências e confirmar a situação da branch/commit.

Toda afirmação deve incluir caminho, símbolo/trecho e evidência. Não alterar código ou banco durante a auditoria de diagnóstico.
