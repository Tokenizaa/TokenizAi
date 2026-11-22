import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RollbackManager } from '../src/rollback-manager';

function agenteMarkdown(slug: string, version: string, body: string): string {
  return `---\nname: ${slug}\nversion: ${version}\ndivision: engineering\n---\n\n${body}\n`;
}

async function criarBaseline(
  dir: string,
  arquivos: Record<string, { version: string; body: string }>,
): Promise<void> {
  for (const [rel, { version, body }] of Object.entries(arquivos)) {
    const full = join(dir, rel);
    await mkdir(join(dir, ...rel.split('/').slice(0, -1)), { recursive: true });
    await writeFile(full, agenteMarkdown(rel.replace(/\.md$/, ''), version, body), 'utf8');
  }
}

async function lerArquivoSeguro(dir: string, rel: string): Promise<string | null> {
  try {
    return await readFile(join(dir, rel), 'utf8');
  } catch {
    return null;
  }
}

describe('rollback-manager — one-click rollback do corpus-baseline (Fase 6)', () => {
  let baselineDir: string;
  let snapshotsDir: string;
  let manager: RollbackManager;

  beforeEach(async () => {
    baselineDir = await mkdtemp(join(tmpdir(), 'catalog-sync-baseline-'));
    snapshotsDir = await mkdtemp(join(tmpdir(), 'catalog-sync-snapshots-'));
    manager = new RollbackManager({ baselineDir, snapshotsDir });
  });

  afterEach(async () => {
    await rm(baselineDir, { recursive: true, force: true });
    await rm(snapshotsDir, { recursive: true, force: true });
  });

  it('cria snapshot antes da mutação e restaura o baseline via one-click rollback', async () => {
    // Setup via mock: corpus-baseline com 3 agentes (sem rede, sem API externa)
    await criarBaseline(baselineDir, {
      'engineering/agente-a.md': { version: '1.0.0', body: 'conteudo A v1' },
      'engineering/agente-b.md': { version: '2.0.0', body: 'conteudo B v2' },
      'suporte/agente-c.md': { version: '1.1.0', body: 'conteudo C v1' },
    });

    // 1. Snapshot imutável antes de qualquer mutação (garantia de rollback)
    const snapshot = await manager.snapshot('pre-sync-v1');
    expect(snapshot.label).toBe('pre-sync-v1');
    expect(snapshot.agentCount).toBe(3);
    expect(snapshot.corpusSha).toHaveLength(64);
    expect(snapshot.snapshotDir).toContain(snapshotsDir);

    // Integridade do snapshot válida antes do rollback (assert via saída do gerente)
    const antes = await manager.validarIntegridade(snapshot.id);
    expect(antes.valid).toBe(true);
    expect(antes.agentCount).toBe(3);
    expect(antes.corpusSha).toBe(snapshot.corpusSha);

    // 2. Simula um sync ruim: atualiza agente-a, remove agente-c, insere agente-d indevido
    await writeFile(
      join(baselineDir, 'engineering/agente-a.md'),
      agenteMarkdown('agente-a', '1.0.1', 'conteudo A v2 corrompido'),
      'utf8',
    );
    await rm(join(baselineDir, 'suporte/agente-c.md'), { force: true });
    await mkdir(join(baselineDir, 'engineering'), { recursive: true });
    await writeFile(
      join(baselineDir, 'engineering/agente-d.md'),
      agenteMarkdown('agente-d', '9.9.9', 'agente indevido'),
      'utf8',
    );

    // 3. One-click rollback pelo id do snapshot
    const resultado = await manager.reverterParaVersao(snapshot.id);
    expect(resultado.restoredTo.id).toBe(snapshot.id);
    expect(resultado.restoredTo.label).toBe('pre-sync-v1');
    expect(resultado.restoredTo.agentCount).toBe(3);
    expect(resultado.previousBaselineMovedTo).toBeTruthy();
    expect(resultado.previousBaselineMovedTo).toContain('_rollback-stash-');

    // 4. Baseline restaurado ao conteúdo do snapshot (assert via estado do disco)
    const conteudoA = await lerArquivoSeguro(baselineDir, 'engineering/agente-a.md');
    expect(conteudoA).toContain('conteudo A v1');
    expect(conteudoA).not.toContain('corrompido');

    const conteudoC = await lerArquivoSeguro(baselineDir, 'suporte/agente-c.md');
    expect(conteudoC).toContain('conteudo C v1');

    const conteudoD = await lerArquivoSeguro(baselineDir, 'engineering/agente-d.md');
    expect(conteudoD).toBeNull(); // agente indevido removido pelo rollback

    // Um novo snapshot após o rollback continua íntegro (sistema funcional pós-reversão)
    const apos = await manager.snapshot('post-rollback');
    const integridade = await manager.validarIntegridade(apos.id);
    expect(integridade.valid).toBe(true);
    expect(integridade.agentCount).toBe(3);
  });

  it('rollback por label também restaura o snapshot correto', async () => {
    await criarBaseline(baselineDir, {
      'engineering/agente-x.md': { version: '1.0.0', body: 'estado original' },
    });
    const snapshot = await manager.snapshot('versao-conhecida-boa');

    await writeFile(
      join(baselineDir, 'engineering/agente-x.md'),
      agenteMarkdown('agente-x', '2.0.0', 'estado alterado'),
      'utf8',
    );

    const resultado = await manager.reverterParaVersao('versao-conhecida-boa');
    expect(resultado.restoredTo.id).toBe(snapshot.id);
    expect(resultado.restoredTo.label).toBe('versao-conhecida-boa');

    const conteudo = await lerArquivoSeguro(baselineDir, 'engineering/agente-x.md');
    expect(conteudo).toContain('estado original');
    expect(conteudo).not.toContain('estado alterado');
  });

  it('reverterParaVersao lança erro quando o snapshot não existe', async () => {
    await manager.snapshot('existe');

    let erro: Error | null = null;
    try {
      await manager.reverterParaVersao('nao-existe');
    } catch (e) {
      erro = e as Error;
    }
    expect(erro).toBeInstanceOf(Error);
    expect(erro!.message).toContain('snapshot não encontrado');
    expect(erro!.message).toContain('Disponíveis');
  });

  it('é estável em 10 execuções consecutivas (cada uma com diretórios limpos)', async () => {
    for (let i = 0; i < 10; i++) {
      await criarBaseline(baselineDir, {
        'engineering/agente-a.md': { version: '1.0.0', body: `versao ${i}` },
      });
      const snapshot = await manager.snapshot(`snap-${i}`);
      await writeFile(
        join(baselineDir, 'engineering/agente-a.md'),
        agenteMarkdown('agente-a', '9.9.9', 'estado ruim'),
        'utf8',
      );

      const resultado = await manager.reverterParaVersao(snapshot.id);
      expect(resultado.restoredTo.id).toBe(snapshot.id);
      expect(resultado.previousBaselineMovedTo).toContain('_rollback-stash-');

      const integridade = await manager.validarIntegridade(snapshot.id);
      expect(integridade.valid).toBe(true);
      expect(integridade.corpusSha).toBe(snapshot.corpusSha);
    }
  });

  it('lista versões anteriores contendo os snapshots criados', async () => {
    await criarBaseline(baselineDir, {
      'engineering/agente-a.md': { version: '1.0.0', body: 'a' },
    });
    const s1 = await manager.snapshot('primeiro');
    const s2 = await manager.snapshot('segundo');

    const versoes = await manager.listarVersoesAnteriores();
    const ids = versoes.map((s) => s.id).sort();
    expect(ids).toContain(s1.id);
    expect(ids).toContain(s2.id);
    expect(versoes.find((s) => s.id === s2.id)!.label).toBe('segundo');
  });
});
