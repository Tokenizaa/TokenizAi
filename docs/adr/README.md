# ADRs — NettosCorp Enterprise (TokenizAi)

> **Versão:** 1.0
> **Data:** 22 de novembro de 2026
> **Responsável:** Software Architect (Hermes)
> **Aprovação:** ADRs 01–03 ✅ APROVADOS pelo Founder; ADRs 04–10 🕐 PROPOSTOS (aguardando revisão)

Este diretório guarda as **Decision Records (ADRs)** individuais da plataforma, uma por arquivo, seguindo o template do Software Architect:

```
# ADR-XXX: [Título]

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-XXX

## Contexto
...

## Decisão
...

## Consequências
...
```

## Índice de ADRs

| ADR | Título | Status | Fase |
|-----|--------|--------|------|
| ADR-001 | Separação de Identidade (Professional / Agent / Instance / Profile) | ✅ Accepted | 1 |
| ADR-002 | Fonte Única de Verdade por Domínio | ✅ Accepted | 1 |
| ADR-003 | Integração via Adaptadores, Não Modelo Unificado | ✅ Accepted | 1 |
| ADR-004 | Interface de Módulo e Federação (`Module { routes, services, ui, migrations, config }`) | 🕐 Proposed | 5 |
| ADR-005 | Refatoração do `server.ts` para carregamento dinâmico de módulos (`createApp`) | 🕐 Proposed | 5 |
| ADR-006 | Direção de Dependência (Hexagonal / Ports & Adapters) | 🕐 Proposed | 5 |
| ADR-007 | Multi-tenancy com RLS e Isolamento por Organização/Instância | 🕐 Proposed | 5/8 |
| ADR-008 | Camada de Governança (Authority, Policy/OPA, Approval Gateway, Audit Trail) | 🕐 Proposed | 8 |
| ADR-009 | Persistência PostgreSQL + Drizzle + Migrações por Módulo | 🕐 Proposed | 5/8 |
| ADR-010 | Comunicação Entre Módulos e Contratos Explícitos (event bus + ACL Paperclip) | 🕐 Proposed | 5 |

ADRs 01–03 estão registrados em `documentação institucional/14-DECISOES-ARQUITETURAIS.md`.
ADRs 04–10 estão detalhados abaixo (um arquivo cada).

## Protocolo de gestão

| Ação | Responsável | Critério |
|------|-------------|----------|
| Criar ADR | Software Architect | contexto, decisão e consequências claras |
| Aprovar ADR | Founder (Netto Farias) | revisão de impacto e trade-offs aceitos |
| Reabrir ADR | Founder | novas evidências / mudança de cenário |
| Depreciar ADR | Founder | substituído por novo ADR |

Cada abstração deve justificar sua complexidade (sem "architecture astronautics"). Todo ADR nomeia o que se renuncia, não apenas o que se ganha.
