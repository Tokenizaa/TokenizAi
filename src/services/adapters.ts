import type { CalendarCommitment } from '../types/enterprise';

export interface GitHubRepoInspection {
  fullName: string;
  description: string;
  primaryLanguage: string;
  languages: string[];
  stars: number;
  openIssues: number;
  defaultBranch: string;
  topics: string[];
  htmlUrl: string;
  updatedAt: string;
  isPrivate: boolean;
  recentCommits: Array<{ sha: string; message: string; date: string; author: string }>;
}

export interface ProjectAIScopingResult {
  suggestedTitle: string;
  objective: string;
  area: string;
  detectedArchitecture: string;
  keyRequirements: string[];
  recommendedCompetencies: string[];
  risks: string[];
  questionsToConfirm: string[];
}

export interface ExecutiveAIBrief {
  executiveSummary: string;
  risksAndBottlenecks: string[];
  priorityActions: string[];
}

export interface ServerHealthStatus {
  status: string;
  timestamp: string;
  integrations: {
    gemini: boolean;
    supabase: boolean;
    paperclip: boolean;
    githubToken: boolean;
  };
}

export const GitHubAdapter = {
  async inspectRepo(repoInput: string): Promise<GitHubRepoInspection> {
    const res = await fetch('/api/integrations/github/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao consultar repositório no GitHub.');
    }
    return data as GitHubRepoInspection;
  },
};

export const AIAdapter = {
  async scopeProject(
    brief: string,
    githubContext?: GitHubRepoInspection | null
  ): Promise<{ analysis: ProjectAIScopingResult; model: string }> {
    const res = await fetch('/api/ai/scope-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief, githubContext }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Serviço de IA indisponível no momento.');
    }
    return data as { analysis: ProjectAIScopingResult; model: string };
  },

  async generateExecutiveBrief(
    summary: Record<string, unknown>
  ): Promise<{ brief: ExecutiveAIBrief; model: string }> {
    const res = await fetch('/api/ai/executive-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao gerar análise executiva via Gemini.');
    }
    return data as { brief: ExecutiveAIBrief; model: string };
  },

  async parseVoiceIntent(transcript: string): Promise<{
    action: string;
    moduleId?: string;
    query?: string;
    explanation: string;
  }> {
    const res = await fetch('/api/ai/voice-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao interpretar comando de voz.');
    }
    return data.intent;
  },
};

export const SystemSyncAdapter = {
  async fetchHealth(): Promise<ServerHealthStatus> {
    const res = await fetch('/api/health');
    if (!res.ok) {
      throw new Error('Servidor indisponível.');
    }
    return res.json() as Promise<ServerHealthStatus>;
  },

  async pushState(deviceId: string, snapshot: Record<string, unknown>): Promise<{ ok: boolean; updatedAt: string }> {
    const res = await fetch('/api/sync/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, snapshot }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao sincronizar com servidor.');
    }
    return data as { ok: boolean; updatedAt: string };
  },

  async pullState(): Promise<{ hasSnapshot: boolean; updatedAt: string | null; snapshot: Record<string, unknown> | null }> {
    const res = await fetch('/api/sync/state');
    if (!res.ok) {
      throw new Error('Falha ao buscar estado remoto.');
    }
    return res.json();
  },
};

export const CalendarAdapter = {
  downloadICS(commitment: CalendarCommitment): void {
    const start = new Date(commitment.dateISO);
    const end = new Date(start.getTime() + commitment.durationMinutes * 60000);

    const toICSDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NettosCorp Enterprise//Agenda Corporativa//PT-BR',
      'BEGIN:VEVENT',
      `UID:${commitment.id}@nettoscorp.enterprise`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${commitment.title}`,
      `DESCRIPTION:Categoria: ${commitment.category} | Participantes: ${commitment.participants}`,
      `LOCATION:${commitment.location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${commitment.id}-${commitment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
