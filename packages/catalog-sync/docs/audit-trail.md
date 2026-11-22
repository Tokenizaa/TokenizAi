# Auditoria de Trilha de Auditoria — Pipeline de Sync do Catálogo (Fase 6)

**Avaliador**: ComplianceAuditor (Divisão: security)  
**Data da avaliação**: 2026-11-22  
**Framework alvo**: SOC 2  
**Critérios auditados**: CC7.1 (Monitoramento do sistema) e CC7.2 (Resposta a incidentes)  
**Escopo**: `packages/catalog-sync` — pipeline webhook → validação HMAC → diff → sync → rollback/notificação  
**Carve-outs**: interface do operador (UI) e CI/CD externo estão fora do escopo deste documento  
**Período de auditoria**: contínuo a partir da implantação da Fase 6  
**Status geral**: Conforme com ressalvas (controle de imutabilidade implementado; persistência e integração no orquestrador pendentes)

---

## 1. Sumário executivo

O pipeline de sync do catálogo (Fase 6) já implementa boas práticas técnicas de monitoramento (logs estruturados com trace_id/span_id por estágio, métricas de duração, notificação de falhas) e resposta a incidentes (rollback one-click via snapshots imutáveis, notificação de `sync-failed` e `rollback-completed`).

Do ponto de vista de **evidência de auditoria**, o controle ainda não está maduro:

- Não há persistência dos logs de eventos de sync (somente stdout/stderr).
- Não há trilha de auditoria imutável: um operador com acesso ao console poderia apagar ou alterar registros sem detecção.
- Não há política de retenção de logs definida.
- Não há verificação periódica da integridade da trilha de auditoria.

O arquivo `packages/catalog-sync/src/audit-logger.ts` implementa o registro imutável exigido. Está pendente a integração no `SyncOrchestrator` e a definição de rotação/arquivamento de logs antigos.

**Pronto para auditoria SOC 2**: parcial. Com as remediações da seção 8, o pipeline atende CC7.1 e CC7.2 com evidência automatizada.

---

## 2. Eventos estruturados obrigatórios

Todo evento de sync do pipeline deve ser gravado com os seis tipos abaixo. Cada evento carrega, no mínimo, os campos obrigatórios do critério da Fase 6: `trace_id`, `timestamp`, `status`, além de `type`, `stage`, `actor`, `source` e `details`.

| Evento | Estágio | Quando se emite | Status típicos | Exemplo de uso |
|--------|---------|-----------------|----------------|----------------|
| `webhook.received` | webhook | Push event válido recebido e assinatura HMAC verificada | `success`, `failure` | Webhook do GitHub validado (repo, branch, sha) |
| `diff.started` | diff | Início da comparação corpus local vs upstream | `pending`, `success`, `failure` | Download/extração do tarball iniciada |
| `diff.completed` | diff | Término do diff com classificação de agentes | `success`, `failure` | N: 5, atualizados: 2, removidos: 0 |
| `sync.applied` | sync | Diff aplicado ao corpus-baseline (não dry-run) | `success`, `failure` | Arquivos escritos/eliminados, snapshot pré-sync |
| `sync.rolled-back` | rollback | Reversão do corpus-baseline a snapshot anterior | `success`, `failure` | Snapshot restaurado, motivo do rollback |
| `sync.failed` | qualquer | Falha em qualquer estágio do pipeline | `failure` | Erro de download, HMAC inválido, erro de gravação |

**Critério de campos obrigatórios** (aplicado por `AuditLogger.record`):
- `trace_id` (string não vazia): identifica a execução ponta-a-ponta (webhook → diff → sync → notify).
- `timestamp` (ISO 8601 UTC): data/hora da ocorrência do evento.
- `status`: `pending` \| `success` \| `failure` \| `rolled-back` \| `escalated`.

Qualquer gravação que omita `trace_id`, `status` ou informe `timestamp` inválido é rejeitada com erro.

---

## 3. Critério de imutabilidade

Todo evento de sync deve satisfazer:

1. Possui `trace_id`, `timestamp` e `status` no momento da gravação.
2. **Não é mutável após gravação**: não existe método de edição, atualização ou exclusão de entradas já registradas no `AuditLogger`.

Implementação em `packages/catalog-sync/src/audit-logger.ts`:

- Cada entrada é congelada em tempo de execução com `Object.freeze` (entrada e campo `details`).
- O log é **append-only**: `record()` apenas adiciona entradas; não há `update`, `delete` ou `patch`.
- `getEntries()` retorna uma cópia congelada; o array interno nunca é exposto diretamente.

Exemplo de gravação:

```ts
import { createAuditLogger } from './audit-logger';

const logger = await createAuditLogger({ logDir: './.audit-logs' });

await logger.record({
  trace_id: 'sync-abc123',
  status: 'success',
  type: 'sync.applied',
  stage: 'sync',
  actor: 'webhook',
  source: 'SyncOrchestrator',
  details: { releaseSha: 'sha256:...', written: 5, deleted: 0, snapshotId: 'snap-...' },
});
```

---

## 4. Retenção de logs

| Item | Política |
|------|----------|
| Retenção ativa | 365 dias (configurável via `maxRetentionDays`) |
| Armazenamento ativo | JSONL append-only em `.audit-logs/sync-audit.jsonl` |
| Logs além da retenção | Arquivados em storage imutável (WORM/Object Lock) antes da exclusão do ativo |
| Destruição | Somente após aprovação do dono do controle e registro da exceção/destruição na trilha |
| Acesso | Somente leitura para auditores; gravação restrita ao próprio `AuditLogger` |

A retenção é consultável via `getEntriesWithinRetention(days)`. A rotação física (arquivamento/truncamento do log ativo) é uma operação administrativa explícita, fora da cadeia ativa, e deve ser registrada como evento de auditoria quando executada.

---

## 5. Integridade da trilha de auditoria

Para impedir negação e adulteração retroativa, cada entrada é hash-encadeada:

- **Genesis**: a primeira entrada tem `prev_entry_hash: null` e seu hash incorpora o marcador `'genesis'`.
- **Encadeamento**: `entry_hash = SHA-256(prev_entry_hash + conteúdo canônico da entrada)`, com serialização determinística (chaves ordenadas) do payload.
- **Verificação**: `verifyIntegrity()` reconstrói a cadeia e detecta:
  - entradas adulteradas (hash divergente),
  - quebra de cadeia (`prev_entry_hash` diferente do hash da anterior),
  - gaps ou duplicação de sequência.

Qualquer adulteração invalida a entrada e todas as subsequentes até o ponto de reparo, o que é exatamente o que um auditor externo testaria ao amostrar a trilha.

---

## 6. Avaliação de controles — SOC 2 CC7.1 (Monitoramento do sistema)

**Status**: Parcial

**Estado atual**: Logs estruturados por estágio com `trace_id`/`span_id` via `PipelineObserver`; métricas de duração e falhas em memória; notificação de `sync-failed` e `rollback-completed` ao operador. Não há persistência, não há retenção, não há verificação de integridade, não há alerta externo.

**Estado alvo**: Todo evento de sync gravado em trilha de auditoria imutável (`audit-logger.ts`) com `trace_id`, `timestamp`, `status`; persistência JSONL append-only; verificação periódica da cadeia de hash; export de evidências para o auditor; alerta em `sync.failed`.

| Remediação | Esforço | Prioridade |
|------------|---------|------------|
| 1. Integrar `AuditLogger` no `SyncOrchestrator`, emitindo `webhook.received`, `diff.started`, `diff.completed`, `sync.applied`, `sync.rolled-back`, `sync.failed` | 2 dias | Crítico |
| 2. Persistir log em `.audit-logs/sync-audit.jsonl` com rotação de retenção de 365 dias | 1 dia | Crítico |
| 3. Executar `verifyIntegrity()` no pipeline de CI e/ou consulta periódica, falhando o build se a cadeia estiver rompida | 1 dia | Alta |
| 4. Encaminhar `sync.failed` para SIEM/canal de alerta do operador com SLA de detecção | 1 dia | Alta |

**Por que crítico**: CC7.1 exige que eventos de segurança sejam detectados, registrados e que a evidência opere efetivamente ao longo do período de auditoria. Sem persistência e imutabilidade, o auditor não pode amostrar operação efetiva e o controle é considerado não implementado.

---

## 7. Avaliação de controles — SOC 2 CC7.2 (Resposta a incidentes)

**Status**: Parcial

**Estado atual**: `RollbackManager` oferece one-click revert com snapshot pré-sync imutável; notificação de `sync-failed` e `rollback-completed`. Não há plano formal de resposta a incidentes do pipeline, não há classificação de severidade, não há post-mortem, não há definição de quem declara incidente nem SLA de contenção.

**Estado alvo**: Eventos `sync.failed` e `sync.rolled-back` registrados na trilha com estágio, erro e snapshot restaurado; runbook de resposta a incidentes do catálogo; SLAs de detecção/contenção; post-mortem arquivado para incidentes severos.

| Remediação | Esforço | Prioridade |
|------------|---------|------------|
| 1. Documentar runbook de resposta a incidentes do pipeline de sync (quem declara, canais de comunicação, SLA de contenção) | 2 dias | Alta |
| 2. Registrar `sync.failed` com estágio, erro e `trace_id` na trilha de auditoria | (item 6.1) | Crítico |
| 3. Registrar `sync.rolled-back` com ID do snapshot restaurado, agente count e motivo | (item 6.1) | Crítico |
| 4. Executar post-mortem após incidentes sev-1/sev-2 e arquivar como evidência | 1 dia por incidente | Média |
| 5. Treinamento/tabela anual de resposta a incidentes para operadores do catálogo | 1 dia | Média |

---

## 8. Matriz de coleta de evidências

| Control ID | Descrição do controle | Tipo de evidência | Fonte | Método de coleta | Frequência |
|------------|----------------------|-------------------|-------|------------------|------------|
| CC7.1 | Detecção e registro de eventos de sync | Logs de eventos (`sync-audit.jsonl`) | `AuditLogger` | Append-only por evento | Por evento |
| CC7.1 | Integridade da trilha de auditoria | Relatório `verifyIntegrity()` | `audit-logger.ts` | Reexecução da cadeia de hash | Semanal e por auditoria |
| CC7.1 | Retenção de logs | Política + rotação de logs | `docs/audit-trail.md` | Revisão documental | Anual |
| CC7.2 | Detecção de falha do pipeline | Eventos `sync.failed` | `AuditLogger` | Por evento | Por evento |
| CC7.2 | Resposta/rollback | Eventos `sync.rolled-back` + snapshot | `AuditLogger` + `snapshot-manifest.json` | Por evento | Por evento |
| CC7.2 | Notificação de incidente ao operador | Notificações JSON/console | `ConsoleNotifier` | Por evento | Por evento |

---

## 9. Recomendações e próximos passos

1. Integrar `AuditLogger` em `SyncOrchestrator.orchestratePush`/`orchestrateManual` e `rollback`, emitindo os seis eventos obrigatórios.
2. Definir o diretório de logs via variável de ambiente (ex.: `CATALOG_SYNC_AUDIT_LOG_DIR`) com default `.audit-logs`.
3. Adicionar etapa de CI que execute `verifyIntegrity()` sobre o log do ambiente de homologação.
4. Formalizar o runbook de resposta a incidentes (CC7.2) e o SLA de detecção de `sync.failed`.
5. Revisar esta política de retenção anualmente ou sempre que houver mudança regulatória.

---

**Avaliador responsável**: ComplianceAuditor — Divisão de Segurança  
**Data**: 2026-11-22  
**Próxima revisão**: 2027-05-22 (ou antes, se houver mudança de escopo do pipeline)
