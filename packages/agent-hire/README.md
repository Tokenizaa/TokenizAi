# @nettoscorp/agent-hire — Fase 7: Agent Hire Flow

Orquestração de contratação de agentes da Agency para a NettosCorp Enterprise.
Lê um agente do **Paperclip corpus-baseline** (ou fallback catalog-sync / HTTP),
mapeia a divisão AA para um papel NettosCorp, aplica a extensão de frontmatter
`nettoscorp` e devolve um `AgentConfig` válido por schema.

## Arquitetura (Multi-Agent Systems Architect)

O fluxo respeita as regras de governança de pipelines multi-agente:

- **Contrato estruturado, não prose**: `corpusGet` devolve `{agent, rawSource}`;
  `hireAgent` devolve `AgentConfig` tipado e validado por Zod.
- **Fallback chain**: Paperclip corpus → catalog-sync corpus-baseline → HTTP remoto
  (`node-fetch`). Divisão desconhecida → fallback degradado, nunca falha silenciosa.
- **Least privilege**: permissões derivadas do módulo da plataforma via
  `MODULE_PERMISSIONS` (`@nettoscorp/auth`), nunca escopo total.
- **Observabilidade**: log estruturado com `cid` (correlation id / trace_id) em cada
  etapa do `hireAgent`.
- **Defesa contra prompt injection**: o bloco `nettoscorp` lido de conteúdo externo
  é validado por schema Zod antes de compor o `AgentConfig`.

## Estrutura

```
packages/agent-hire/
├── package.json        # deps: @nettoscorp/shared, @nettoscorp/auth, zod, node-fetch
├── tsup.config.ts      # build: tsup (esm + dts)
├── tsconfig.json
├── src/
│   ├── index.ts           # hireAgent(slug, options?) → Promise<AgentConfig>
│   ├── corpus-client.ts   # corpusGet(slug) → Agent + raw source
│   ├── division-mapping.ts# 21 divisões AA → 21 papéis NettosCorp (config-driven)
│   ├── frontmatter-extension.ts  # bloco nettoscorp: {department, clearance, authority, knowledge_domains}
│   └── types.ts
└── README.md
```

## Instalação

O pacote é um workspace do monorepo NettosCorp (`pnpm-workspace.yaml`):

```bash
# na raiz do monorepo
pnpm install
pnpm --filter @nettoscorp/agent-hire run build
```

## Uso

```ts
import { hireAgent } from '@nettoscorp/agent-hire';

const config = await hireAgent('engineering-frontend-developer', {
  divisionOverride: 'engineering',
  clearance: 'restrito',
});

// config: { id, slug, name, division, role, nettoscorp: {department, clearance, authority, knowledge_domains},
//           instructions, tools, permissions, rawSource, source, hiredAt }
```

## Integração com o corpus-baseline

- **Primário**: `agency-agents/src-tauri/resources/corpus-baseline/` — 19 divisões,
  282 agentes em Markdown com frontmatter `--- name/description/color/emoji/vibe ---`.
- **Fallback**: `packages/catalog-sync/corpus-baseline/` (populado pelo pipeline de
  sync da Fase 6; usado se o Paperclip corpus estiver ausente).
- **HTTP**: `AGENT_HIRE_CORPUS_HTTP_BASE` ou `options.httpBase` busca
  `{base}/agents/{slug}.md` via `node-fetch`.

Slug = nome do arquivo `.md` sem extensão (ex. `engineering-frontend-developer`).

## Extensão de frontmatter `nettoscorp`

Qualquer arquivo do agente pode conter um bloco governança:

```yaml
---
name: Frontend Developer
description: ...
nettoscorp:
  department: Engenharia de Software
  clearance: restrito
  authority: operacional
  knowledge_domains:
    - TypeScript
    - React
---
```

Precedência na resolução: defaults do mapeamento de divisão < bloco do arquivo <
opções passadas a `hireAgent`.

## Mapeamento de divisões (21 AA → 21 papéis NettosCorp)

Config-driven em `src/division-mapping.ts` (`DIVISION_ROLE_REGISTRY`). As 19
divisões do corpus mapeiam 1:1; `data-analytics` e `devops-sre` estão reservadas
para expansão até 21 sem tocar código.

| Divisão AA | Papel NettosCorp | Departamento | Clearance | Authority | Módulo |
|------------|------------------|--------------|-----------|-----------|--------|
| engineering | engenheiro-de-software | Engenharia de Software | restrito | tecnica | software-factory |
| design | designer-de-produto | Design & Experiência UX | restrito | tecnica | products |
| product | gerente-de-produto | Gestão de Produto | gerencial | gerencial | products |
| project-management | gerente-de-projetos | Escritório de Projetos | gerencial | gerencial | operations |
| operations | especialista-de-operacoes | Operações | restrito | operacional | operations |
| security | analista-de-seguranca | Segurança & AppSec | confidencial | gerencial | governance |
| finance | analista-financeiro | Finanças & Controladoria | confidencial | gerencial | finance |
| commercial | gestor-comercial | Comercial & Revenue Ops | restrito | operacional | commercial |
| sales | especialista-de-vendas | Comercial & Revenue Ops | restrito | operacional | commercial |
| marketing | analista-de-marketing | Marketing | restrito | operacional | marketing |
| paid-media | especialista-de-midia-paga | Marketing | restrito | operacional | marketing |
| research | cientista-de-pesquisa | Pesquisa & IA/ML | restrito | estrategica_delegada | intelligence-factory |
| healthcare | especialista-saude | Saúde & Ciências da Vida | confidencial | operacional | customers |
| gis | especialista-gis | Geo & Dados Espaciais | restrito | tecnica | products |
| spatial-computing | especialista-computacao-espacial | Geo & Dados Espaciais | restrito | tecnica | products |
| game-development | desenvolvedor-de-games | Desenvolvimento de Jogos | restrito | tecnica | products |
| support | agente-de-suporte | Suporte ao Cliente | publico | operacional | customers |
| testing | engenheiro-de-qe | Qualidade & Automação QA | restrito | tecnica | software-factory |
| scripts | especialista-automacao | Operações | restrito | operacional | operations |
| data-analytics (reservado) | analista-de-dados | Dados & Analytics | restrito | tecnica | intelligence-factory |
| devops-sre (reservado) | especialista-devops-sre | Infraestrutura & SRE | restrito | tecnica | operations |

## Comandos

```bash
pnpm --filter @nettoscorp/agent-hire run build   # tsup → dist/index.js + dist/index.d.ts
pnpm --filter @nettoscorp/agent-hire run check   # tsc --noEmit
```

## Critérios de aceite (Fase 7)

- [x] `package.json` com `@nettoscorp/shared`, `@nettoscorp/auth` (workspace), `zod`, `node-fetch`
- [x] `src/index.ts` exporta `hireAgent(slug, options?): Promise<AgentConfig>`
- [x] `src/corpus-client.ts` exporta `corpusGet(slug)` → Agent + raw source (Paperclip ou catalog-sync)
- [x] `src/division-mapping.ts` mapeamento 21 divisões AA → 21 papéis NettosCorp (config-driven)
- [x] `src/frontmatter-extension.ts` campos `nettoscorp: {department, clearance, authority, knowledge_domains}`
- [x] `hireAgent` compila com tsup; exports resolvem; integração com corpus-baseline documentada
