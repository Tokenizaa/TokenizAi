# Arquitetura-alvo — NettosCorp Enterprise

## 1. Visão

Uma aplicação principal, uma experiência de navegação e identidade corporativa, com domínios internos independentes, serviços de negócio e infraestrutura compartilhada.

## 2. Camadas

### Experiência TokenizAi
- Shell, navegação e design system.
- Contexto de usuário e organização.
- Telas e fluxos por domínio.
- Notificações e command center.

### Domínios empresariais
- Executivo e estratégia.
- Financeiro e controladoria.
- Comercial e CRM.
- Clientes e atendimento.
- Marketing.
- Produtos e serviços.
- Projetos.
- Pessoas.
- Governança.
- Administração.

### Domínios de inteligência e operação de agentes
- Agency Library.
- Agent Registry e homologação.
- Organizational Management.
- Team Composer.
- Agent Instances.
- Collaboration & Chat.
- Task & Delegation Engine.
- Methodology & Runbook Engine.
- Runtime & Monitoring.

### Serviços compartilhados
- Identidade e autenticação.
- Autorização e autoridade.
- Auditoria e eventos.
- Persistência e repositórios.
- Arquivos e artefatos.
- Notificações.
- Observabilidade.
- Gestão de segredos.
- Integrações externas.

### Infraestrutura
- Supabase/PostgreSQL como opção-alvo a validar e configurar.
- Provedores de IA.
- Hermes e outros runtimes por adaptadores.
- GitHub e APIs externas.
- Filas, eventos e armazenamento de artefatos.

## 3. Arquitetura lógica

```text
                         TOKENIZAI
                 Experiência e navegação única
                              |
       +----------------------+----------------------+
       |                      |                      |
 Gestão Empresarial    Inteligência de Agentes   Operação de Agentes
       |                      |                      |
 Financeiro/CRM        Agency Library           Organograma
 Projetos/Produtos     Identidades/Skills       Equipes
 Pessoas/Governança    Runbooks/NEXUS           Chat/Delegação
       |                      |                      |
       +----------------------+----------------------+
                              |
                  Serviços de domínio compartilhados
                              |
       Identidade | Autoridade | Auditoria | Eventos
       Persistência | Arquivos | Notificações | Segredos
                              |
                 Adaptadores e infraestrutura
                              |
        Supabase | Hermes | Modelos IA | GitHub | APIs
```

## 4. Regras de arquitetura

- Frontend não é fonte de autoridade nem de verdade.
- Regras de negócio residem em serviços de domínio.
- APIs verificam identidade, autorização, escopo e estado.
- Domínios não devem acessar diretamente tabelas internas uns dos outros sem contratos definidos.
- Eventos devem ter identificador, origem, timestamp, contexto e política de idempotência.
- Segredos nunca são persistidos em texto aberto ou enviados ao browser.
- A configuração de runtime é independente do perfil profissional.
- A execução deve ser observável e rastreável.
- A interface deve mostrar claramente estados reais, estimados e demonstrativos.

## 5. Estratégia de implantação

Começar com um monólito modular bem delimitado pode ser mais adequado que introduzir microsserviços prematuramente. Separar processos ou serviços apenas quando houver necessidade comprovada de escala, isolamento, disponibilidade ou ciclo de deploy.

## 6. Decisões ainda abertas

- Modelo definitivo de autenticação e provedor de identidade.
- Estratégia Supabase e migração da persistência atual.
- Arquitetura de eventos e filas.
- Runtime padrão e contrato de adaptadores.
- Estratégia de importação/versionamento do catálogo.
- Reuso ou reimplementação de componentes Paperclip.
- Política de retenção de logs, sessões e artefatos.
- Modelo de custo e rateio por agente, equipe, projeto e departamento.
