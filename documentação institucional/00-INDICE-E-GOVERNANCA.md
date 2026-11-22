# Documentação Institucional — Índice e Governança

> **Repositório:** Tokenizaa/TokenizAi (main)  
> **Diretório:** `documentação institucional/`  
> **Versão:** 2.0  
> **Data:** 21 de novembro de 2026  
> **Responsável:** Hermes (Chefe de Gabinete Executivo)  
> **Autoridade:** Netto Farias (Founder, NettosCorp)

---

## 1. Finalidade

Este diretório é a **única fonte canônica** de documentação arquitetural e institucional da NettosCorp. Consolida:

- Engenharia reversa do **TokenizAi** (plataforma atual) — **v2.0 COM EVIDÊNCIAS REAIS**
- Engenharia reversa do **Agency Agents** (catálogo de especialistas + metodologia NEXUS) — **v1.0 COM EVIDÊNCIAS REAIS**
- Engenharia reversa do **Paperclip** (plataforma de orquestração) — **v1.0 COM EVIDÊNCIAS REAIS**
- Arquitetura alvo da **NettosCorp Enterprise** (plataforma unificada) — **v1.0 PROPOSTA**
- Modelo de domínio, roadmap, matriz de aderência, evidências e pendências — **v2.0 ATUALIZADO COM EVIDÊNCIAS REAIS**

---

## 2. Estrutura dos 13 Documentos

| # | Arquivo | Finalidade | Status | Versão |
|---|---------|------------|--------|--------|
| 00 | `00-INDICE-E-GOVERNANCA.md` | Este arquivo: índice, regras documentais, governança | ✅ Canônico | 2.0 |
| 01 | `01-VISAO-E-DIRETRIZES.md` | Visão institucional, princípios, diretrizes de produto | ✅ Canônico | 1.0 |
| 02 | `02-ENGENHARIA-REVERSA-TOKENIZAI.md` | **Auditoria completa com evidências reais** do TokenizAi | ✅ Canônico | **2.0** |
| 03 | `03-ENGENHARIA-REVERSA-AGENCY-AGENTS.md` | Catálogo, identidades, NEXUS, integração Hermes | ✅ Canônico | 1.0 |
| 04 | `04-ENGENHARIA-REVERSA-PAPERCLIP.md` | Arquitetura, mecanismos, decisões do Paperclip | ✅ Canônico | 1.0 |
| 05 | `05-ARQUITETURA-ALVO.md` | Arquitetura da plataforma unificada NettosCorp Enterprise | ✅ Canônico | 1.0 |
| 06 | `06-MODELO-DE-DOMINIO.md` | Entidades, relacionamentos, modelo de dados unificado | ✅ Canônico | 1.0 |
| 07 | `07-COMUNICACAO-E-ORQUESTRACAO-DE-EQUIPES.md` | Chat, equipes, delegação, handoffs, orquestração | ✅ Canônico | 1.0 |
| 08 | `08-INTEGRACOES-E-RUNTIMES.md` | Adaptadores ACP, provedores sandbox, MCP, runtimes | ✅ Canônico | 1.0 |
| 09 | `09-SEGURANCA-E-GOVERNANCA.md` | Identidade, autoridade, permissões, RBAC, auditoria | ✅ Canônico | 1.0 |
| 10 | `10-ROADMAP-DE-INTEGRACAO.md` | Fases de desenvolvimento, migração, homologação | ✅ Canônico | 1.0 |
| 11 | `11-MATRIZ-DE-ADERENCIA.md` | **Matriz atualizada com evidências reais** do que existe vs. falta | ✅ Canônico | **2.0** |
| 12 | `12-EVIDENCIAS-E-PENDENCIAS.md` | **NOVO** — Evidências consolidadas, pendências P0/P1/P2, decisões pendentes | ✅ Canônico | **2.0 (NOVO)** |

---

## 3. Regras Documentais (Obrigatórias)

### 3.1 Distinção Estrita de Evidência

| Classificação | Definição | Uso Permitido |
|---------------|-----------|---------------|
| **EVIDENCIADO** | Encontrado no código/fonte, com referência a arquivo e linha | Base para decisões, arquitetura, roadmap |
| **INFERIDO** | Deduzido da estrutura, não verificado em execução | Marcado explicitamente como "inferido" |
| **PLANEJADO** | Decisão arquitetural futura, não implementada | Marcado explicitamente como "planejado" |
| **AUSENTE** | Funcionalidade não encontrada no código | Documentado como gap/risco |
| **NÃO VERIFICADO** | Não foi possível inspecionar (ex: runtime, dependência externa) | Registrado como pendência |

> **Regra:** Análise preliminar de código **NÃO** será apresentada como "auditoria local concluída" ou "funcionalidade testada". Lacunas e pontos não verificados ficam registrados explicitamente.

### 3.2 Formato de Citação

Toda afirmação técnica deve citar a origem:

```
[EVIDENCIADO] tokenizai/server.ts:47-61 — health check endpoint
[EVIDENCIADO] tokenizai/src/domain/permissions.ts:15-137 — 11 roles RBAC
[EVIDENCIADO] agency-agents/src-tauri/resources/corpus-baseline/ — 282 agentes
[EVIDENCIADO] paperclip/packages/db/ — 480+ tabelas, 490+ migrations
[INFERIDO] tokenizai/server.ts → Express 4.21 (não Hono)
[PLANEJADO] nettoscorp/shared package extraction (roadmap fase 1)
[AUSENTE] tokenizai/server.ts — nenhum auth middleware
[NÃO VERIFICADO] Paperclip embedded PG behavior under load
```

### 3.3 Controle de Versão

- Cada documento tem cabeçalho com versão, data, responsável
- Alterações apenas via PR revisado ou autorização direta do Founder
- Histórico no git; não editar sem rastreabilidade

---

## 3. Governança de Atualização

| Ação | Autorização | Processo |
|------|-------------|----------|
| Correção factual (erro de citação) | Hermes (autônomo) | Commit direto com referência |
| Nova evidência descoberta | Hermes (autônomo) | Atualiza documento + entry no changelog |
| Mudança de decisão arquitetural | **Founder (Netto Farias)** | Issue → Discussão → Aprovação → Atualização |
| Novo documento | Hermes + Founder | Proposta → Aprovação → Criação |
| Remoção/Arquivamento | Founder | Apenas com justificativa registrada |

---

## 4. Princípios Norteadores

1. **TokenizAi é a plataforma central** — evolui para NettosCorp Enterprise
2. **Agency Agents fornece inteligência profissional** — catálogo, identidades, metodologia NEXUS
3. **Paperclip fornece conceitos de organização** — comunicação, hierarquia, operação, reconciliação
4. **Módulos empresariais existentes são aproveitados** — não reescritos do zero
5. **Separação clara: perfis, instâncias organizacionais, runtimes** — isolamento por design
6. **Nenhuma funcionalidade é "concluída" por ter tela ou estrutura** — precisa de testes, homologação, evidência

---

## 5. Referências Rápidas

| Projeto | Checkout Local | Remote | Branch | Commit Analisado |
|---------|---------------|--------|--------|------------------|
| **TokenizAi** | `/home/lg/workspace/NettosCorp/TokenizAi` | Tokenizaa/TokenizAi | main | `2988750` |
| **Agency Agents (fork)** | `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents` | Tokenizaa/agency-agents-app | main | `da407fe` (v0.3.2) |
| **Agency Agents (upstream)** | N/A | msitarzewski/agency-agents | main | `8ae6164` |
| **Paperclip** | `/home/lg/workspace/NettosCorp/NettosCorp/paperclip` | NettosCorp/paperclip | main | `cb64a236b` (v0.3.1) |

---

## 6. Changelog deste Índice

| Versão | Data | Autor | Mudança |
|--------|------|-------|---------|
| 1.0 | 21/11/2026 | Hermes | Criação inicial — consolidação canônica dos 13 documentos |
| 2.0 | 21/11/2026 | Hermes | **Atualização com evidências reais**: TokenizAi auditado (v2.0), Matriz atualizada (v2.0), Documento 12 criado (Evidências e Pendências) |

---

## 7. Resumo de Evidências por Repositório (Quick Reference)

| Repositório | Commit | Status Auditoria | Evidências Principais |
|-------------|--------|------------------|----------------------|
| **TokenizAi** | `2988750` | ✅ **COMPLETA v2.0** | React 19 + Express, 17 módulos, RBAC frontend, 100% mock data, **sem DB/auth real** |
| **Agency Agents (fork)** | `da407fe` | ✅ **COMPLETA v1.0** | 282 agentes, 21 divisões, Tauri app, **Hermes plugin quebrado**, NEXUS ausente |
| **Agency Agents (upstream)** | `8ae6164` | 🔴 **NÃO AUDITADO LOCAL** | Fonte canônica: catálogo, scripts, NEXUS strategy |
| **Paperclip** | `cb64a236b` | ✅ **COMPLETA v1.0** | 27 packages, 480 tabelas, 12 adapters, Plugin SDK v1.0, MCP, CI/CD verde |

---

## 8. Gaps Críticos Identificados (P0 — Bloqueiam Início)

| # | Gap | Repositório | Evidência | Fase Roadmap |
|---|-----|-------------|-----------|--------------|
| 1 | **Nenhum banco de dados / ORM** | TokenizAi | `grep -r "drizzle\|prisma" src/` → vazio | Fase 1 |
| 2 | **Nenhuma autenticação backend** | TokenizAi | `server.ts` — sem auth middleware | Fase 1 |
| 3 | **Nenhuma persistência real** | TokenizAi | `localStorage` + `/tmp` apenas | Fase 1 |
| 4 | **Nenhum auth providers** | TokenizAi | `server.ts` — sem auth middleware | Fase 1 |
| 5 | **Paperclip não configurado** | TokenizAi | `enterpriseSeed.ts:771-778` | Fase 0 |
| 5 | **Supabase não configurado** | TokenizAi | `enterpriseSeed.ts:751-760` | Fase 0 |
| 6 | **Hermes Plugin quebrado** | Agency Agents | `build-hermes-plugin.py` **AUSENTE** | Fase 0 |
| 7 | **Scripts validação AA ausentes** | Agency Agents | `lib.sh`, `install.sh`, etc. **AUSENTES** | Fase 0 |
| 8 | **NEXUS Strategy ausente no fork** | Agency Agents | `strategy/` **AUSENTE** no fork | Fase 0 |
| 8 | **Antigravity non-deterministic** | Agency Agents | `docs/PLAN.md:88` | Fase 0 |
| 9 | **EvidenceQA name mismatch** | Agency Agents | `agents-orchestrator.md:89` vs `testing-evidence-collector.md` | Fase 0 |

---

*Este índice é a porta de entrada obrigatória para toda a documentação institucional. Qualquer documento fora desta estrutura não tem validade arquitetural. v2.0 reflete auditoria com evidências reais.*