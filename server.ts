import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const PORT = 3000;
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

interface SyncPayload {
  updatedAt: string;
  deviceId: string;
  snapshot: Record<string, unknown>;
}

let inMemorySync: SyncPayload | null = null;

try {
  if (fs.existsSync(SYNC_STORE_PATH)) {
    const raw = fs.readFileSync(SYNC_STORE_PATH, 'utf-8');
    inMemorySync = JSON.parse(raw) as SyncPayload;
  }
} catch {
  inMemorySync = null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

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

      const prompt = `Você é o Arquiteto Corporativo da NettosCorp Enterprise. Analise o contexto abaixo para abertura inteligente de projeto.
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
              area: {
                type: Type.STRING,
                description: 'Uma das áreas: Engenharia de Software, Inteligência Artificial, Produto & UX, Operações, Comercial, Marketing, Governança',
              },
              detectedArchitecture: { type: Type.STRING },
              keyRequirements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendedCompetencies: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              risks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              questionsToConfirm: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
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
        contents: `Você é o conselheiro estratégico executivo da NettosCorp Enterprise. Analise o snapshot corporativo abaixo (observando claramente quais dados são demonstrativos) e produza:
1) Síntese da situação atual em 2 frases diretas;
2) Principais riscos ou gargalos operacionais;
3) 3 decisões prioritárias recomendadas para a diretoria.
Seja objetivo, sem jargões vazios. Responda em JSON.

Snapshot: ${JSON.stringify(summary ?? {})}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              risksAndBottlenecks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              priorityActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
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
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API não configurada para interpretação semântica de voz.',
      });
      return;
    }

    try {
      const { transcript } = req.body as { transcript?: string };
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Converta o comando de voz abaixo em uma intenção estruturada para a plataforma NettosCorp Enterprise.
Módulos válidos: executive, finance, commercial, customers, marketing, products, projects, software-factory, intelligence-factory, operations, agency-library, team-composer, operational-agents, people, governance, admin.
Ações válidas: navigate, new_project, search_agents, toggle_theme.

Comando: "${transcript || ''}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING },
              moduleId: { type: Type.STRING },
              query: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['action', 'explanation'],
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ intent: parsed });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Falha na interpretação de voz.',
      });
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
        // Non-fatal in ephemeral containers
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
    console.log(`NettosCorp Enterprise server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
