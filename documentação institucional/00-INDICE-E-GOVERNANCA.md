# Documentação Institucional — NettosCorp Enterprise

**Repositório:** Tokenizaa/TokenizAi  
**Produto:** NettosCorp Enterprise  
**Plataforma central:** TokenizAi  
**Status:** documentação arquitetural inicial; sujeita a auditorias técnicas complementares.

## Objetivo

Este diretório reúne a visão institucional, as engenharias reversas das plataformas de origem, a arquitetura-alvo e os documentos necessários para evoluir o TokenizAi até a plataforma corporativa unificada da NettosCorp.

A diretriz é incorporar nativamente as melhores capacidades de:

- **Agency Agents:** catálogo de profissionais digitais, identidades, personalidades, competências, especialidades, skills, metodologias, runbooks e formação de equipes.
- **Paperclip:** organização operacional, hierarquia, relações de subordinação, comunicação, tarefas, delegação, execução, orçamento e monitoramento.
- **TokenizAi:** plataforma empresarial, interface, módulos de gestão, governança e integração dos domínios.

O usuário deve administrar a empresa e seus profissionais humanos e digitais pelo TokenizAi, sem precisar operar separadamente os painéis do Agency Agents ou do Paperclip.

## Princípios obrigatórios

1. Uma experiência de produto e navegação centralizada no TokenizAi.
2. Domínios internos modulares, com responsabilidades e contratos explícitos.
3. Separação entre perfil profissional, instância organizacional e configuração de execução.
4. Biblioteca de talentos não equivale a agentes homologados ou operacionais.
5. Formação de equipes, comunicação e delegação são capacidades centrais, não recursos acessórios.
6. Identidade, autenticação e autorização devem ser verificadas no backend.
7. Persistência durável e fonte de verdade definida para cada entidade.
8. Adaptadores desacoplam perfis profissionais de provedores e runtimes.
9. Auditoria e proveniência acompanham importações, alterações, decisões e execuções.
10. Nenhuma tela ou configuração deve ser considerada prova de funcionamento sem testes e evidências.

## Índice documental

| Documento | Conteúdo |
|---|---|
| [01 — Visão e diretrizes](01-VISAO-E-DIRETRIZES.md) | Objetivo, escopo e princípios do produto |
| [02 — Engenharia reversa do TokenizAi](02-ENGENHARIA-REVERSA-TOKENIZAI.md) | Estrutura atual, módulos, pontos válidos e lacunas |
| [03 — Engenharia reversa do Agency Agents](03-ENGENHARIA-REVERSA-AGENCY-AGENTS.md) | Catálogo, identidades, NEXUS, composição e integração Hermes |
| [04 — Engenharia reversa do Paperclip](04-ENGENHARIA-REVERSA-PAPERCLIP.md) | Control plane, hierarquia, tarefas, execução e arquitetura |
| [05 — Arquitetura-alvo](05-ARQUITETURA-ALVO.md) | Domínios e responsabilidades da plataforma unificada |
| [06 — Modelo de domínio](06-MODELO-DE-DOMINIO.md) | Entidades e relacionamentos fundamentais |
| [07 — Comunicação, equipes e delegação](07-COMUNICACAO-E-ORQUESTRACAO-DE-EQUIPES.md) | Fluxos colaborativos e hierárquicos |
| [08 — Integrações e runtimes](08-INTEGRACOES-E-RUNTIMES.md) | Provedores, adaptadores, ferramentas e execução |
| [09 — Segurança e governança](09-SEGURANCA-E-GOVERNANCA.md) | Identidade, autoridade, permissões e auditoria |
| [10 — Roadmap de integração](10-ROADMAP-DE-INTEGRACAO.md) | Fases, dependências e critérios de conclusão |
| [11 — Matriz de aderência](11-MATRIZ-DE-ADERENCIA.md) | Existente, parcial, demonstrativo, ausente e não verificado |
| [12 — Registro de evidências e pendências](12-EVIDENCIAS-E-PENDENCIAS.md) | Evidências, limitações e auditorias ainda necessárias |

## Como interpretar os status

- **Comprovado no código:** estrutura ou fluxo identificado em arquivos específicos.
- **Validado em teste:** comportamento exercitado por teste automatizado ou manual documentado.
- **Parcial:** existe uma implementação, mas faltam partes ou garantias.
- **Demonstrativo/simulado:** dados ou comportamentos de demonstração, seed, heurística ou estimativa.
- **Não verificado:** ainda não há evidência suficiente.
- **Ausente:** não foi identificada implementação na inspeção realizada; requer confirmação na auditoria completa.

## Governança desta documentação

- Atualizar os documentos quando uma auditoria trouxer evidências novas.
- Registrar caminho do arquivo, símbolo/trecho, comportamento observado e método de validação.
- Não converter hipótese arquitetural em fato implementado.
- Não apagar histórico relevante: corrigir por atualização rastreável.
- Mudanças de arquitetura devem atualizar visão, modelo de domínio, roadmap e matriz de aderência.
- A documentação orienta a engenharia; não substitui testes, revisão de segurança ou homologação.

## Limite da análise inicial

Os documentos registram uma primeira leitura do código e dos repositórios de origem. Não afirmam que os três projetos foram executados ou auditados localmente de ponta a ponta. A engenharia reversa local do Paperclip e a auditoria técnica aprofundada do TokenizAi permanecem atividades necessárias.
