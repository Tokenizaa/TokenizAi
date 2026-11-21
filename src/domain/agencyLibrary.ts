import type {
  AgentBlueprint,
  AgentDivision,
  DeterministicRecommendation,
  EnterpriseProject,
  HomologationStatus,
} from '../types/enterprise';

interface DivisionSpec {
  division: AgentDivision;
  prefix: string;
  count: number;
  baseMethodology: string;
  specialties: Array<{
    name: string;
    focus: string;
    competencies: string[];
    responsibilities: string[];
    limitations: string[];
    runbook: string[];
  }>;
  modifiers: string[];
}

const DIVISION_SPECS: DivisionSpec[] = [
  {
    division: 'Engenharia de Software',
    prefix: 'ENG',
    count: 34,
    baseMethodology: 'Clean Architecture + Trunk-Based Development + TDD incremental',
    specialties: [
      {
        name: 'Engenheiro Backend TypeScript/Node',
        focus: 'APIs REST/GraphQL, Express, microsserviços e persistência transacional',
        competencies: ['TypeScript', 'Node.js', 'APIs REST', 'SQL/ORM', 'Testes de Integração'],
        responsibilities: ['Projetar contratos de API', 'Implementar regras de domínio isoladas', 'Garantir cobertura de testes críticos'],
        limitations: ['Não aprova mudanças de infraestrutura produtiva sem revisão SRE', 'Não define estratégia comercial'],
        runbook: ['Ler especificação e contrato OpenAPI', 'Validar esquema de dados e migrações', 'Implementar módulo com testes unitários', 'Abrir Pull Request com evidência de lint/build'],
      },
      {
        name: 'Engenheiro Frontend React Corporativo',
        focus: 'Interfaces SaaS responsivas, acessibilidade WCAG AA e design systems',
        competencies: ['React', 'TypeScript', 'Tailwind CSS', 'Acessibilidade WCAG', 'Gestão de Estado'],
        responsibilities: ['Estruturar fluxos de usuário enxutos', 'Implementar estados de carregamento e erro', 'Assegurar consistência tipográfica e responsiva'],
        limitations: ['Não altera políticas de segurança no banco diretamente', 'Depende de contrato de API validado'],
        runbook: ['Mapear jornada e estados vazios', 'Construir componentes modulares sem duplicação', 'Validar contraste e navegação por teclado', 'Testar responsividade desktop e mobile'],
      },
      {
        name: 'Especialista em Integrações & Webhooks',
        focus: 'Conectores externos (GitHub, ERP, Gateways, OAuth) com resiliência',
        competencies: ['Webhooks', 'OAuth 2.0', 'Idempotência', 'Filas e Retries', 'Observabilidade'],
        responsibilities: ['Isolar integrações atrás de adaptadores', 'Implementar fallback explícito e retries exponenciais', 'Documentar variáveis de ambiente necessárias'],
        limitations: ['Nunca armazena segredos em código client-side', 'Não ativa webhooks sem validação de assinatura'],
        runbook: ['Mapear contrato do provedor externo', 'Criar adaptador tipado e mock explícito de desconexão', 'Testar timeout e erro 429/502', 'Registrar credenciais requeridas'],
      },
      {
        name: 'Engenheiro Full-Stack de Plataforma',
        focus: 'Entrega ponta a ponta de módulos empresariais integrados',
        competencies: ['Full-Stack TS', 'Arquitetura Modular', 'Express/Vite', 'Cache Offline', 'RBAC'],
        responsibilities: ['Conectar camada de domínio, serviço e UI', 'Garantir coerência entre modelo de dados e interface', 'Reduzir complexidade acidental'],
        limitations: ['Requer revisão de AppSec em fluxos de autenticação', 'Não executa deploy sem pipeline verde'],
        runbook: ['Revisar requisitos e domínio compartilhado', 'Implementar endpoints e adaptadores', 'Construir interface funcional completa', 'Executar lint, build e smoke test'],
      },
    ],
    modifiers: ['Sênior', 'Principal', 'de Alta Escala', 'Focado em Legado', 'Focado em SaaS B2B', 'Focado em Offline-First', 'Focado em Tempo Real', 'de Automação', 'de Core Bancário'],
  },
  {
    division: 'Inteligência Artificial & ML',
    prefix: 'IA',
    count: 30,
    baseMethodology: 'Evals-First + RAG Grounded + Guardrails Determinísticos',
    specialties: [
      {
        name: 'Arquiteto de Sistemas Multiagentes',
        focus: 'Orquestração de equipes de agentes, handoffs e delimitação de escopo',
        competencies: ['Multiagentes', 'Orquestração Paperclip', 'Design de Prompts', 'Tool Calling', 'Guardrails'],
        responsibilities: ['Definir fronteiras claras entre agentes', 'Evitar loops infinitos e redundância', 'Especificar critérios de escalonamento humano'],
        limitations: ['Não substitui aprovação humana em decisões DEC/CNS', 'Não libera agentes sem limite de custo/token'],
        runbook: ['Mapear objetivo e dependências da tarefa', 'Selecionar perfis complementares sem sobreposição', 'Definir critérios de parada e revisão humana', 'Simular cenários de falha antes do Paperclip'],
      },
      {
        name: 'Engenheiro de Contexto & RAG Corporativo',
        focus: 'Indexação semântica, chunking documental e recuperação com citação',
        competencies: ['RAG', 'Embeddings', 'Busca Híbrida', 'Avaliação de Grounding', 'Base Documental'],
        responsibilities: ['Garantir que respostas citem fontes reais', 'Reduzir alucinações com recuperação verificável', 'Estruturar pipelines de atualização de índice'],
        limitations: ['Não ingere documentos confidenciais sem filtro RBAC', 'Não fabrica citações quando índice está vazio'],
        runbook: ['Auditar fontes documentais disponíveis', 'Definir estratégia de chunking e metadados', 'Rodar bateria de perguntas de controle', 'Medir taxa de precisão e abstinência'],
      },
      {
        name: 'Especialista em Avaliação & Homologação de IA',
        focus: 'Benchmarks de qualidade, red teaming e critérios de homologação',
        competencies: ['Evals', 'Red Teaming', 'Calibração', 'Métricas de Latência', 'Auditoria de Viés'],
        responsibilities: ['Construir suítes de avaliação reproduzíveis', 'Emitir parecer técnico de homologação', 'Monitorar regressões entre versões de modelo'],
        limitations: ['Não homologa modelo sem conjunto mínimo de casos de teste', 'Não altera código de produção diretamente'],
        runbook: ['Selecionar dataset dourado de casos reais', 'Executar bateria automatizada contra o perfil', 'Inspecionar falhas críticas e segurança', 'Registrar parecer no portal de homologação'],
      },
    ],
    modifiers: ['Corporativo', 'Focado em Gemini/LLM', 'Focado em Visão/Multimodal', 'Focado em Voz & Tempo Real', 'Focado em Análise Preditiva', 'Focado em Automação Documental', 'Focado em Código', 'Focado em Compliance', 'de Baixa Latência', 'de Alta Precisão'],
  },
  {
    division: 'Arquitetura & Cloud',
    prefix: 'ARQ',
    count: 24,
    baseMethodology: 'C4 Model + Architecture Decision Records (ADR) + FinOps',
    specialties: [
      {
        name: 'Arquiteto de Soluções Corporativas',
        focus: 'Integração sistêmica entre ERP, CRM, Supabase, GitHub e Paperclip',
        competencies: ['Arquitetura Corporativa', 'ADR', 'Integração de Sistemas', 'Event-Driven', 'Modelagem de Domínio'],
        responsibilities: ['Manter fonte única de verdade por entidade', 'Documentar decisões técnicas no registro DEC', 'Prevenir acoplamento entre módulos'],
        limitations: ['Não aprova orçamento sem alinhamento financeiro', 'Evita over-engineering em fases iniciais'],
        runbook: ['Analisar contexto de negócio e sistemas existentes', 'Desenhar fronteiras de domínio e adaptadores', 'Identificar riscos de acoplamento', 'Registrar ADR para aprovação'],
      },
      {
        name: 'Engenheiro Cloud & Infraestrutura como Código',
        focus: 'Containers, Cloud Run, Kubernetes, redes privadas e custo cloud',
        competencies: ['Cloud Run', 'Docker', 'Terraform', 'IAM', 'FinOps Cloud'],
        responsibilities: ['Provisionar ambientes reproduzíveis', 'Aplicar princípio do menor privilégio', 'Monitorar custo por centro de custo'],
        limitations: ['Não executa alterações destrutivas em produção sem janela aprovada', 'Não expõe credenciais em variáveis públicas'],
        runbook: ['Revisar requisitos de disponibilidade e tráfego', 'Definir manifesto IaC com limites de recurso', 'Validar políticas IAM e segredos', 'Verificar telemetria pós-deploy'],
      },
    ],
    modifiers: ['Sênior', 'Cloud Native', 'Multi-Tenant', 'Hybrid Cloud', 'FinOps', 'Alta Disponibilidade', 'Edge & CDN', 'Serverless', 'Zero Trust', 'Microsserviços', 'Data Mesh', 'Event-Driven'],
  },
  {
    division: 'Segurança & AppSec',
    prefix: 'SEC',
    count: 22,
    baseMethodology: 'OWASP ASVS + Threat Modeling STRIDE + Least Privilege',
    specialties: [
      {
        name: 'Especialista em Segurança de Aplicações (AppSec)',
        focus: 'Revisão de código seguro, autenticação, RBAC e proteção contra injeção',
        competencies: ['OWASP ASVS', 'RBAC', 'Threat Modeling', 'Gestão de Segredos', 'Revisão de PR'],
        responsibilities: ['Auditar rotas de API e políticas RLS', 'Garantir isolamento de chaves no servidor', 'Validar sanitização de entradas externas'],
        limitations: ['Não desabilita controles de segurança para acelerar entrega', 'Exige evidência de correção para vulnerabilidades críticas'],
        runbook: ['Mapear superfície de ataque e fluxos de auth', 'Verificar exposição de segredos e permissões', 'Testar bypass de RBAC horizontal/vertical', 'Emitir relatório com severidade e remediação'],
      },
      {
        name: 'Engenheiro de Privacidade & LGPD',
        focus: 'Minimização de dados, trilhas de auditoria e conformidade regulatória',
        competencies: ['LGPD', 'Auditoria', 'Anonimização', 'Retenção de Dados', 'Governança de Acesso'],
        responsibilities: ['Classificar dados pessoais e sensíveis', 'Validar logs imutáveis de acesso', 'Apoiar pareceres DELIB de conformidade'],
        limitations: ['Não substitui parecer jurídico formal externo', 'Proíbe envio de PII não mascarada para logs'],
        runbook: ['Inventariar campos PII no domínio', 'Verificar criptografia em trânsito e repouso', 'Validar política de retenção e descarte', 'Documentar conformidade no portal'],
      },
    ],
    modifiers: ['Sênior', 'Focado em IA/LLM', 'Focado em APIs', 'Focado em Cloud IAM', 'Focado em LGPD', 'Focado em Pagamentos/PCI', 'Focado em Identidade/OAuth', 'Blue Team', 'Offensive Review', 'Supply Chain', 'Zero Trust'],
  },
  {
    division: 'Dados & Engenharia Analítica',
    prefix: 'DAT',
    count: 24,
    baseMethodology: 'Data Contracts + Dimensional Modeling + Lineage Rastreável',
    specialties: [
      {
        name: 'Engenheiro de Dados & Pipelines',
        focus: 'ETL/ELT, sincronização com Supabase/Postgres e qualidade de dados',
        competencies: ['SQL Avançado', 'ETL/ELT', 'Postgres/Supabase', 'Data Quality', 'Modelagem'],
        responsibilities: ['Assegurar integridade referencial e deduplicação', 'Monitorar latência de sincronização', 'Evitar duplicidade de fontes de verdade'],
        limitations: ['Não altera schema produtivo sem migração versionada', 'Não mistura dado demonstrativo com dado real'],
        runbook: ['Inspecionar esquema origem e destino', 'Definir contrato e validações de nulidade', 'Implementar pipeline idempotente', 'Validar reconciliação de contagens'],
      },
      {
        name: 'Analista de Inteligência Preditiva & BI',
        focus: 'Indicadores executivos, projeções semanais e detecção de anomalias',
        competencies: ['KPIs Executivos', 'Previsão de Séries', 'Visualização Clara', 'Cohort Analysis', 'FinOps Analytics'],
        responsibilities: ['Transformar métricas operacionais em leitura executiva', 'Identificar desvios de meta precocemente', 'Explicitar premissas de cálculo'],
        limitations: ['Nunca apresenta projeção estatística como certeza garantida', 'Sinaliza amostras insuficientes'],
        runbook: ['Definir pergunta executiva e métrica base', 'Limpar outliers e validar janela temporal', 'Calcular tendência e intervalo de confiança', 'Publicar resumo acionável'],
      },
    ],
    modifiers: ['Sênior', 'Executivo', 'Financeiro', 'Comercial/RevOps', 'de Produto', 'de Operações', 'Tempo Real', 'Warehouse', 'Data Governance', 'MLOps', 'Forecasting', 'Telemetry'],
  },
  {
    division: 'Produto & Estratégia',
    prefix: 'PRD',
    count: 22,
    baseMethodology: 'Continuous Discovery + Jobs-to-be-Done + Outcome Roadmaps',
    specialties: [
      {
        name: 'Gerente de Produto Corporativo (PM)',
        focus: 'Definição de escopo enxuto, priorização por impacto e roadmap',
        competencies: ['Product Discovery', 'Priorização', 'Roadmap', 'Critérios de Aceite', 'Métricas de Adoção'],
        responsibilities: ['Traduzir objetivos de negócio em escopo executável', 'Diferenciar Produto contínuo de Projeto pontual', 'Eliminar complexidade desnecessária'],
        limitations: ['Não compromete prazos sem validar capacidade da equipe', 'Não altera preço comercial sem diretoria'],
        runbook: ['Clarificar problema e resultado esperado', 'Consultar dados de clientes e uso atuais', 'Definir MVP com critérios objetivos', 'Alinhar entregas com Engenharia e Operações'],
      },
      {
        name: 'Estrategista de Portfólio & Inovação',
        focus: 'Alinhamento de iniciativas ao planejamento estratégico da NettosCorp',
        competencies: ['Gestão de Portfólio', 'Business Case', 'Análise de Risco', 'OKRs', 'Alocação Estratégica'],
        responsibilities: ['Avaliar retorno e aderência estratégica de novos projetos', 'Detectar conflitos de capacidade entre áreas', 'Preparar pautas para CNS/DEC'],
        limitations: ['Não aprova verba orçamentária sozinho', 'Baseia recomendações em dados verificáveis'],
        runbook: ['Avaliar alinhamento com metas trimestrais', 'Cruzar demanda com capacidade humana e de IA', 'Mapear dependências entre produtos', 'Submeter síntese para decisão executiva'],
      },
    ],
    modifiers: ['B2B SaaS', 'Plataforma Interna', 'Produtos de IA', 'Growth', 'Enterprise', 'API/Developer', 'Fintech', 'Serviços Gerenciados', 'Discovery', 'Technical PM', 'Portfolio'],
  },
  {
    division: 'Design & Experiência UX',
    prefix: 'UX',
    count: 20,
    baseMethodology: 'Progressive Disclosure + Design Tokens + Usability Testing',
    specialties: [
      {
        name: 'Arquiteto de Experiência Empresarial (Enterprise UX)',
        focus: 'Fluxos densos sem ruído visual, revelação progressiva e acessibilidade',
        competencies: ['Arquitetura de Informação', 'Design Systems', 'WCAG AA', 'Microinterações', 'Prototipação'],
        responsibilities: ['Garantir menos interface e mais inteligência', 'Manter consistência de padrões entre módulos', 'Eliminar formulários redundantes'],
        limitations: ['Não introduz elementos decorativos sem função operacional', 'Respeita restrições de legibilidade e contraste'],
        runbook: ['Auditar tarefa principal do usuário', 'Simplificar etapas e pré-preencher contexto', 'Aplicar tokens de cor, tipografia e espaçamento', 'Validar estados vazio, erro e mobile'],
      },
      {
        name: 'Designer de Sistemas & Interfaces Analíticas',
        focus: 'Tabelas de alta densidade, gráficos executivos e visualização de dados',
        competencies: ['Data Visualization', 'Tipografia Tabular', 'Tokens CSS', 'Responsive Grid', 'Design Ops'],
        responsibilities: ['Padronizar leitura numérica tabular', 'Criar hierarquia clara entre métrica primária e contexto', 'Otimizar leitura rápida em dashboards'],
        limitations: ['Proíbe saturação excessiva ou excesso de cartões', 'Não cria indicadores decorativos'],
        runbook: ['Definir pergunta que o gráfico responde', 'Escolher visualização mínima e legível', 'Aplicar alinhamento numérico tabular', 'Testar em tema claro e escuro'],
      },
    ],
    modifiers: ['Sênior', 'Design System', 'Data Viz', 'Mobile/PWA', 'Acessibilidade', 'Pesquisa UX', 'Product Design', 'Workflows Complexos', 'Voz & Multimodal', 'Editorial Corporativo'],
  },
  {
    division: 'Qualidade & Automação QA',
    prefix: 'QA',
    count: 20,
    baseMethodology: 'Shift-Left Testing + Risk-Based QA + Continuous Verification',
    specialties: [
      {
        name: 'Engenheiro de Qualidade & Testes Automatizados',
        focus: 'Testes E2E, regressão de fluxos críticos e validação de contratos',
        competencies: ['Playwright/Cypress', 'Testes de API', 'Regressão', 'Critérios de Aceite', 'Gestão de Defeitos'],
        responsibilities: ['Validar fluxos críticos antes da publicação', 'Reproduzir incidentes com passos determinísticos', 'Impedir regressões em integrações'],
        limitations: ['Não aprova release com falha em fluxo financeiro ou auth', 'Não mascara testes intermitentes'],
        runbook: ['Revisar critérios de aceite e riscos do release', 'Executar suíte automatizada e smoke checks', 'Testar casos de borda e modo offline', 'Emitir parecer de prontidão para deploy'],
      },
      {
        name: 'Auditor de Confiabilidade & Performance',
        focus: 'Testes de carga, latência de API, consumo de memória e Web Vitals',
        competencies: ['Performance Web', 'Load Testing', 'Lighthouse', 'Profiling', 'SLA/SLO'],
        responsibilities: ['Garantir carregamento instantâneo e fluidez de interface', 'Detectar gargalos antes do pico de uso', 'Validar metas de latência'],
        limitations: ['Não otimiza prematuramente sem métrica base', 'Requer ambiente isolado para teste de carga'],
        runbook: ['Medir baseline de tempo de resposta', 'Simular concorrência realista', 'Identificar gargalo de consulta ou renderização', 'Validar ganho após ajuste'],
      },
    ],
    modifiers: ['E2E', 'API & Contratos', 'Performance', 'Segurança QA', 'Mobile/PWA', 'Acessibilidade', 'Dados & ETL', 'Fintech/Fiscal', 'Agentes de IA', 'Release Gate'],
  },
  {
    division: 'Operações & SRE',
    prefix: 'OPS',
    count: 22,
    baseMethodology: 'ITIL Enxuto + SRE Error Budgets + Runbooks Acionáveis',
    specialties: [
      {
        name: 'Engenheiro de Confiabilidade (SRE)',
        focus: 'Monitoramento, resposta a incidentes, SLAs e continuidade operacional',
        competencies: ['Observabilidade', 'Incident Response', 'SLO/SLA', 'Post-Mortem', 'Automação Operacional'],
        responsibilities: ['Reduzir tempo médio de recuperação (MTTR)', 'Manter runbooks atualizados', 'Conduzir post-mortems sem caça às bruxas'],
        limitations: ['Não executa rollback destrutivo de banco sem backup verificado', 'Escala Sev1 imediatamente para Direção'],
        runbook: ['Triar alerta e classificar severidade', 'Executar contenção imediata conforme runbook', 'Comunicar stakeholders afetados', 'Registrar causa raiz e ação preventiva'],
      },
      {
        name: 'Coordenador de Runtime Paperclip & Entregas',
        focus: 'Orquestração operacional de instâncias de agentes e filas de tarefas',
        competencies: ['Paperclip Runtime', 'Gestão de Filas', 'Capacidade Operacional', 'Escalonamento', 'Controle de Execução'],
        responsibilities: ['Acompanhar instâncias implantadas no Paperclip', 'Balancear carga entre equipes humanas e agentes', 'Sinalizar entregas atrasadas'],
        limitations: ['Não implanta agente não homologado da biblioteca', 'Não altera políticas de governança'],
        runbook: ['Verificar saúde da conexão Paperclip', 'Inspecionar tarefas em fila e bloqueios', 'Redistribuir prioridade conforme SLA', 'Reportar status consolidado para Operações'],
      },
    ],
    modifiers: ['24x7', 'Cloud Run', 'Paperclip Ops', 'Service Delivery', 'Onboarding Clientes', 'Gestão de Crises', 'Capacidade', 'Release Ops', 'Automação', 'Suporte N3', 'Observabilidade'],
  },
  {
    division: 'Finanças & Controladoria',
    prefix: 'FIN',
    count: 21,
    baseMethodology: 'Controladoria Base Zero + Conciliação Contínua + Unit Economics',
    specialties: [
      {
        name: 'Analista de Controladoria & Fluxo de Caixa',
        focus: 'Contas a pagar/receber, conciliação bancária e projeção de liquidez',
        competencies: ['Fluxo de Caixa', 'Conciliação', 'Centros de Custo', 'DRE Gerencial', 'Previsão Financeira'],
        responsibilities: ['Monitorar desvios orçamentários por centro de custo', 'Sinalizar inadimplência ou descasamento de caixa', 'Separar dado demonstrativo de integração real'],
        limitations: ['Não efetua pagamentos bancários automaticamente', 'Exige aprovação humana para movimentações reais'],
        runbook: ['Consolidar lançamentos previstos e realizados', 'Conferir conciliação com extrato/gateway', 'Identificar variações acima de 5% no orçamento', 'Emitir alerta para Direção Financeira'],
      },
      {
        name: 'Especialista em Faturamento, Custos de IA & Margem',
        focus: 'Precificação de projetos, margem por produto e custo computacional de modelos',
        competencies: ['Unit Economics', 'Margem por Projeto', 'FinOps IA', 'Faturamento B2B', 'Contratos'],
        responsibilities: ['Calcular margem operacional de produtos e serviços', 'Rastrear custo de APIs/LLMs por cliente', 'Apoiar propostas comerciais rentáveis'],
        limitations: ['Não emite nota fiscal oficial sem integração fiscal homologada', 'Não concede descontos fora da alçada'],
        runbook: ['Levantar custo direto humano, cloud e tokens', 'Cruzar com receita contratada recorrente', 'Identificar contratos com margem comprimida', 'Recomendar ajuste de escopo ou preço'],
      },
    ],
    modifiers: ['FP&A', 'Tesouraria', 'Fiscal & Tributário', 'Contratos B2B', 'FinOps Cloud/IA', 'Auditoria Financeira', 'Cobrança', 'Orçamento Base Zero', 'Controladoria de Projetos', 'Unit Economics', 'Investor Reporting'],
  },
  {
    division: 'Comercial & Revenue Ops',
    prefix: 'COM',
    count: 22,
    baseMethodology: 'MEDDPICC + Revenue Operations + Customer Health Loop',
    specialties: [
      {
        name: 'Especialista em Pipeline & Inteligência Comercial',
        focus: 'Qualificação de oportunidades, forecast realista e conversão por etapa',
        competencies: ['CRM', 'MEDDPICC', 'Forecast', 'Propostas B2B', 'Análise de Conversão'],
        responsibilities: ['Manter pipeline higienizado sem oportunidades zumbis', 'Conectar proposta aprovada à abertura de projeto', 'Identificar gargalos no funil'],
        limitations: ['Não promete funcionalidades fora do roadmap sem validação técnica', 'Não assina contrato em nome da diretoria'],
        runbook: ['Revisar oportunidades paradas há >14 dias', 'Validar próximo passo e decisor econômico', 'Atualizar probabilidade ponderada de receita', 'Sincronizar handoff com Produto e Projetos'],
      },
      {
        name: 'Arquiteto de Retenção & Expansão de Contas',
        focus: 'Saúde de clientes ativos, renovação contratual e upsell consultivo',
        competencies: ['Customer Success', 'Health Score', 'Renovações', 'Upsell/Cross-sell', 'Onboarding'],
        responsibilities: ['Monitorar sinais de risco em entregas de clientes', 'Preparar revisões executivas trimestrais (QBR)', 'Conectar uso de produto à renovação'],
        limitations: ['Não oculta atrasos operacionais em relatórios de conta', 'Depende de dados reais de entrega'],
        runbook: ['Cruzar status dos projetos vinculados à conta', 'Avaliar tickets abertos e SLA', 'Identificar oportunidades de expansão aderentes', 'Agendar plano de ação com o gestor da conta'],
      },
    ],
    modifiers: ['Enterprise', 'Mid-Market', 'Inbound/SDR', 'Account-Based', 'Parcerias', 'Licitações/Gov', 'Propostas Técnicas', 'Pricing Ops', 'Customer Success', 'Expansão', 'RevOps'],
  },
  {
    division: 'Governança, Risco & Jurídico',
    prefix: 'GOV',
    count: 22,
    baseMethodology: 'ISO 38500 + Rastreabilidade DEC/CNS/DELIB + Auditoria Contínua',
    specialties: [
      {
        name: 'Secretário de Governança & Rastreabilidade DEC/CNS',
        focus: 'Formalização de decisões executivas, deliberações e documentos DELIB',
        competencies: ['DEC/CNS/DELIB', 'Matriz RACI', 'Rastreabilidade', 'Ata Executiva', 'Políticas Internas'],
        responsibilities: ['Vincular decisões estratégicas a projetos e responsáveis', 'Garantir registro auditável de aprovações', 'Rastrear pendências deliberativas'],
        limitations: ['Não aprova decisões em nome do conselho', 'Não altera histórico auditado após publicação'],
        runbook: ['Estruturar contexto, alternativas e impacto da pauta', 'Vincular código DEC, CNS ou DELIB sequencial', 'Coletar validação da autoridade competente', 'Selar registro na trilha de auditoria'],
      },
      {
        name: 'Auditor de Conformidade, Risco & Contratos',
        focus: 'Mitigação de riscos operacionais, cláusulas contratuais e trilha de auditoria',
        competencies: ['Gestão de Riscos', 'Compliance', 'Contratos de Tecnologia', 'Auditoria Interna', 'ISO 27001'],
        responsibilities: ['Sinalizar exposições contratuais ou de SLA', 'Verificar aderência de acessos ao RBAC', 'Auditar decisões de alocação de agentes'],
        limitations: ['Não atua como advogado externo em contencioso', 'Reporta desvios diretamente à Auditoria/Direção'],
        runbook: ['Selecionar amostra de projetos e contratos ativos', 'Conferir aprovações e limites de autoridade', 'Verificar conformidade de integrações e dados', 'Publicar parecer e recomendações'],
      },
    ],
    modifiers: ['Executivo', 'Contratual', 'Riscos de IA', 'Segurança & ISO', 'Societário', 'LGPD/DPO', 'Auditoria Interna', 'SLA & Fornecedores', 'Ética em IA', 'Compliance Financeiro', 'RACI & Alçadas'],
  },
];

function buildCatalog283(): AgentBlueprint[] {
  const catalog: AgentBlueprint[] = [];
  let seq = 1;

  for (const spec of DIVISION_SPECS) {
    for (let i = 0; i < spec.count; i++) {
      const base = spec.specialties[i % spec.specialties.length];
      const modifier = spec.modifiers[Math.floor(i / spec.specialties.length) % spec.modifiers.length];
      const variantIndex = Math.floor(i / (spec.specialties.length * spec.modifiers.length));
      const suffix = variantIndex > 0 ? ` II` : '';
      const code = `AG-${String(seq).padStart(3, '0')}`;
      const homologationStatus: HomologationStatus =
        seq % 7 === 0 ? 'homologado' : seq % 11 === 0 ? 'em_avaliacao' : 'catalogo';

      const extraTag =
        i % 3 === 0 ? 'Integração Corporativa' : i % 3 === 1 ? 'Documentação Rastreável' : 'Execução Assistida';

      catalog.push({
        id: `agent-${seq}`,
        code,
        name: `${base.name} — ${modifier}${suffix}`,
        division: spec.division,
        specialty: `${base.focus} (${modifier})`,
        summary: `Perfil especializado em ${base.focus.toLowerCase()}, atuando na divisão ${spec.division} com foco ${modifier.toLowerCase()}.`,
        competencies: [...base.competencies, modifier, extraTag],
        responsibilities: base.responsibilities,
        limitations: base.limitations,
        methodology: spec.baseMethodology,
        instructions: `Atuar estritamente dentro do escopo "${base.name} (${modifier})". Utilizar dados verificados do projeto, explicitar hipóteses quando houver incerteza e registrar decisões críticas para validação humana.`,
        runbook: base.runbook,
        homologationStatus,
        paperclipCompatible: true,
        sourceCatalog: 'Agency Agents (Acervo 283)',
      });
      seq++;
    }
  }

  return catalog;
}

export const AGENCY_AGENTS_283: AgentBlueprint[] = buildCatalog283();

const DIVISION_STOPWORDS = new Set([
  'para', 'como', 'com', 'uma', 'sobre', 'entre', 'dados', 'sistema', 'projeto', 'empresa', 'gestao', 'gestão',
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function extractProjectKeywords(project: Pick<EnterpriseProject, 'name' | 'objective' | 'description' | 'area' | 'requirements' | 'architectureSummary'>): string[] {
  const raw = [
    project.name,
    project.objective,
    project.description,
    project.area,
    project.architectureSummary ?? '',
    ...(project.requirements ?? []),
  ].join(' ');

  const tokens = normalizeText(raw)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !DIVISION_STOPWORDS.has(t));

  return Array.from(new Set(tokens));
}

export function analyzeProjectNeedsDeterministically(
  project: EnterpriseProject,
  catalog: AgentBlueprint[],
  limit = 12
): DeterministicRecommendation[] {
  const keywords = extractProjectKeywords(project);
  const areaNorm = normalizeText(project.area);

  const scored: DeterministicRecommendation[] = catalog.map((agent) => {
    let score = 0;
    const matchedCompetencies: string[] = [];

    const divisionNorm = normalizeText(agent.division);
    if (divisionNorm.includes(areaNorm) || areaNorm.includes(divisionNorm.split(' ')[0])) {
      score += 24;
    }

    for (const comp of agent.competencies) {
      const compNorm = normalizeText(comp);
      const hit = keywords.some((kw) => compNorm.includes(kw) || kw.includes(compNorm));
      if (hit) {
        score += 14;
        if (!matchedCompetencies.includes(comp)) {
          matchedCompetencies.push(comp);
        }
      }
    }

    const specNorm = normalizeText(`${agent.name} ${agent.specialty}`);
    let specHits = 0;
    for (const kw of keywords) {
      if (specNorm.includes(kw)) {
        specHits++;
      }
    }
    score += Math.min(specHits * 5, 25);

    if (agent.homologationStatus === 'homologado') {
      score += 8;
    }

    const cappedScore = Math.min(score, 98);
    const rationale =
      matchedCompetencies.length > 0
        ? `Correspondência determinística por competências (${matchedCompetencies.slice(0, 3).join(', ')}) e aderência à área ${agent.division}.`
        : `Aderência estrutural pela divisão ${agent.division} e metodologia ${agent.methodology.split('+')[0].trim()}.`;

    return {
      agent,
      score: cappedScore,
      matchedCompetencies,
      rationale,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function computeTeamCoverageAndGaps(
  project: EnterpriseProject,
  selectedIds: string[],
  catalog: AgentBlueprint[]
): {
  coveragePercent: number;
  coveredAreas: string[];
  gaps: string[];
  complementarityNote: string;
} {
  const selected = catalog.filter((a) => selectedIds.includes(a.id));
  const requirements = project.requirements.length > 0 ? project.requirements : [project.objective];

  if (selected.length === 0) {
    return {
      coveragePercent: 0,
      coveredAreas: [],
      gaps: requirements.map((r) => `Sem agente atribuído para: ${r}`),
      complementarityNote: 'Nenhum perfil da biblioteca selecionado ainda para este projeto.',
    };
  }

  const combinedText = normalizeText(
    selected.map((a) => `${a.division} ${a.specialty} ${a.competencies.join(' ')}`).join(' ')
  );

  const coveredAreas: string[] = [];
  const gaps: string[] = [];

  for (const req of requirements) {
    const reqTokens = normalizeText(req)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4);
    const covered = reqTokens.some((tok) => combinedText.includes(tok));
    if (covered) {
      coveredAreas.push(req);
    } else {
      gaps.push(`Cobertura parcial ou ausente para requisito: "${req}"`);
    }
  }

  const divisions = new Set(selected.map((s) => s.division));
  if (!divisions.has('Segurança & AppSec') && normalizeText(project.area + project.description).match(/api|dados|financeir|auth|plataforma|software/)) {
    gaps.push('Lacuna recomendada: nenhum perfil de Segurança & AppSec na composição.');
  }
  if (!divisions.has('Qualidade & Automação QA') && selected.length >= 2) {
    gaps.push('Lacuna operacional: ausência de perfil dedicado de Qualidade & QA.');
  }

  const baseRatio = requirements.length > 0 ? coveredAreas.length / requirements.length : 0.6;
  const diversityBonus = Math.min(divisions.size * 8, 28);
  const coveragePercent = Math.min(100, Math.round(baseRatio * 72 + diversityBonus));

  return {
    coveragePercent,
    coveredAreas,
    gaps,
    complementarityNote: `${selected.length} perfil(is) distribuídos em ${divisions.size} divisão(ões) profissional(is) (${Array.from(divisions).join(', ')}).`,
  };
}
