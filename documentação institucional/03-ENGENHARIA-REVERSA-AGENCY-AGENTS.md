# Engenharia reversa — Agency Agents

**Origem:** https://github.com/msitarzewski/agency-agents  
**Referência analisada anteriormente:** branch `main`, commit `8ae6164602c95ca78828b148b9052460ee426885`.  
**Natureza:** inspeção inicial do repositório público; confirmar novamente no checkout e na revisão atual antes de importar.

## 1. Papel arquitetural

Agency Agents é principalmente um catálogo de especialistas digitais, instruções profissionais, metodologias e ferramentas de distribuição para diferentes runtimes. Não é, por si só, uma plataforma empresarial de gestão ou um control plane de execução.

Sua contribuição central para a NettosCorp é definir quem são os profissionais digitais, quais competências possuem, como trabalham e como podem ser combinados.

## 2. Catálogo

A inspeção anterior identificou:
- 18 divisões.
- 283 arquivos Markdown candidatos nas divisões.
- 282 perfis válidos encontrados pelo gerador de integração Hermes.
- README com contagem anunciada diferente, indicando inconsistência documental a reconciliar.
- `divisions.json` como referência das divisões.
- Scripts de validação de divisões e lint de agentes.
- `CONTRIBUTING.md` com regras de contribuição.

O catálogo deve ser importado preservando:
- Conteúdo Markdown original.
- Frontmatter e identificadores.
- Slug e divisão.
- Versão ou commit de origem.
- Data e origem da importação.
- Hash do conteúdo importado.
- Relação entre versão original e versão adaptada.
- Histórico de alterações locais.

Não substituir o corpus original por uma representação simplificada sem manter o documento-fonte.

## 3. Modelo profissional

Os perfis podem conter identidade, missão, personalidade, regras, responsabilidades, entregáveis, workflow, comunicação, competências e limitações.

No TokenizAi, esses dados devem ser estruturados para busca e composição de equipes, mas o Markdown original deve permanecer recuperável e versionado.

## 4. NEXUS e metodologias

A estratégia NEXUS identificada descreve fases:
0. Intelligence/Discovery.
1. Strategy/Architecture.
2. Foundation.
3. Development.
4. Quality/Hardening.
5. Launch/Growth.
6. Operations/Evolution.

Foram identificadas modalidades NEXUS-Full, NEXUS-Sprint e NEXUS-Micro, além de handoffs que carregam contexto, objetivo, arquivos, critérios e evidências.

No TokenizAi, NEXUS deve ser tratado como metodologia configurável e executável por meio de planos, fases, responsabilidades, tarefas, critérios de entrada/saída e entregáveis. Não basta exibir o documento como texto.

## 5. Formação de equipes

A capacidade de identificar especialidades necessárias e selecionar perfis adequados é um dos principais ativos a preservar.

O Team Composer do TokenizAi deve evoluir para:
- Capturar objetivo e escopo.
- Extrair competências necessárias.
- Distinguir requisitos obrigatórios e desejáveis.
- Recomendar perfis com justificativas.
- Explicar o mecanismo utilizado (determinístico, IA ou híbrido).
- Mostrar lacunas e conflitos de responsabilidade.
- Permitir seleção e aprovação humana conforme autoridade.
- Propor liderança e estrutura de equipe.
- Associar metodologia/runbook.
- Gerar plano de trabalho e responsabilidades.

Uma pontuação heurística não deve ser apresentada como avaliação comprovada de competência.

## 6. Integração Hermes

A inspeção anterior identificou:
- Gerador `scripts/build-hermes-plugin.py`.
- Integração em `integrations/hermes/`.
- Ferramentas `agency_agents_search`, `agency_agents_inspect`, `agency_agents_load` e `agency_agents_delegate`.
- Carregamento sob demanda e geração de `agents.json`.
- Uso de ciclo de vida de subagentes do Hermes, com fallback para prompt especializado.
- Limites e timeouts internos que devem ser verificados na versão atual.

Esses mecanismos podem informar a camada de integração do TokenizAi com Hermes, mas não devem ser confundidos com uma implementação de chat, organograma ou gestão empresarial.

## 7. Cuidados de incorporação

- Verificar licença e obrigações de atribuição antes de copiar, distribuir ou modificar conteúdo/código.
- Preservar proveniência e autoria.
- Não instalar automaticamente todos os perfis como agentes operacionais.
- Não confundir catálogo, homologação, instância e execução.
- Verificar compatibilidade e qualidade dos perfis.
- Revisar instruções antes de executá-las com ferramentas e permissões reais.
- Evitar duplicidade com identidades institucionais próprias da NettosCorp.

## 8. Trabalho de auditoria pendente

Confirmar no checkout:
- Contagem atual de perfis e divisões.
- Integridade do frontmatter e slugs.
- Licença e atribuição aplicáveis.
- Fidelidade do catálogo embutido no TokenizAi.
- Atualidade e validade dos exemplos e ferramentas Hermes.
- Cobertura de testes e CI.
- Comportamento real dos scripts de conversão e instalação.

O Agency Agents deve ser incorporado como biblioteca profissional e metodológica nativa, não como uma segunda aplicação que o usuário precise abrir.
