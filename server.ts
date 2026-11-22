import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { AGENCY_AGENTS_283 } from './src/domain/agencyLibrary.ts';
import { INITIAL_ENTERPRISE_STATE } from './src/domain/enterpriseSeed.ts';
import { AUTHORITY_LABELS, ROLE_DEFINITIONS } from './src/domain/permissions.ts';
import type {
  AgentExecutionSession,
  ChatConversation,
  ChatMessage,
  DepartmentRecord,
  EnterpriseProject,
  EnterpriseState,
  FinancialEntry,
  GovernanceRecord,
  HomologationStatus,
  OperationalAgentInstance,
  OrgPosition,
  ProjectTask,
  TaskLifecycleStatus,
  TeamCompositionRecord,
  UserRole,
} from './src/types/enterprise.ts';

const PORT = 3000;
const DB_PATH = '/tmp/nettoscorp-tokenizai-db.json';
const SYNC_STORE_PATH = '/tmp/nettoscorp-enterprise-sync.json';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0]
) {
  try {
    return await ai.models.generateContent(params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429')) {
      await new Promise((r) => setTimeout(r, 900));
      return await ai.models.generateContent(params);
    }
    throw err;
  }
}

function loadDatabase(): EnterpriseState {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<EnterpriseState>;
      return {
        ...INITIAL_ENTERPRISE_STATE,
        ...parsed,
      };
    }
  } catch {
    // Fallback to initial seed
  }
  return structuredClone(INITIAL_ENTERPRISE_STATE);
}

let db: EnterpriseState = loadDatabase();

function persistDatabase(): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db), 'utf-8');
  } catch {
    // Ephemeral FS fallback
  }
}

function getCallerRole(req: express.Request): UserRole {
  const raw = String(req.headers['x-nettoscorp-role'] || 'direcao_executiva');
  return raw in ROLE_DEFINITIONS ? (raw as UserRole) : 'operacional';
}

function makeAuditHash(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function appendServerAudit(
  title: string,
  summary: string,
  authorName: string,
  authorityRole: string,
  linkedProjectId?: string,
  linkedConversationId?: string
): void {
  const nextIndex = db.governance.filter((g) => g.type === 'AUDIT').length + 101;
  const code = `AUDIT-2026-${nextIndex}`;
  const rec: GovernanceRecord = {
    id: `gov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    code,
    type: 'AUDIT',
    title,
    summary,
    status: 'aprovado',
    authorName,
    authorityRole,
    linkedProjectId,
    linkedConversationId,
    createdAt: new Date().toISOString().slice(0, 10),
    auditHash: makeAuditHash(`${code}-${title}-${Date.now()}`),
  };
  db.governance = [rec, ...db.governance];
}

// SSE Event Bus for real-time updates
const sseClients = new Set<express.Response>();

function broadcastEvent(eventName: string, payload: unknown): void {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

function buildAgentSystemInstruction(
  instance: OperationalAgentInstance,
  position: OrgPosition | undefined,
  department: DepartmentRecord | undefined,
  project: EnterpriseProject | undefined
): string {
  const blueprint = AGENCY_AGENTS_283.find((a) => a.id === instance.blueprintId);
  const superiorPos = position?.reportsToPositionId
    ? db.orgPositions.find((p) => p.id === position.reportsToPositionId)
    : undefined;

  return [
    `Você é o profissional digital operacional "${instance.instanceName}" na plataforma TokenizAi — NettosCorp Enterprise.`,
    blueprint
      ? `IDENTIDADE PROFISSIONAL (Agency Agents ${blueprint.code}): Nome "${blueprint.name}", Arquétipo "${blueprint.archetype}", Personalidade "${blueprint.personality}", Estilo de Comunicação "${blueprint.communicationStyle}", Tomada de Decisão "${blueprint.decisionMakingStyle}".`
      : '',
    blueprint ? `COMPETÊNCIAS: ${blueprint.competencies.join(', ')}. LIMITAÇÕES EXPLÍCITAS: ${blueprint.limitations.join('; ')}.` : '',
    position
      ? `POSIÇÃO ORGANIZACIONAL (Paperclip): Cargo "${position.title}", Departamento "${department?.name ?? 'Geral'}", Nível de Autoridade "${AUTHORITY_LABELS[position.authorityLevel]}", Reporta-se a "${superiorPos?.title ?? 'Direção Executiva'}", Limite de Orçamento R$ ${position.budgetLimitBRL}.`
      : '',
    project
      ? `CONTEXTO DO PROJETO ATIVO: ${project.code} — "${project.name}". Objetivo: ${project.objective}. Requisitos: ${project.requirements.join('; ')}.`
      : '',
    `REGRAS DE CONDUTA: Responda sempre em Português (Brasil), alinhado ao seu cargo e estilo de comunicação. Não invente dados financeiros, commits ou aprovações inexistentes. Quando uma solicitação ultrapassar sua alçada ou orçamento, informe explicitamente e solicite aprovação do gestor (${superiorPos?.title ?? 'Direção Executiva'}). Seja objetivo e acionável.`,
  ]
    .filter(Boolean)
    .join('\n');
}

interface SyncPayload {
  updatedAt: string;
  deviceId: string;
  snapshot: Record<string, unknown>;
}

let inMemorySync: SyncPayload | null = null;
try {
  if (fs.existsSync(SYNC_STORE_PATH)) {
    inMemorySync = JSON.parse(fs.readFileSync(SYNC_STORE_PATH, 'utf-8')) as SyncPayload;
  }
} catch {
  inMemorySync = null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // SSE stream for real-time enterprise events
  app.get('/api/events/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  app.get('/api/health', (_req, res) => {
    const geminiConfigured = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      integrations: {
        gemini: geminiConfigured,
        supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
        paperclip: Boolean(process.env.PAPERCLIP_ENDPOINT),
        githubToken: Boolean(process.env.GITHUB_TOKEN),
      },
    });
  });

  // Authoritative Enterprise State Bootstrap (RBAC-filtered conversations)
  app.get('/api/bootstrap', (req, res) => {
    const role = getCallerRole(req);
    const filteredConversations = db.conversations.filter((c) => c.allowedRoles.includes(role));
    const allowedConvIds = new Set(filteredConversations.map((c) => c.id));
    const filteredMessages = db.messages.filter((m) => allowedConvIds.has(m.conversationId));

    res.json({
      state: {
        ...db,
        conversations: filteredConversations,
        messages: filteredMessages,
      },
      role,
    });
  });

  app.post('/api/state/reset', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canManageAdmin) {
      res.status(403).json({ error: 'Somente Administração ou Direção Executiva pode restaurar a base.' });
      return;
    }
    db = structuredClone(INITIAL_ENTERPRISE_STATE);
    persistDatabase();
    broadcastEvent('state:reset', { timestamp: new Date().toISOString() });
    res.json({ ok: true, state: db });
  });

  // ===========================================================================
  // NATIVE CHAT & AGENT ORCHESTRATION DOMAIN
  // ===========================================================================
  app.post('/api/chat/conversations', (req, res) => {
    const role = getCallerRole(req);
    const body = req.body as {
      kind?: ChatConversation['kind'];
      title?: string;
      subtitle?: string;
      participantIds?: string[];
      projectId?: string;
      departmentId?: string;
      contextRef?: ChatConversation['contextRef'];
    };

    if (!body.title || !body.kind) {
      res.status(400).json({ error: 'Título e tipo de conversa são obrigatórios.' });
      return;
    }

    const pIds = body.participantIds ?? [];
    const participants: ChatConversation['participants'] = [];

    for (const pid of pIds) {
      const person = db.people.find((p) => p.id === pid);
      if (person) {
        participants.push({
          id: person.id,
          kind: 'humano',
          name: person.name,
          roleTitle: person.roleTitle,
          department: person.department,
          avatarUrl: person.avatarUrl,
        });
        continue;
      }
      const inst = db.operationalInstances.find((o) => o.id === pid);
      if (inst) {
        const bp = AGENCY_AGENTS_283.find((a) => a.id === inst.blueprintId);
        const pos = db.orgPositions.find((p) => p.id === inst.positionId);
        participants.push({
          id: inst.id,
          kind: 'agente_operacional',
          name: inst.instanceName,
          roleTitle: pos?.title ?? inst.division,
          department: inst.division,
          color: bp?.color,
          emoji: bp?.emoji,
        });
      }
    }

    const conv: ChatConversation = {
      id: `conv-${Date.now()}`,
      kind: body.kind,
      title: body.title.trim(),
      subtitle: body.subtitle?.trim() || 'Canal operacional TokenizAi',
      participantIds: pIds,
      participants,
      contextRef: body.contextRef,
      projectId: body.projectId,
      departmentId: body.departmentId,
      unreadCount: 0,
      mentionsCount: 0,
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: 'Conversa iniciada.',
      allowedRoles: Array.from(new Set<UserRole>(['direcao_executiva', 'gestor', 'auditoria', role])),
    };

    db.conversations = [conv, ...db.conversations];
    persistDatabase();
    broadcastEvent('chat:conversation_created', conv);
    res.json({ conversation: conv });
  });

  app.post('/api/chat/messages', async (req, res) => {
    const role = getCallerRole(req);
    const { conversationId, content, targetInstanceId, contextRef } = req.body as {
      conversationId?: string;
      content?: string;
      targetInstanceId?: string;
      contextRef?: ChatMessage['contextRef'];
    };

    if (!conversationId || !content?.trim()) {
      res.status(400).json({ error: 'Conversa e conteúdo da mensagem são obrigatórios.' });
      return;
    }

    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv) {
      res.status(404).json({ error: 'Conversa não encontrada.' });
      return;
    }
    if (!conv.allowedRoles.includes(role)) {
      res.status(403).json({ error: 'Seu perfil de acesso não possui permissão nesta conversa.' });
      return;
    }

    const roleDef = ROLE_DEFINITIONS[role];
    const now = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId: conv.id,
      senderId: `role-${role}`,
      senderKind: 'humano',
      senderName: roleDef.label,
      senderRole: AUTHORITY_LABELS[roleDef.authorityLevel],
      content: content.trim(),
      lifecycleStatus: 'delivered',
      createdAt: now,
      contextRef: contextRef ?? conv.contextRef,
    };

    db.messages = [...db.messages, userMsg];
    conv.lastMessageAt = now;
    conv.lastMessagePreview = userMsg.content.slice(0, 120);
    persistDatabase();
    broadcastEvent('chat:message', userMsg);

    // Determine target operational agent instance if direct or explicitly targeted
    let agentInst: OperationalAgentInstance | undefined;
    if (targetInstanceId) {
      agentInst = db.operationalInstances.find((o) => o.id === targetInstanceId);
    } else if (conv.kind === 'direct_agent') {
      agentInst = db.operationalInstances.find((o) => conv.participantIds.includes(o.id));
    } else {
      // Check if an agent participant is mentioned by name with @
      agentInst = db.operationalInstances.find(
        (o) =>
          conv.participantIds.includes(o.id) &&
          content.toLowerCase().includes(o.instanceName.toLowerCase())
      );
    }

    if (!agentInst) {
      res.json({ userMessage: userMsg, agentMessage: null });
      return;
    }

    // Check operational state & budget
    if (agentInst.executionState === 'pausado') {
      const pausedMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        conversationId: conv.id,
        senderId: agentInst.id,
        senderKind: 'agente_operacional',
        senderName: agentInst.instanceName,
        senderRole: agentInst.division,
        content: `Execução recusada: a instância "${agentInst.instanceName}" está pausada nas configurações operacionais.`,
        lifecycleStatus: 'execution_failed',
        createdAt: new Date().toISOString(),
      };
      db.messages = [...db.messages, pausedMsg];
      persistDatabase();
      broadcastEvent('chat:message', pausedMsg);
      res.json({ userMessage: userMsg, agentMessage: pausedMsg });
      return;
    }

    if (agentInst.spentBudgetBRL >= agentInst.monthlyBudgetBRL) {
      const budgetMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        conversationId: conv.id,
        senderId: agentInst.id,
        senderKind: 'agente_operacional',
        senderName: agentInst.instanceName,
        senderRole: agentInst.division,
        content: `Execução bloqueada por orçamento: limite mensal de R$ ${agentInst.monthlyBudgetBRL} atingido. Solicite revisão ao gestor.`,
        lifecycleStatus: 'execution_failed',
        createdAt: new Date().toISOString(),
      };
      db.messages = [...db.messages, budgetMsg];
      persistDatabase();
      broadcastEvent('chat:message', budgetMsg);
      res.json({ userMessage: userMsg, agentMessage: budgetMsg });
      return;
    }

    if (agentInst.adapter === 'paperclip-http-adapter' && !process.env.PAPERCLIP_ENDPOINT) {
      const pendingMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        conversationId: conv.id,
        senderId: agentInst.id,
        senderKind: 'agente_operacional',
        senderName: agentInst.instanceName,
        senderRole: agentInst.division,
        content: `Integração pendente: esta instância está configurada para Paperclip External HTTP Adapter (PAPERCLIP_ENDPOINT não configurado). Altere o adaptador para "gemini-server-native" nas configurações da instância ou configure o endpoint Paperclip.`,
        lifecycleStatus: 'integration_pending',
        createdAt: new Date().toISOString(),
      };
      db.messages = [...db.messages, pendingMsg];
      persistDatabase();
      broadcastEvent('chat:message', pendingMsg);
      res.json({ userMessage: userMsg, agentMessage: pendingMsg });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      const pendingMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        conversationId: conv.id,
        senderId: agentInst.id,
        senderKind: 'agente_operacional',
        senderName: agentInst.instanceName,
        senderRole: agentInst.division,
        content: `Execução indisponível: variável GEMINI_API_KEY não configurada no servidor para executar o adaptador nativo.`,
        lifecycleStatus: 'integration_pending',
        createdAt: new Date().toISOString(),
      };
      db.messages = [...db.messages, pendingMsg];
      persistDatabase();
      broadcastEvent('chat:message', pendingMsg);
      res.json({ userMessage: userMsg, agentMessage: pendingMsg });
      return;
    }

    // Real execution via @google/genai
    const startedAt = new Date().toISOString();
    agentInst.executionState = 'processando';
    broadcastEvent('agent:status', { instanceId: agentInst.id, executionState: 'processando' });

    const position = db.orgPositions.find((p) => p.id === agentInst.positionId);
    const department = db.departments.find((d) => d.id === (position?.departmentId ?? agentInst.departmentId));
    const project = db.projects.find((p) => p.id === (conv.projectId ?? agentInst.projectId));

    const previousMessages = db.messages
      .filter((m) => m.conversationId === conv.id && m.id !== userMsg.id)
      .slice(-12);

    const chatHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const m of previousMessages) {
      const turnRole: 'user' | 'model' = m.senderKind === 'agente_operacional' ? 'model' : 'user';
      const formattedText =
        turnRole === 'user' ? `[${m.senderName} · ${m.senderRole}]: ${m.content}` : m.content;
      const last = chatHistory[chatHistory.length - 1];
      if (last && last.role === turnRole) {
        last.parts[0].text += `\n${formattedText}`;
      } else if (chatHistory.length > 0 || turnRole === 'user') {
        chatHistory.push({ role: turnRole, parts: [{ text: formattedText }] });
      }
    }

    const resolvedModel = agentInst.model || 'gemini-4-hydrogen';

    try {
      const chat = ai.chats.create({
        model: resolvedModel,
        history: chatHistory,
        config: {
          systemInstruction: buildAgentSystemInstruction(agentInst, position, department, project),
        },
      });
      const response = await chat.sendMessage({
        message: userMsg.content,
      });

      const replyText = (response.text ?? '').trim() || 'Solicitação processada sem conteúdo retornado.';
      const finishedAt = new Date().toISOString();
      const historyChars = chatHistory.reduce((acc, item) => acc + item.parts[0].text.length, 0);
      const tokensEst = Math.max(350, Math.round((historyChars + userMsg.content.length + replyText.length) / 3.5));
      const costBRL = Number(((tokensEst / 1000) * 0.45).toFixed(2));

      agentInst.spentBudgetBRL = Number((agentInst.spentBudgetBRL + costBRL).toFixed(2));
      agentInst.executionState = 'ativo_pronto';
      agentInst.lastHeartbeat = finishedAt;

      const session: AgentExecutionSession = {
        id: `sess-${Date.now()}`,
        instanceId: agentInst.id,
        triggeredBy: roleDef.label,
        channelId: conv.id,
        adapterUsed: agentInst.adapter,
        modelUsed: agentInst.model || 'gemini-4-hydrogen',
        status: 'concluida',
        tokensEstimated: tokensEst,
        costBRL,
        summary: `Resposta operacional em "${conv.title}" (${tokensEst} tokens est.)`,
        startedAt,
        finishedAt,
      };
      db.executionSessions = [session, ...db.executionSessions];

      // Feed real runtime cost into Finance Cost Center
      const iaCostCenter = db.costCenters.find((c) => c.id === 'cc-2');
      if (iaCostCenter) {
        iaCostCenter.spent = Number((iaCostCenter.spent + costBRL).toFixed(2));
      }

      const agentMsg: ChatMessage = {
        id: `msg-${Date.now() + 2}`,
        conversationId: conv.id,
        senderId: agentInst.id,
        senderKind: 'agente_operacional',
        senderName: agentInst.instanceName,
        senderRole: position?.title ?? agentInst.division,
        recipientId: userMsg.senderId,
        recipientName: userMsg.senderName,
        content: replyText,
        lifecycleStatus: 'execution_completed',
        createdAt: finishedAt,
        sessionId: session.id,
        modelUsed: agentInst.model || 'gemini-4-hydrogen',
        contextRef: conv.contextRef,
      };

      db.messages = [...db.messages, agentMsg];
      conv.lastMessageAt = finishedAt;
      conv.lastMessagePreview = replyText.slice(0, 120);
      persistDatabase();

      broadcastEvent('agent:status', { instanceId: agentInst.id, executionState: 'ativo_pronto' });
      broadcastEvent('chat:message', agentMsg);
      broadcastEvent('agent:session', session);
      res.json({ userMessage: userMsg, agentMessage: agentMsg, session });
    } catch (err) {
      agentInst.executionState = 'ativo_pronto';
      const failMsg: ChatMessage = {
        id: `msg-${Date.now() + 3}`,
        conversationId: conv.id,
        senderId: agentInst.id,
        senderKind: 'agente_operacional',
        senderName: agentInst.instanceName,
        senderRole: agentInst.division,
        content: `Falha de execução no provedor (${err instanceof Error ? err.message : 'erro desconhecido'}).`,
        lifecycleStatus: 'execution_failed',
        createdAt: new Date().toISOString(),
      };
      db.messages = [...db.messages, failMsg];
      persistDatabase();
      broadcastEvent('chat:message', failMsg);
      res.status(502).json({ error: failMsg.content, userMessage: userMsg, agentMessage: failMsg });
    }
  });

  // Real Inter-Agent Orchestrated Operational Dialogue
  app.post('/api/chat/inter-agent', async (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canOrchestrateInterAgent) {
      res.status(403).json({ error: 'Perfil atual não possui permissão para orquestrar comunicação entre agentes.' });
      return;
    }

    const { sourceInstanceId, targetInstanceId, topic, projectId } = req.body as {
      sourceInstanceId?: string;
      targetInstanceId?: string;
      topic?: string;
      projectId?: string;
    };

    const source = db.operationalInstances.find((o) => o.id === sourceInstanceId);
    const target = db.operationalInstances.find((o) => o.id === targetInstanceId);
    if (!source || !target || source.id === target.id || !topic?.trim()) {
      res.status(400).json({ error: 'Informe dois agentes operacionais distintos e o tópico da interação.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'GEMINI_API_KEY não configurada no servidor para orquestração inter-agentes.' });
      return;
    }

    const srcPos = db.orgPositions.find((p) => p.id === source.positionId);
    const tgtPos = db.orgPositions.find((p) => p.id === target.positionId);
    const srcDept = db.departments.find((d) => d.id === (srcPos?.departmentId ?? source.departmentId));
    const tgtDept = db.departments.find((d) => d.id === (tgtPos?.departmentId ?? target.departmentId));
    const proj = db.projects.find((p) => p.id === (projectId || source.projectId));

    // Find or create inter-agent channel
    let conv = db.conversations.find(
      (c) =>
        c.kind === 'inter_agent' &&
        c.participantIds.includes(source.id) &&
        c.participantIds.includes(target.id)
    );
    if (!conv) {
      conv = {
        id: `conv-ia-${Date.now()}`,
        kind: 'inter_agent',
        title: `${source.instanceName} ↔ ${target.instanceName}`,
        subtitle: `Comunicação operacional inter-agentes · ${proj ? proj.code : 'Corporativo'}`,
        participantIds: [source.id, target.id],
        participants: [
          { id: source.id, kind: 'agente_operacional', name: source.instanceName, roleTitle: srcPos?.title ?? source.division, department: srcDept?.name },
          { id: target.id, kind: 'agente_operacional', name: target.instanceName, roleTitle: tgtPos?.title ?? target.division, department: tgtDept?.name },
        ],
        projectId: proj?.id,
        contextRef: proj ? { kind: 'project', id: proj.id, label: `${proj.code} · ${proj.name}` } : undefined,
        unreadCount: 0,
        mentionsCount: 0,
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: topic.trim(),
        allowedRoles: ['direcao_executiva', 'gestor', 'ia', 'operacoes', 'auditoria'],
      };
      db.conversations = [conv, ...db.conversations];
    }

    try {
      const started = new Date().toISOString();
      // Turn 1: Source agent formulates structured request to Target agent
      const turn1 = await ai.models.generateContent({
        model: source.model || 'gemini-4-hydrogen',
        contents: `Você precisa se comunicar operacionalmente com o colega digital "${target.instanceName}" (${tgtPos?.title ?? target.division}). Redija uma solicitação técnica/operacional direta e estruturada sobre: "${topic.trim()}". Máximo de 110 palavras.`,
        config: { systemInstruction: buildAgentSystemInstruction(source, srcPos, srcDept, proj) },
      });
      const msg1Text = (turn1.text ?? '').trim();
      const msg1: ChatMessage = {
        id: `msg-${Date.now()}-1`,
        conversationId: conv.id,
        senderId: source.id,
        senderKind: 'agente_operacional',
        senderName: source.instanceName,
        senderRole: srcPos?.title ?? source.division,
        recipientId: target.id,
        recipientName: target.instanceName,
        content: msg1Text,
        lifecycleStatus: 'execution_completed',
        createdAt: started,
        modelUsed: source.model || 'gemini-4-hydrogen',
        contextRef: conv.contextRef,
      };

      // Turn 2: Target agent responds respecting its limitations & authority
      const turn2 = await ai.models.generateContent({
        model: target.model || 'gemini-4-hydrogen',
        contents: `Você recebeu a seguinte solicitação de "${source.instanceName}" (${srcPos?.title ?? source.division}):\n"${msg1Text}"\n\nResponda objetivamente dentro das suas responsabilidades e limites de autoridade (máximo 130 palavras). Indique se alguma ação exige aprovação humana.`,
        config: { systemInstruction: buildAgentSystemInstruction(target, tgtPos, tgtDept, proj) },
      });
      const finished = new Date().toISOString();
      const msg2Text = (turn2.text ?? '').trim();
      const msg2: ChatMessage = {
        id: `msg-${Date.now()}-2`,
        conversationId: conv.id,
        senderId: target.id,
        senderKind: 'agente_operacional',
        senderName: target.instanceName,
        senderRole: tgtPos?.title ?? target.division,
        recipientId: source.id,
        recipientName: source.instanceName,
        content: msg2Text,
        lifecycleStatus: 'execution_completed',
        createdAt: finished,
        modelUsed: target.model || 'gemini-4-hydrogen',
        contextRef: conv.contextRef,
      };

      const sess1: AgentExecutionSession = {
        id: `sess-${Date.now()}-a`,
        instanceId: source.id,
        triggeredBy: `Inter-Agente (${ROLE_DEFINITIONS[role].label})`,
        channelId: conv.id,
        adapterUsed: source.adapter,
        modelUsed: source.model || 'gemini-4-hydrogen',
        status: 'concluida',
        tokensEstimated: 980,
        costBRL: 0.45,
        summary: `Solicitação enviada para ${target.instanceName}: ${topic.slice(0, 60)}`,
        startedAt: started,
        finishedAt: started,
      };
      const sess2: AgentExecutionSession = {
        id: `sess-${Date.now()}-b`,
        instanceId: target.id,
        triggeredBy: `Inter-Agente (${source.instanceName})`,
        channelId: conv.id,
        adapterUsed: target.adapter,
        modelUsed: target.model || 'gemini-4-hydrogen',
        status: 'concluida',
        tokensEstimated: 1120,
        costBRL: 0.52,
        summary: `Resposta emitida para ${source.instanceName}`,
        startedAt: started,
        finishedAt: finished,
      };

      source.spentBudgetBRL = Number((source.spentBudgetBRL + sess1.costBRL).toFixed(2));
      target.spentBudgetBRL = Number((target.spentBudgetBRL + sess2.costBRL).toFixed(2));
      db.executionSessions = [sess2, sess1, ...db.executionSessions];
      db.messages = [...db.messages, msg1, msg2];
      conv.lastMessageAt = finished;
      conv.lastMessagePreview = msg2Text.slice(0, 120);

      appendServerAudit(
        `Comunicação inter-agentes: ${source.instanceName} ↔ ${target.instanceName}`,
        `Tópico: ${topic.trim()}`,
        ROLE_DEFINITIONS[role].label,
        AUTHORITY_LABELS[ROLE_DEFINITIONS[role].authorityLevel],
        proj?.id,
        conv.id
      );

      persistDatabase();
      broadcastEvent('chat:conversation_created', conv);
      broadcastEvent('chat:message', msg1);
      broadcastEvent('chat:message', msg2);
      res.json({ conversation: conv, messages: [msg1, msg2] });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Falha na orquestração inter-agentes.' });
    }
  });

  app.post('/api/chat/messages/:id/convert-task', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canEditProjects) {
      res.status(403).json({ error: 'Perfil sem permissão para criar ou delegar tarefas.' });
      return;
    }
    const msg = db.messages.find((m) => m.id === req.params.id);
    if (!msg) {
      res.status(404).json({ error: 'Mensagem não encontrada.' });
      return;
    }
    const { projectId, title, assigneeId, assigneeKind, assigneeName, dueDate, completionCriteria } = req.body as {
      projectId?: string;
      title?: string;
      assigneeId?: string;
      assigneeKind?: 'humano' | 'agente_operacional';
      assigneeName?: string;
      dueDate?: string;
      completionCriteria?: string;
    };

    const conv = db.conversations.find((c) => c.id === msg.conversationId);
    const targetProjectId = projectId || conv?.projectId || db.projects[0]?.id;
    const task: ProjectTask = {
      id: `tsk-${Date.now()}`,
      projectId: targetProjectId,
      title: title?.trim() || msg.content.slice(0, 80),
      description: `Originada da conversa "${conv?.title ?? 'Chat'}": ${msg.content}`,
      assigneeId,
      assigneeName: assigneeName || 'Clara Azevedo',
      assigneeKind: assigneeKind || 'humano',
      delegatedBy: ROLE_DEFINITIONS[role].label,
      status: 'atribuida',
      dueDate: dueDate || new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      priority: 'alta',
      completionCriteria: completionCriteria?.trim() || 'Evidência registrada e validada pelo solicitante.',
      sourceConversationId: msg.conversationId,
      sourceMessageId: msg.id,
    };

    msg.linkedTaskId = task.id;
    db.tasks = [task, ...db.tasks];
    persistDatabase();
    broadcastEvent('task:updated', task);
    res.json({ task });
  });

  // ===========================================================================
  // ORGANIZATIONAL DOMAIN (DYNAMIC DEPARTMENTS & POSITIONS)
  // ===========================================================================
  app.post('/api/org/departments', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canManageOrg) {
      res.status(403).json({ error: 'Permissão insuficiente para criar departamentos.' });
      return;
    }
    const { code, name, description, budgetAllocatedBRL } = req.body as Partial<DepartmentRecord>;
    if (!name?.trim() || !code?.trim()) {
      res.status(400).json({ error: 'Código e nome do departamento são obrigatórios.' });
      return;
    }
    const dept: DepartmentRecord = {
      id: `dept-${Date.now()}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description?.trim() || 'Departamento corporativo NettosCorp.',
      budgetAllocatedBRL: Number(budgetAllocatedBRL) || 50000,
    };
    db.departments = [...db.departments, dept];
    appendServerAudit(
      `Departamento criado: ${dept.code} — ${dept.name}`,
      `Orçamento alocado: R$ ${dept.budgetAllocatedBRL}`,
      ROLE_DEFINITIONS[role].label,
      AUTHORITY_LABELS[ROLE_DEFINITIONS[role].authorityLevel]
    );
    persistDatabase();
    broadcastEvent('org:updated', { departments: db.departments, orgPositions: db.orgPositions });
    res.json({ department: dept });
  });

  app.post('/api/org/positions', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canManageOrg) {
      res.status(403).json({ error: 'Permissão insuficiente para criar posições organizacionais.' });
      return;
    }
    const body = req.body as Partial<OrgPosition>;
    if (!body.title?.trim() || !body.departmentId) {
      res.status(400).json({ error: 'Título do cargo e departamento são obrigatórios.' });
      return;
    }
    const pos: OrgPosition = {
      id: `pos-${Date.now()}`,
      title: body.title.trim(),
      departmentId: body.departmentId,
      reportsToPositionId: body.reportsToPositionId || undefined,
      authorityLevel: body.authorityLevel || 'operacional',
      holderType: body.holderType || 'vago',
      holderId: body.holderId || undefined,
      budgetLimitBRL: Number(body.budgetLimitBRL) || 5000,
      responsibilities: body.responsibilities?.length ? body.responsibilities : ['Execução conforme escopo do departamento'],
      projectIds: body.projectIds ?? [],
      operationalState: body.holderId ? 'ativo' : 'vago',
    };
    db.orgPositions = [...db.orgPositions, pos];
    if (pos.holderType === 'agente_operacional' && pos.holderId) {
      const inst = db.operationalInstances.find((o) => o.id === pos.holderId);
      if (inst) {
        inst.positionId = pos.id;
        inst.departmentId = pos.departmentId;
      }
    }
    persistDatabase();
    broadcastEvent('org:updated', { departments: db.departments, orgPositions: db.orgPositions });
    res.json({ position: pos });
  });

  app.patch('/api/org/positions/:id', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canManageOrg) {
      res.status(403).json({ error: 'Permissão insuficiente para reorganizar hierarquia.' });
      return;
    }
    const pos = db.orgPositions.find((p) => p.id === req.params.id);
    if (!pos) {
      res.status(404).json({ error: 'Posição organizacional não encontrada.' });
      return;
    }
    const patch = req.body as Partial<OrgPosition>;
    if (patch.reportsToPositionId === pos.id) {
      res.status(400).json({ error: 'Uma posição não pode reportar a si mesma.' });
      return;
    }
    Object.assign(pos, patch);
    if (patch.holderType === 'vago') {
      pos.holderId = undefined;
      pos.operationalState = 'vago';
    } else if (patch.holderId) {
      pos.operationalState = 'ativo';
    }
    appendServerAudit(
      `Hierarquia atualizada: ${pos.title}`,
      `Ocupante: ${pos.holderType} (${pos.holderId ?? 'vago'}) · Reports to: ${pos.reportsToPositionId ?? 'Direção'}`,
      ROLE_DEFINITIONS[role].label,
      AUTHORITY_LABELS[ROLE_DEFINITIONS[role].authorityLevel]
    );
    persistDatabase();
    broadcastEvent('org:updated', { departments: db.departments, orgPositions: db.orgPositions });
    res.json({ position: pos });
  });

  // ===========================================================================
  // TASKS & DELEGATION DOMAIN
  // ===========================================================================
  app.post('/api/tasks', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canEditProjects) {
      res.status(403).json({ error: 'Permissão insuficiente para criar tarefas.' });
      return;
    }
    const body = req.body as Partial<ProjectTask>;
    if (!body.title?.trim() || !body.projectId) {
      res.status(400).json({ error: 'Título e projeto são obrigatórios.' });
      return;
    }
    const task: ProjectTask = {
      id: `tsk-${Date.now()}`,
      projectId: body.projectId,
      title: body.title.trim(),
      description: body.description?.trim(),
      assigneeId: body.assigneeId,
      assigneeName: body.assigneeName || 'A definir',
      assigneeKind: body.assigneeKind || 'humano',
      delegatedBy: ROLE_DEFINITIONS[role].label,
      status: body.status || (body.assigneeId ? 'atribuida' : 'planejada'),
      dueDate: body.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      priority: body.priority || 'média',
      completionCriteria: body.completionCriteria?.trim() || 'Validar entrega com evidência objetiva.',
      subtasks: body.subtasks ?? [],
    };
    db.tasks = [task, ...db.tasks];
    persistDatabase();
    broadcastEvent('task:updated', task);
    res.json({ task });
  });

  app.patch('/api/tasks/:id', (req, res) => {
    const task = db.tasks.find((t) => t.id === req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Tarefa não encontrada.' });
      return;
    }
    const patch = req.body as Partial<ProjectTask> & { status?: TaskLifecycleStatus };
    if (patch.status === 'concluida' && !(patch.completionEvidence?.trim() || task.completionEvidence?.trim())) {
      res.status(400).json({
        error: 'A conclusão de uma tarefa exige o registro de evidência objetiva compatível com a entrega.',
      });
      return;
    }
    Object.assign(task, patch);
    persistDatabase();
    broadcastEvent('task:updated', task);
    res.json({ task });
  });

  // ===========================================================================
  // AGENT RUNTIME (PAPERCLIP) & GOVERNANCE & PROJECTS & FINANCE
  // ===========================================================================
  app.post('/api/runtime/agents', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canHomologateAgents) {
      res.status(403).json({ error: 'Somente IA, Gestão ou Direção pode instanciar agentes.' });
      return;
    }
    const body = req.body as {
      blueprintId: string;
      projectId: string;
      positionId?: string;
      guardrailPolicy?: string;
      provider?: OperationalAgentInstance['provider'];
      model?: string;
      adapter?: OperationalAgentInstance['adapter'];
      monthlyBudgetBRL?: number;
      tools?: string[];
    };
    const bp = AGENCY_AGENTS_283.find((a) => a.id === body.blueprintId);
    const proj = db.projects.find((p) => p.id === body.projectId);
    if (!bp || !proj) {
      res.status(400).json({ error: 'Blueprint ou projeto inválido.' });
      return;
    }

    const inst: OperationalAgentInstance = {
      id: `op-${Date.now()}`,
      blueprintId: bp.id,
      blueprintCode: bp.code,
      instanceName: `${proj.code}-${bp.code}-Runtime`,
      division: bp.division,
      positionId: body.positionId,
      projectId: proj.id,
      projectName: proj.name,
      runtimeEngine: body.adapter === 'paperclip-http-adapter' ? 'Paperclip Runtime' : 'TokenizAi Native Orchestrator',
      provider: body.provider || 'Google Gemini',
      model: body.model || 'gemini-4-hydrogen',
      adapter: body.adapter || 'gemini-server-native',
      tools: body.tools?.length ? body.tools : ['task-update', 'project-context-read'],
      permissions: [`read:project-${proj.id}`, 'comment:chat'],
      credentialRef: body.adapter === 'paperclip-http-adapter' ? 'ENV:PAPERCLIP_API_KEY' : 'ENV:GEMINI_API_KEY',
      envRefKeys: ['GEMINI_API_KEY'],
      maxExecutionsPerDay: 100,
      monthlyBudgetBRL: Number(body.monthlyBudgetBRL) || 3000,
      spentBudgetBRL: 0,
      heartbeatIntervalSec: 300,
      executionState: body.adapter === 'paperclip-http-adapter' ? 'aguardando_paperclip' : 'ativo_pronto',
      assignedTasksCount: 0,
      guardrailPolicy: body.guardrailPolicy || 'Revisão humana obrigatória em decisões críticas',
      lastHeartbeat: new Date().toISOString(),
      origin: 'real_local',
    };

    db.operationalInstances = [inst, ...db.operationalInstances];
    proj.operationalInstanceIds = [...proj.operationalInstanceIds, inst.id];

    if (body.positionId) {
      const pos = db.orgPositions.find((p) => p.id === body.positionId);
      if (pos) {
        pos.holderType = 'agente_operacional';
        pos.holderId = inst.id;
        pos.operationalState = 'ativo';
        inst.departmentId = pos.departmentId;
      }
    }

    appendServerAudit(
      `Instância operacional criada: ${inst.instanceName}`,
      `Adaptador: ${inst.adapter} · Modelo: ${inst.model} · Orçamento R$ ${inst.monthlyBudgetBRL}`,
      ROLE_DEFINITIONS[role].label,
      AUTHORITY_LABELS[ROLE_DEFINITIONS[role].authorityLevel],
      proj.id
    );
    persistDatabase();
    res.json({ instance: inst });
  });

  app.patch('/api/runtime/agents/:id', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canManageRuntime) {
      res.status(403).json({ error: 'Perfil sem permissão para configurar runtime operacional.' });
      return;
    }
    const inst = db.operationalInstances.find((o) => o.id === req.params.id);
    if (!inst) {
      res.status(404).json({ error: 'Instância não encontrada.' });
      return;
    }
    const patch = req.body as Partial<OperationalAgentInstance>;
    // Never store raw credentials, only symbolic references
    if (patch.credentialRef && !patch.credentialRef.startsWith('ENV:')) {
      patch.credentialRef = `ENV:${patch.credentialRef.replace(/[^A-Z0-9_]/gi, '_').toUpperCase()}`;
    }
    Object.assign(inst, patch);
    persistDatabase();
    broadcastEvent('agent:status', { instanceId: inst.id, executionState: inst.executionState });
    res.json({ instance: inst });
  });

  app.post('/api/runtime/agents/:id/heartbeat', (req, res) => {
    const role = getCallerRole(req);
    const inst = db.operationalInstances.find((o) => o.id === req.params.id);
    if (!inst) {
      res.status(404).json({ error: 'Instância não encontrada.' });
      return;
    }
    const now = new Date().toISOString();
    const geminiOk = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    const paperclipOk = Boolean(process.env.PAPERCLIP_ENDPOINT);
    const ready = inst.adapter === 'gemini-server-native' ? geminiOk : paperclipOk;

    inst.lastHeartbeat = now;
    inst.executionState = inst.executionState === 'pausado' ? 'pausado' : ready ? 'ativo_pronto' : 'aguardando_paperclip';

    const sess: AgentExecutionSession = {
      id: `sess-hb-${Date.now()}`,
      instanceId: inst.id,
      triggeredBy: `Heartbeat (${ROLE_DEFINITIONS[role].label})`,
      adapterUsed: inst.adapter,
      modelUsed: inst.model,
      status: ready ? 'concluida' : 'integracao_pendente',
      tokensEstimated: 0,
      costBRL: 0,
      summary: ready
        ? `Heartbeat validado com provedor ${inst.provider} ativo.`
        : `Heartbeat registrado; provedor ${inst.adapter} aguardando configuração no servidor.`,
      startedAt: now,
      finishedAt: now,
    };
    db.executionSessions = [sess, ...db.executionSessions];
    persistDatabase();
    res.json({ instance: inst, session: sess });
  });

  app.post('/api/projects', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canEditProjects) {
      res.status(403).json({ error: 'Permissão insuficiente para criar projetos.' });
      return;
    }
    const body = req.body as Omit<EnterpriseProject, 'id' | 'code' | 'updatedAt'>;
    const code = `PRJ-0${db.projects.length + 45}`;
    const proj: EnterpriseProject = {
      ...body,
      id: `proj-${Date.now()}`,
      code,
      nexusGates: body.nexusGates ?? [
        { id: `ng-${Date.now()}-1`, phase: 'Discovery', gateCriteria: 'Objetivo e requisitos confirmados', passed: true },
        { id: `ng-${Date.now()}-2`, phase: 'Architecture', gateCriteria: 'Arquitetura e equipe definida', passed: false },
        { id: `ng-${Date.now()}-3`, phase: 'Execution', gateCriteria: 'Entregas implementadas', passed: false },
        { id: `ng-${Date.now()}-4`, phase: 'Verification', gateCriteria: 'Qualidade & Segurança validadas', passed: false },
        { id: `ng-${Date.now()}-5`, phase: 'Release', gateCriteria: 'Aprovação executiva final', passed: false },
      ],
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    db.projects = [proj, ...db.projects];
    appendServerAudit(
      `Abertura de projeto ${code}: ${proj.name}`,
      `Área: ${proj.area} · ${proj.selectedAgentIds.length} perfis de IA selecionados`,
      ROLE_DEFINITIONS[role].label,
      AUTHORITY_LABELS[ROLE_DEFINITIONS[role].authorityLevel],
      proj.id
    );
    persistDatabase();
    res.json({ project: proj });
  });

  app.patch('/api/projects/:id/nexus-gates/:gateId', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canEditProjects) {
      res.status(403).json({ error: 'Permissão insuficiente para validar gates NEXUS.' });
      return;
    }
    const proj = db.projects.find((p) => p.id === req.params.id);
    const gate = proj?.nexusGates?.find((g) => g.id === req.params.gateId);
    if (!proj || !gate) {
      res.status(404).json({ error: 'Projeto ou gate NEXUS não encontrado.' });
      return;
    }
    gate.passed = Boolean((req.body as { passed?: boolean }).passed);
    gate.verifiedBy = gate.passed ? ROLE_DEFINITIONS[role].label : undefined;
    persistDatabase();
    res.json({ project: proj });
  });

  app.post('/api/finance/entries', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canManageFinance) {
      res.status(403).json({ error: 'Somente perfil Financeiro ou Direção pode registrar lançamentos.' });
      return;
    }
    const body = req.body as Omit<FinancialEntry, 'id' | 'origin'>;
    const entry: FinancialEntry = {
      ...body,
      id: `fin-${Date.now()}`,
      origin: 'real_local',
    };
    db.financialEntries = [entry, ...db.financialEntries];
    appendServerAudit(
      `Lançamento financeiro (${entry.type})`,
      `${entry.title} — R$ ${entry.amount}`,
      ROLE_DEFINITIONS[role].label,
      AUTHORITY_LABELS[ROLE_DEFINITIONS[role].authorityLevel]
    );
    persistDatabase();
    broadcastEvent('finance:updated', entry);
    res.json({ entry });
  });

  app.post('/api/agency/homologation', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canHomologateAgents) {
      res.status(403).json({ error: 'Permissão insuficiente para alterar homologação de perfil.' });
      return;
    }
    const { agentId, status } = req.body as { agentId: string; status: HomologationStatus };
    const ag = AGENCY_AGENTS_283.find((a) => a.id === agentId);
    if (!ag) {
      res.status(404).json({ error: 'Perfil não encontrado na biblioteca.' });
      return;
    }
    db.homologationOverrides[agentId] = status;
    appendServerAudit(
      `Homologação ${ag.code} -> ${status}`,
      `${ag.name} (${ag.division})`,
      ROLE_DEFINITIONS[role].label,
      AUTHORITY_LABELS[ROLE_DEFINITIONS[role].authorityLevel]
    );
    persistDatabase();
    res.json({ agentId, status });
  });

  app.post('/api/agency/compositions', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canEditProjects) {
      res.status(403).json({ error: 'Permissão insuficiente para gravar composição de equipe.' });
      return;
    }
    const body = req.body as Omit<TeamCompositionRecord, 'id' | 'createdAt'>;
    const full: TeamCompositionRecord = {
      ...body,
      id: `cmp-${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    db.compositions = [full, ...db.compositions];
    db.projects = db.projects.map((p) =>
      p.id === body.projectId
        ? { ...p, selectedAgentIds: body.selectedBlueprintIds, updatedAt: new Date().toISOString().slice(0, 10) }
        : p
    );
    appendServerAudit(
      `Composição de equipe aprovada para projeto`,
      `${body.selectedBlueprintIds.length} perfis · Cobertura ${body.coveragePercent}%`,
      ROLE_DEFINITIONS[role].label,
      AUTHORITY_LABELS[ROLE_DEFINITIONS[role].authorityLevel],
      body.projectId
    );
    persistDatabase();
    res.json({ composition: full });
  });

  app.post('/api/governance', (req, res) => {
    const role = getCallerRole(req);
    const body = req.body as {
      type: 'DEC' | 'CNS' | 'DELIB';
      title: string;
      summary: string;
      linkedProjectId?: string;
      linkedConversationId?: string;
    };
    const seq = db.governance.filter((g) => g.type === body.type).length + 45;
    const code = `${body.type}-2026-0${seq}`;
    const rec: GovernanceRecord = {
      id: `gov-${Date.now()}`,
      code,
      type: body.type,
      title: body.title.trim(),
      summary: body.summary.trim(),
      status: ROLE_DEFINITIONS[role].canApproveGovernance ? 'em_deliberacao' : 'pendente',
      authorName: ROLE_DEFINITIONS[role].label,
      authorityRole: AUTHORITY_LABELS[ROLE_DEFINITIONS[role].authorityLevel],
      linkedProjectId: body.linkedProjectId,
      linkedConversationId: body.linkedConversationId,
      createdAt: new Date().toISOString().slice(0, 10),
      auditHash: makeAuditHash(`${code}-${body.title}-${Date.now()}`),
    };
    db.governance = [rec, ...db.governance];
    persistDatabase();
    broadcastEvent('governance:updated', rec);
    res.json({ record: rec });
  });

  app.post('/api/governance/:id/approve', (req, res) => {
    const role = getCallerRole(req);
    if (!ROLE_DEFINITIONS[role].canApproveGovernance) {
      res.status(403).json({ error: 'Alçada insuficiente para aprovar registros de governança.' });
      return;
    }
    const target = db.governance.find((g) => g.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }
    target.status = 'aprovado';
    appendServerAudit(
      `Aprovação registrada: ${target.code}`,
      `${target.title} aprovado por ${ROLE_DEFINITIONS[role].label}`,
      ROLE_DEFINITIONS[role].label,
      AUTHORITY_LABELS[ROLE_DEFINITIONS[role].authorityLevel],
      target.linkedProjectId,
      target.linkedConversationId
    );
    persistDatabase();
    broadcastEvent('governance:updated', target);
    res.json({ record: target });
  });

  // ===========================================================================
  // EXISTING GITHUB, GEMINI AI SCOPING, BRIEF, VOICE & SYNC ROUTES
  // ===========================================================================
  app.post('/api/integrations/github/inspect', async (req, res) => {
    try {
      const { repoInput } = req.body as { repoInput?: string };
      if (!repoInput || typeof repoInput !== 'string') {
        res.status(400).json({ error: 'Informe um repositório no formato owner/repo ou URL do GitHub.' });
        return;
      }

      const cleaned = repoInput
        .trim()
        .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/\/+$/, '');

      const parts = cleaned.split('/').filter(Boolean);
      if (parts.length < 2) {
        res.status(400).json({ error: 'Formato inválido. Utilize owner/repositorio ou URL completa do GitHub.' });
        return;
      }

      const slug = `${parts[0]}/${parts[1]}`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'NettosCorp-Enterprise',
      };
      if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      }

      const repoRes = await fetch(`https://api.github.com/repos/${slug}`, { headers });
      if (!repoRes.ok) {
        const statusMsg =
          repoRes.status === 404
            ? `Repositório "${slug}" não encontrado ou privado sem token configurado.`
            : `Falha ao consultar GitHub (HTTP ${repoRes.status}).`;
        res.status(repoRes.status === 404 ? 404 : 502).json({ error: statusMsg });
        return;
      }

      const repoJson = (await repoRes.json()) as {
        full_name: string;
        description: string | null;
        language: string | null;
        stargazers_count: number;
        open_issues_count: number;
        default_branch: string;
        topics?: string[];
        html_url: string;
        updated_at: string;
        private: boolean;
      };

      let languages: string[] = [];
      try {
        const langRes = await fetch(`https://api.github.com/repos/${slug}/languages`, { headers });
        if (langRes.ok) {
          const langData = (await langRes.json()) as Record<string, number>;
          languages = Object.keys(langData).slice(0, 6);
        }
      } catch {
        languages = repoJson.language ? [repoJson.language] : [];
      }

      let recentCommits: { sha: string; message: string; date: string; author: string }[] = [];
      try {
        const commitsRes = await fetch(`https://api.github.com/repos/${slug}/commits?per_page=4`, { headers });
        if (commitsRes.ok) {
          const commitsData = (await commitsRes.json()) as Array<{
            sha: string;
            commit: { message: string; author: { name: string; date: string } };
          }>;
          recentCommits = commitsData.map((c) => ({
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split('\n')[0],
            date: c.commit.author?.date ?? '',
            author: c.commit.author?.name ?? 'Autor',
          }));
        }
      } catch {
        recentCommits = [];
      }

      res.json({
        fullName: repoJson.full_name,
        description: repoJson.description || 'Sem descrição cadastrada no GitHub.',
        primaryLanguage: repoJson.language || 'Não identificada',
        languages,
        stars: repoJson.stargazers_count,
        openIssues: repoJson.open_issues_count,
        defaultBranch: repoJson.default_branch,
        topics: repoJson.topics ?? [],
        htmlUrl: repoJson.html_url,
        updatedAt: repoJson.updated_at,
        isPrivate: repoJson.private,
        recentCommits,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro interno ao inspecionar repositório.',
      });
    }
  });

  app.post('/api/ai/scope-project', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chave Gemini API não configurada no ambiente do servidor. Utilize o motor determinístico ou configure GEMINI_API_KEY.',
      });
      return;
    }

    try {
      const { brief, githubContext } = req.body as {
        brief?: string;
        githubContext?: Record<string, unknown>;
      };

      const prompt = `Você é o Arquiteto Corporativo da NettosCorp Enterprise (TokenizAi). Analise o contexto abaixo para abertura inteligente de projeto.
Não invente dados financeiros ou prazos irreais. Quando faltar informação crítica, liste objetivamente em "questionsToConfirm" para o gestor confirmar.
Responda em Português (Brasil).

Briefing do usuário: ${brief || 'Não informado'}
Contexto do repositório GitHub: ${githubContext ? JSON.stringify(githubContext) : 'Nenhum repositório informado'}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedTitle: { type: Type.STRING },
              objective: { type: Type.STRING },
              area: { type: Type.STRING },
              detectedArchitecture: { type: Type.STRING },
              keyRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendedCompetencies: { type: Type.ARRAY, items: { type: Type.STRING } },
              risks: { type: Type.ARRAY, items: { type: Type.STRING } },
              questionsToConfirm: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'suggestedTitle',
              'objective',
              'area',
              'detectedArchitecture',
              'keyRequirements',
              'recommendedCompetencies',
              'risks',
              'questionsToConfirm',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ analysis: parsed, model: 'gemini-4-hydrogen' });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Erro ao consultar modelo Gemini.',
      });
    }
  });

  app.post('/api/ai/executive-brief', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chave Gemini API não configurada no servidor. Configure GEMINI_API_KEY para gerar análises preditivas com IA.',
      });
      return;
    }

    try {
      const { summary } = req.body as { summary?: Record<string, unknown> };
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Você é o conselheiro estratégico executivo da NettosCorp Enterprise — TokenizAi. Analise o snapshot corporativo abaixo (observando claramente quais dados são demonstrativos) e produza:
1) Síntese da situação atual em 2 frases diretas;
2) Principais riscos ou gargalos operacionais;
3) 3 decisões prioritárias recomendadas para a diretoria.
Responda em JSON.

Snapshot: ${JSON.stringify(summary ?? {})}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              risksAndBottlenecks: { type: Type.ARRAY, items: { type: Type.STRING } },
              priorityActions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['executiveSummary', 'risksAndBottlenecks', 'priorityActions'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ brief: parsed, model: 'gemini-4-hydrogen' });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Erro ao gerar síntese executiva.',
      });
    }
  });

  app.post('/api/ai/voice-intent', async (req, res) => {
    const { transcript } = req.body as { transcript?: string };
    if (!transcript?.trim()) {
      res.status(400).json({ error: 'Transcrição de voz vazia.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API não configurada para interpretação semântica de voz.',
      });
      return;
    }

    try {
      const projectCatalog = db.projects.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        area: p.area,
      }));
      const response = await generateWithRetry(ai, {
        model: 'gemini-4-hydrogen',
        contents: `Converta o comando em linguagem natural abaixo em uma intenção estruturada para a plataforma NettosCorp Enterprise — TokenizAi.
Módulos válidos: executive, chat, finance, commercial, customers, marketing, products, projects, software-factory, intelligence-factory, operations, agency-library, team-composer, operational-agents, people, governance, admin.
Ações válidas: navigate, open_project, new_project, open_chat, search_agents, team_composer, toggle_theme.

Projetos existentes no portfólio:
${JSON.stringify(projectCatalog)}

Regras:
- Se o usuário pedir para abrir um projeto específico (ex: "Abrir projeto Meridian", "Ver PRJ-042"), use action="open_project", moduleId="projects" e preencha projectId com o "id" exato do projeto correspondente.
- Se pedir para compor equipe de um projeto, use action="team_composer", moduleId="team-composer" e preencha projectId se identificável.
- Se pedir para abrir chat/mensagens de um projeto, use action="open_chat", moduleId="chat" e preencha projectId se identificável.
- Se pedir para criar um projeto novo, use action="new_project" e moduleId="projects".
- Se pedir para buscar agentes ou perfis (ex: AppSec, QA, RAG), use action="search_agents", moduleId="agency-library" e preencha query com o termo buscado.

Comando do usuário: "${transcript.trim()}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING },
              moduleId: { type: Type.STRING },
              projectId: { type: Type.STRING },
              query: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['action', 'explanation'],
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ intent: parsed, model: 'gemini-4-hydrogen' });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Falha na interpretação de voz.',
      });
    }
  });

  app.post('/api/ai/chatbot', async (req, res) => {
    const role = getCallerRole(req);
    const {
      message,
      history = [],
      personaId = 'executive_advisor',
      customSystemInstruction,
      speedMode = 'balanced',
      activeModule = 'executive',
    } = req.body as {
      message?: string;
      history?: Array<{ role: 'user' | 'model'; text: string }>;
      personaId?: string;
      customSystemInstruction?: string;
      speedMode?: 'balanced' | 'fast';
      activeModule?: string;
    };

    const cleanMessage = message?.trim();
    if (!cleanMessage) {
      res.status(400).json({ error: 'A mensagem do chatbot não pode estar vazia.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY não configurada no servidor para executar o chatbot Gemini.',
      });
      return;
    }

    const model = speedMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

    const rolePrompts: Record<string, string> = {
      executive_advisor:
        'Você é o Conselheiro Executivo da NettosCorp Enterprise (TokenizAi). Atue com visão estratégica C-Level: sintetize riscos de portfólio, priorize entregas, identifique gargalos entre setores e apoie decisões DEC/CNS com clareza objetiva.',
      finance_controller:
        'Você é o Controller & Especialista FP&A da NettosCorp Enterprise. Analise receitas, despesas, margens, centros de custo, orçamento de agentes de IA e impacto financeiro de projetos com rigor numérico em BRL.',
      tech_architect:
        'Você é o Arquiteto Principal de Software & Inteligência Artificial da NettosCorp. Recomende arquiteturas modulares, pipelines RAG/agentes, boas práticas de segurança AppSec e composições com o acervo de 283 Agency Agents.',
      operations_lead:
        'Você é o Líder de Operações & Entregas da NettosCorp. Ajude a destravar tarefas atrasadas, organizar gates NEXUS, distribuir carga entre humanos e agentes Paperclip e definir critérios objetivos de conclusão.',
      custom:
        customSystemInstruction?.trim() ||
        'Você é um assistente corporativo versátil da NettosCorp Enterprise. Responda em Português (Brasil) de forma clara, estruturada e acionável.',
    };

    const baseRoleInstruction =
      (customSystemInstruction?.trim() && personaId === 'custom'
        ? customSystemInstruction.trim()
        : rolePrompts[personaId] ?? rolePrompts.executive_advisor) +
      (customSystemInstruction?.trim() && personaId !== 'custom'
        ? `\n\nDiretriz adicional do usuário:\n${customSystemInstruction.trim()}`
        : '');

    const totalRevenue = db.financialEntries
      .filter((f) => f.type === 'receita')
      .reduce((acc, f) => acc + f.amount, 0);
    const totalExpenses = db.financialEntries
      .filter((f) => f.type === 'despesa')
      .reduce((acc, f) => acc + f.amount, 0);
    const pendingGov = db.governance.filter((g) => g.status === 'pendente').length;
    const todayIso = new Date().toISOString().slice(0, 10);
    const blockedOrOverdueTasks = db.tasks.filter(
      (t) =>
        t.status === 'bloqueada' ||
        (t.dueDate < todayIso && t.status !== 'concluida' && t.status !== 'cancelada')
    ).length;

    const enterpriseContext = [
      `Contexto atual da empresa NettosCorp Enterprise:`,
      `- Perfil RBAC do usuário conectado: ${ROLE_DEFINITIONS[role].label} (${AUTHORITY_LABELS[ROLE_DEFINITIONS[role].authorityLevel]}).`,
      `- Módulo em foco na interface: ${activeModule}.`,
      `- Portfólio ativo: ${db.projects.length} projetos (${db.projects.map((p) => `${p.code} ${p.name} [${p.status}, ${p.progress}%]`).slice(0, 5).join('; ')}).`,
      `- Força de agentes operacionais: ${db.operationalInstances.length} instâncias ativas; Tarefas bloqueadas/atrasadas: ${blockedOrOverdueTasks}; Deliberações pendentes: ${pendingGov}.`,
      `- Financeiro consolidado: Receitas R$ ${totalRevenue.toLocaleString('pt-BR')} vs. Despesas R$ ${totalExpenses.toLocaleString('pt-BR')}.`,
      `Responda sempre em Português (Brasil), mantendo continuidade com o histórico da conversa e sem inventar registros que não existam.`,
    ].join('\n');

    const systemInstruction = `${baseRoleInstruction}\n\n${enterpriseContext}`;

    const normalizedHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const item of history.slice(-20)) {
      const text = item?.text?.trim();
      if (!text) continue;
      const turnRole: 'user' | 'model' = item.role === 'model' ? 'model' : 'user';
      const last = normalizedHistory[normalizedHistory.length - 1];
      if (last && last.role === turnRole) {
        last.parts[0].text += `\n${text}`;
      } else if (normalizedHistory.length > 0 || turnRole === 'user') {
        normalizedHistory.push({ role: turnRole, parts: [{ text }] });
      }
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const writeEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const chat = ai.chats.create({
        model,
        history: normalizedHistory,
        config: {
          systemInstruction,
        },
      });

      const stream = await chat.sendMessageStream({
        message: cleanMessage,
      });

      for await (const chunk of stream) {
        const delta = chunk.text ?? '';
        if (delta) {
          writeEvent({ chunk: delta });
        }
      }

      writeEvent({ done: true, model });
      res.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na comunicação com o Gemini.';
      writeEvent({ error: msg });
      res.end();
    }
  });

  app.get('/api/sync/state', (_req, res) => {
    res.json({
      hasSnapshot: Boolean(inMemorySync),
      updatedAt: inMemorySync?.updatedAt ?? null,
      deviceId: inMemorySync?.deviceId ?? null,
      snapshot: inMemorySync?.snapshot ?? null,
    });
  });

  app.post('/api/sync/state', (req, res) => {
    try {
      const { deviceId, snapshot } = req.body as {
        deviceId?: string;
        snapshot?: Record<string, unknown>;
      };
      if (!snapshot || typeof snapshot !== 'object') {
        res.status(400).json({ error: 'Payload de sincronização inválido.' });
        return;
      }
      const payload: SyncPayload = {
        updatedAt: new Date().toISOString(),
        deviceId: deviceId || 'web-client',
        snapshot,
      };
      inMemorySync = payload;
      try {
        fs.writeFileSync(SYNC_STORE_PATH, JSON.stringify(payload), 'utf-8');
      } catch {
        // Non-fatal
      }
      res.json({ ok: true, updatedAt: payload.updatedAt });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao sincronizar estado.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TokenizAi — NettosCorp Enterprise listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
