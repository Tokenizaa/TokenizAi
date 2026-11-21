# Comunicação e orquestração de equipes

## 1. Objetivo

Transformar chat, formação de equipes e delegação em um sistema integrado de colaboração. Os profissionais digitais devem trabalhar em equipe, com liderança, responsabilidades, comunicação contextual e entregas rastreáveis.

## 2. Tipos de conversa

- Individual: usuário e agente.
- Gestor-subordinado: orientação, acompanhamento e escalonamento.
- Entre especialistas: consulta, revisão e colaboração técnica.
- Equipe: conversa compartilhada pelos membros.
- Projeto: comunicação vinculada ao objetivo e ao histórico do projeto.
- Operacional: incidentes, execução e coordenação.
- Executiva: reportes e decisões para liderança.

Cada conversa deve possuir participantes, escopo, política de acesso, contexto, mensagens e histórico.

## 3. Formação de equipe

1. Registrar objetivo e resultado esperado.
2. Identificar competências e especialidades necessárias.
3. Separar requisitos obrigatórios e desejáveis.
4. Buscar perfis na biblioteca.
5. Recomendar candidatos com justificativa e proveniência.
6. Expor lacunas, sobreposições e riscos.
7. Recomendar liderança e distribuição de papéis.
8. Permitir aprovação conforme autoridade.
9. Criar equipe e associações organizacionais.
10. Vincular metodologia/runbook e plano de trabalho.

As recomendações devem identificar se vieram de regras determinísticas, IA ou combinação. O usuário deve conseguir entender por que um perfil foi recomendado.

## 4. Delegação

Uma delegação deve registrar:
- Delegante.
- Destinatário.
- Tarefa ou objetivo.
- Contexto e projeto.
- Escopo de autoridade.
- Critério de aceite.
- Prioridade e prazo.
- Recursos/orçamento autorizado.
- Data e estado.
- Histórico de alterações.
- Evidências e resultado.

A delegação não transfere autoridade além do limite permitido ao delegante.

## 5. Ciclo de trabalho

```text
Objetivo
  -> Análise e decomposição
  -> Formação/seleção da equipe
  -> Distribuição de responsabilidades
  -> Conversas e colaboração
  -> Execução de tarefas
  -> Revisão e correção
  -> Consolidação de entregas
  -> Reporte ao gestor
  -> Encerramento e aprendizado
```

## 6. Estados de tarefa

Definir um ciclo consistente, por exemplo:
- Backlog.
- Ready.
- Assigned.
- In Progress.
- Blocked.
- In Review.
- Changes Requested.
- Completed.
- Cancelled.

As transições devem validar permissões, dependências, critérios de aceite e evidências.

## 7. Colaboração entre agentes

A colaboração pode incluir:
- Solicitação de parecer.
- Handoff estruturado.
- Revisão de artefato.
- Consulta de especialista.
- Divisão de subtarefas.
- Consolidação de respostas.

Toda colaboração deve preservar o contexto necessário sem compartilhar dados fora do escopo autorizado. Agentes não devem iniciar cadeias ilimitadas de delegação; limites de profundidade, orçamento, tempo e concorrência são necessários.

## 8. Supervisão e escalonamento

O gestor deve visualizar tarefas, bloqueios, prazos, entregas, conversas relevantes e execuções dos subordinados. O agente deve escalar quando:
- A tarefa exceder suas competências.
- Faltar informação ou acesso.
- O custo/limite for excedido.
- Houver conflito de instruções.
- A ação exigir autoridade superior.
- O critério de qualidade não puder ser atendido.

## 9. Critérios de validação

Testar conversas individuais e coletivas, autorização de participantes, conversão de mensagem em tarefa, delegação hierárquica, bloqueio de delegação indevida, revisão, escalonamento, persistência e auditoria ponta a ponta.
