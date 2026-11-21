# Engenharia reversa — Paperclip

**Origem do fork analisado:** https://github.com/Tokenizaa/paperclip  
**Natureza:** síntese da inspeção arquitetural inicial. A auditoria do checkout local e a validação de execução permanecem pendentes.

## 1. Papel arquitetural

Paperclip é uma plataforma de coordenação e gestão operacional de agentes. Sua contribuição para o TokenizAi é a organização do trabalho: estrutura empresarial, agentes vinculados a posições, hierarquia, tarefas, delegação, execução, orçamento e acompanhamento.

O objetivo não é manter o painel Paperclip como interface paralela. O TokenizAi deve oferecer os fluxos empresariais nativamente. Componentes internos podem ser reaproveitados ou encapsulados durante a transição, desde que não criem duas experiências de administração.

## 2. Arquitetura identificada na inspeção pública

A inspeção anterior apontou:
- Monorepo com pnpm workspaces.
- Frontend React 19 + Vite.
- Backend Node.js + Express 5 + TypeScript.
- PostgreSQL e Drizzle ORM.
- Better Auth.
- REST, eventos e MCP.
- Diretórios/pacotes `ui/`, `server/`, `packages/db/`, `packages/shared/`, `packages/adapters/`, `packages/plugins/`, `cli/` e `skills/`.

Esses elementos descrevem a arquitetura observada no repositório consultado; não significam que o checkout local esteja nessa mesma revisão ou que todos os recursos estejam habilitados.

## 3. Conceitos e capacidades a investigar e preservar

### Organização
- Empresa e departamentos.
- Posições/cargos.
- Agentes associados a posições.
- Gestor imediato e relações hierárquicas.
- Cadeia de comando e escopo organizacional.

### Trabalho
- Tarefas, responsáveis e atribuições.
- Delegação e acompanhamento.
- Estados e transições.
- Comentários, entregáveis e histórico.
- Bloqueios, revisões e escalonamento.

### Execução
- Adaptadores de agentes.
- Heartbeats e disponibilidade.
- Sessões e execuções.
- Logs, falhas e resultados.
- Limites, orçamentos e consumo.

### Integração
- API e eventos.
- MCP e ferramentas.
- Plugins e adaptadores.
- Camadas compartilhadas e persistência.

Cada capacidade deve ser validada contra o código atual e os testes; esta lista é um roteiro de investigação, não uma declaração de que todos os fluxos foram homologados.

## 4. Estratégia de incorporação

Para cada mecanismo, decidir entre:
1. Reimplementar nativamente no domínio TokenizAi.
2. Reutilizar pacote ou biblioteca compatível.
3. Encapsular temporariamente como serviço interno.
4. Descartar por redundância, incompatibilidade ou risco.

A decisão deve considerar licença, dependências, segurança, custo de manutenção, maturidade, contratos e capacidade de teste.

## 5. Pontos de atenção

- Confirmar divergência entre fork e upstream e identificar commits efetivamente presentes no checkout.
- Não atualizar ou substituir o fork antes de compreender customizações locais.
- Não inferir funcionamento a partir de documentação ou presença de uma rota.
- Mapear autenticação, autorização e isolamento de dados.
- Avaliar migrações, esquema, transações e integridade.
- Mapear adaptadores e runtimes efetivamente suportados.
- Confirmar o protocolo de comunicação e os mecanismos de chat.
- Verificar heartbeat, agendamento, execução, retry, cancelamento e timeouts.
- Distinguir orçamento configurado de consumo medido.

## 6. Auditoria local necessária

No checkout real, registrar:
- Caminho e remote Git.
- Branch e commit.
- Estado de alterações locais.
- Estrutura de pacotes.
- Fluxos de frontend e API.
- Modelo de dados e migrations.
- Autenticação e autorização.
- Hierarquia e delegação.
- Chat e eventos.
- Runtime e adaptadores.
- Testes automatizados e evidências de execução.
- Dependências e componentes que podem ser reutilizados.

A auditoria diagnóstica não deve modificar código, banco, migrations, configurações ou processos em execução.

## 7. Resultado pretendido

O TokenizAi absorverá os conceitos de gestão organizacional e operacional do Paperclip. A eventual permanência de componentes Paperclip será uma decisão interna de engenharia, não uma exigência para o usuário operar uma segunda plataforma.
