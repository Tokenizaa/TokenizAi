/**
 * @nettoscorp/agent-hire/src/paperclip-client
 *
 * Cliente da API do Paperclip para criação de instâncias operacionais de agentes
 * (Fase 7 — Agent Hire Flow).
 *
 * O Paperclip expõe uma API REST para gerenciamento de agentes:
 *   POST /api/agents — cria uma instância de agente operacional
 *
 * O corpo segue o contrato AgentConfigurationDocument do @paperclipai/shared:
 *   {
 *     apiVersion: 'paperclip/v1',
 *     kind: 'Agent',
 *     spec: { name, role, title, icon, appearance, reportsTo, capabilities,
 *             adapterType, adapterConfig, runtimeConfig, defaultEnvironmentId,
 *             budgetMonthlyCents, metadata }
 *   }
 *
 * Autenticação: Bearer token com PAPERCLIP_API_KEY.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL;
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY;

export interface PaperclipAgentSpec {
  name: string;
  role?: string;
  title?: string | null;
  icon?: string | null;
  appearance?: Record<string, unknown>;
  reportsTo?: string | null;
  capabilities?: string | null;
  adapterType: string;
  adapterConfig?: Record<string, unknown>;
  runtimeConfig?: Record<string, unknown>;
  defaultEnvironmentId?: string | null;
  budgetMonthlyCents?: number;
  metadata?: Record<string, unknown> | null;
}

export interface PaperclipAgentConfig {
  apiVersion: 'paperclip/v1';
  kind: 'Agent';
  spec: PaperclipAgentSpec;
}

export interface PaperclipAgentResponse {
  id: string;
  slug: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaperclipClientOptions {
  baseUrl?: string;
  apiKey?: string;
}

export class PaperclipClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: PaperclipClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.PAPERCLIP_API_URL ?? '').replace(/\/$/, '');
    this.apiKey = options.apiKey ?? process.env.PAPERCLIP_API_KEY ?? '';

    if (!this.baseUrl) {
      throw new Error('PAPERCLIP_API_URL não configurada');
    }
    if (!this.apiKey) {
      throw new Error('PAPERCLIP_API_KEY não configurada');
    }
  }

  /**
   * Cria uma instância de agente operacional no Paperclip.
   *
   * Lança PaperclipClientError em caso de falha (rede, validação, auth).
   */
  async hireAgent(spec: PaperclipAgentSpec): Promise<PaperclipAgentResponse> {
    const config: PaperclipAgentConfig = {
      apiVersion: 'paperclip/v1',
      kind: 'Agent',
      spec,
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'X-Paperclip-Client': '@nettoscorp/agent-hire',
        },
        body: JSON.stringify(config),
      });
    } catch (err) {
      throw new PaperclipClientError(
        'network_error',
        `Não foi possível conectar ao Paperclip: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let body: unknown;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    if (!response.ok) {
      const errorMsg =
        body && typeof body === 'object' && 'message' in body
          ? (body as { message: string }).message
          : `HTTP ${response.status}`;
      throw new PaperclipClientError(
        `paperclip_${response.status}`,
        `Paperclip rejeitou a contratação: ${errorMsg}`,
      );
    }

    return this.mapAgentResponse(body as Record<string, unknown>);
  }

  /**
   * Verifica se o Paperclip está disponível (health check leve).
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'X-Paperclip-Client': '@nettoscorp/agent-hire',
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private mapAgentResponse(raw: Record<string, unknown>): PaperclipAgentResponse {
    return {
      id: String(raw.id ?? ''),
      slug: String(raw.slug ?? ''),
      name: String(raw.name ?? ''),
      role: String(raw.role ?? ''),
      status: String(raw.status ?? 'created'),
      createdAt: String(raw.createdAt ?? new Date().toISOString()),
      updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
    };
  }
}

export class PaperclipClientError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'PaperclipClientError';
    this.code = code;
  }
}

/**
 * Valida que a configuração de contratação atende aos requisitos mínimos do
 * Paperclip antes de tentar criar a instância. Lança PaperclipClientError
 * se algo estiver ausente ou inválido.
 */
export function validateHireSpec(spec: PaperclipAgentSpec): void {
  if (!spec.name || spec.name.trim().length === 0) {
    throw new PaperclipClientError('invalid_spec', 'O campo "name" é obrigatório na especificação do agente');
  }
  if (!spec.adapterType || spec.adapterType.trim().length === 0) {
    throw new PaperclipClientError('invalid_spec', 'O campo "adapterType" é obrigatório na especificação do agente');
  }
}

/**
 * Converte um NettoscorpFrontmatter + divisão para um PaperclipAgentSpec.
 * Aplica least privilege: permissões derivadas do módulo, orçamento por autoridade.
 */
export function buildPaperclipSpec(
  slug: string,
  role: string,
  department: string,
  clearance: string,
  authority: string,
  knowledgeDomains: string[],
  module: string,
  defaultTools: string[],
  instructions?: string,
  budgetMonthlyCents?: number,
): PaperclipAgentSpec {
  return {
    name: slug,
    role,
    title: `${role} — ${department}`,
    icon: null,
    appearance: {
      theme: 'default',
      accentColor: '#3B82F6',
      knowledgeDomains,
      clearance,
      authority,
    },
    reportsTo: null,
    capabilities: null,
    adapterType: 'paperclip_runner',
    adapterConfig: {
      provider: 'codex',
      agentConfig: {
        tools: defaultTools,
        department,
        clearance,
        authority,
        knowledgeDomains,
        module,
      },
      env: {
        NETTOSCORP_ROLE: role,
        NETTOSCORP_DEPARTMENT: department,
        NETTOSCORP_CLEARANCE: clearance,
        NETTOSCORP_AUTHORITY: authority,
      },
    },
    runtimeConfig: {
      aiConnection: null,
      debug: undefined,
    },
    defaultEnvironmentId: null,
    budgetMonthlyCents,
    metadata: {
      source: '@nettoscorp/agent-hire',
      slug,
      module,
      knowledgeDomains,
      clearance,
      authority,
      ...(instructions ? { instructions } : {}),
    },
  };
}

/**
 * Verifica se duas strings são iguais usando comparação em tempo constante
 * (prevenção de timing attack em comparações de chave de API).
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}
