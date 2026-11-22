import React, { useState } from 'react';
import { GitBranch, RefreshCw } from 'lucide-react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { GitHubAdapter, type GitHubRepoInspection } from '../../services/adapters';
import type { EnterpriseState, ModuleId } from '../../types/enterprise';

interface SoftwareFactoryModuleProps {
  state: EnterpriseState;
  onNavigate: (moduleId: ModuleId) => void;
}

export const SoftwareFactoryModule: React.FC<SoftwareFactoryModuleProps> = ({ state, onNavigate }) => {
  const [repoSlugInput, setRepoSlugInput] = useState('vitejs/vite');
  const [inspection, setInspection] = useState<GitHubRepoInspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await GitHubAdapter.inspectRepo(repoSlugInput);
      setInspection(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao consultar GitHub.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <DataOriginNotice
        sourceLabel="Operação de engenharia de software; repositórios corporativos aguardando token GitHub para dados privados"
        pendingIntegration="GitHub Actions Webhooks & Sonar/CI"
        onConfigureIntegration={onNavigate}
      />

      {/* Live GitHub Inspector */}
      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Inspeção Direta de Repositório GitHub</h2>
            <p className="text-xs text-ink-subtle">
              Consulte metadados reais, linguagens e commits recentes sem duplicar informações no banco
            </p>
          </div>
          <form onSubmit={handleInspect} className="flex items-center gap-2">
            <input
              type="text"
              value={repoSlugInput}
              onChange={(e) => setRepoSlugInput(e.target.value)}
              placeholder="owner/repo"
              className="px-3 py-1.5 text-xs font-mono rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Inspecionar
            </button>
          </form>
        </div>

        {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}

        {inspection && (
          <div className="p-4 rounded-xl border border-line bg-canvas space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-accent" />
                <a
                  href={inspection.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono font-semibold text-sm text-ink hover:underline"
                >
                  {inspection.fullName}
                </a>
              </div>
              <span className="font-mono text-ink-subtle tabular-nums">
                {inspection.primaryLanguage} · {inspection.stars} stars · {inspection.openIssues} issues abertas
              </span>
            </div>
            <p className="text-ink-muted">{inspection.description}</p>
            {inspection.recentCommits.length > 0 && (
              <div className="pt-2 border-t border-line space-y-1">
                <p className="font-semibold text-ink-subtle">Commits recentes (API GitHub em tempo real)</p>
                {inspection.recentCommits.map((c) => (
                  <div key={c.sha} className="flex items-center justify-between gap-2 text-ink-muted">
                    <span className="truncate">
                      <code className="font-mono text-accent mr-2">{c.sha}</code>
                      {c.message}
                    </span>
                    <span className="shrink-0 text-ink-subtle">{c.author}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Repositories & Deployments */}
      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <h3 className="text-sm font-semibold text-ink">Repositórios & Esteiras de Entrega</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-subtle">
                <th className="py-2.5 pr-4 font-medium">Repositório / Stack</th>
                <th className="py-2.5 px-3 font-medium">Projeto</th>
                <th className="py-2.5 px-3 font-medium">Branch</th>
                <th className="py-2.5 px-3 text-right font-medium">Cobertura Testes</th>
                <th className="py-2.5 pl-3 text-right font-medium">Último Deploy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {state.repos.map((rep) => {
                const proj = state.projects.find((p) => p.id === rep.projectId);
                return (
                  <tr key={rep.id} className="hover:bg-surface-subtle/50">
                    <td className="py-3 pr-4">
                      <p className="font-mono text-xs font-semibold text-ink">{rep.slug}</p>
                      <p className="text-xs text-ink-subtle">{rep.stack}</p>
                    </td>
                    <td className="py-3 px-3 text-xs text-ink-muted">{proj ? `${proj.code} · ${proj.name}` : '—'}</td>
                    <td className="py-3 px-3 font-mono text-xs text-ink-muted">{rep.branch}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-ink">
                      {rep.testCoverage}%
                    </td>
                    <td className="py-3 pl-3 text-right text-xs">
                      <span
                        className={
                          rep.lastDeployStatus === 'sucesso'
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-red-600 dark:text-red-400 font-medium'
                        }
                      >
                        {rep.lastDeployStatus === 'sucesso' ? 'Sucesso' : 'Falha CI'}
                      </span>
                      <p className="font-mono text-[11px] text-ink-subtle tabular-nums">{rep.lastDeployAt}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
