import { describe, it, expect } from 'vitest';
import {
  diffAgents,
  classificarAgente,
  gerarDiffReport,
  type DiffResult,
} from '../src/diff-engine';

function shaMap(entries: [string, string][]): Map<string, string> {
  return new Map(entries);
}

const LOCAL = shaMap([
  ['agente-engineering', 'aaa1111111111111111111111111111111111111111111111111111111111111111'],
  ['agente-suporte', 'bbb22222222222222222222222222222222222222222222222222222222222222'],
  ['agente-legacy', 'ccc3333333333333333333333333333333333333333333333333333333333333333'],
]);

const UPSTREAM = shaMap([
  ['agente-engineering', 'aaa1111111111111111111111111111111111111111111111111111111111111111'], // inalterado
  ['agente-suporte', 'bbb99999999999999999999999999999999999999999999999999999999999999'], // atualizado
  ['agente-novo', 'ddd44444444444444444444444444444444444444444444444444444444444444'], // novo
]);

describe('sync-diff — diff determinístico por SHA (Fase 6)', () => {
  it('classifica novo / atualizado / removido / inalterado apenas pelo SHA', () => {
    const diff: DiffResult = diffAgents(LOCAL, UPSTREAM);

    expect(diff.summary.added).toBe(1);
    expect(diff.summary.modified).toBe(1);
    expect(diff.summary.deleted).toBe(1);
    expect(diff.summary.unchanged).toBe(1);
    expect(diff.summary.totalLocal).toBe(3);
    expect(diff.summary.totalUpstream).toBe(3);

    expect(diff.new.map((e) => e.slug)).toEqual(['agente-novo']);
    expect(diff.updated.map((e) => e.slug)).toEqual(['agente-suporte']);
    expect(diff.removed.map((e) => e.slug)).toEqual(['agente-legacy']);
    expect(diff.unchanged.map((e) => e.slug)).toEqual(['agente-engineering']);

    // Antes e depois preenchidos com o SHA respectivo (fingerprint)
    expect(diff.updated[0].before?.sha).toBe('bbb22222222222222222222222222222222222222222222222222222222222222');
    expect(diff.updated[0].after?.sha).toBe('bbb99999999999999999999999999999999999999999999999999999999999999');
  });

  it('releaseSha é determinístico: mesma fingerprint produz o mesmo SHA', () => {
    const primeiro: DiffResult = diffAgents(LOCAL, UPSTREAM);
    const segundo: DiffResult = diffAgents(LOCAL, UPSTREAM);

    expect(primeiro.releaseSha).toBe(segundo.releaseSha);
    expect(primeiro.releaseSha).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(primeiro.releaseSha)).toBe(true);
  });

  it('releaseSha muda quando o upstream muda (fingerprint sensível aSHA)', () => {
    const base: DiffResult = diffAgents(LOCAL, UPSTREAM);
    const comExtra: DiffResult = diffAgents(
      LOCAL,
      shaMap([...UPSTREAM.entries(), ['agente-extra', 'eee5555555555555555555555555555555555555555555555555555555555555555']]),
    );

    expect(comExtra.releaseSha).not.toBe(base.releaseSha);
    expect(comExtra.summary.added).toBe(2);
  });

  it('entradas de cada classificação são ordenadas por slug (saída reproduzível)', () => {
    const diff: DiffResult = diffAgents(LOCAL, UPSTREAM);

    for (const lista of [diff.new, diff.updated, diff.removed, diff.unchanged]) {
      const slugs = lista.map((e) => e.slug);
      expect(slugs).toEqual([...slugs].sort());
    }
  });

  it('relatório de diff espelha as classificações e contagens do engine', () => {
    const diff: DiffResult = diffAgents(LOCAL, UPSTREAM);
    const report = gerarDiffReport(diff);

    expect(report.releaseSha).toBe(diff.releaseSha);
    expect(report.byClassification.novo).toEqual(['agente-novo']);
    expect(report.byClassification.atualizado).toEqual(['agente-suporte']);
    expect(report.byClassification.removido).toEqual(['agente-legacy']);
    expect(report.byClassification.inalterado).toEqual(['agente-engineering']);

    expect(report.summary).toContain('novos:            1');
    expect(report.summary).toContain('atualizados:      1');
    expect(report.summary).toContain('removidos:        1');
    expect(report.summary).toContain('inalterados:      1');
  });

  it('é estável em 10 execuções consecutivas (zero flake, sem sleep)', () => {
    const primeiro: DiffResult = diffAgents(LOCAL, UPSTREAM);

    for (let i = 0; i < 10; i++) {
      const execucao: DiffResult = diffAgents(LOCAL, UPSTREAM);
      expect(execucao.releaseSha).toBe(primeiro.releaseSha);
      expect(execucao.summary).toEqual(primeiro.summary);
      expect(execucao.new.map((e) => e.slug)).toEqual(primeiro.new.map((e) => e.slug));
      expect(execucao.updated.map((e) => e.slug)).toEqual(primeiro.updated.map((e) => e.slug));
      expect(execucao.removed.map((e) => e.slug)).toEqual(primeiro.removed.map((e) => e.slug));
      expect(execucao.unchanged.map((e) => e.slug)).toEqual(primeiro.unchanged.map((e) => e.slug));
    }
  });

  it('mapas vazios produzem diff vazio e determinístico', () => {
    const diff: DiffResult = diffAgents(new Map(), new Map());

    expect(diff.summary).toEqual({
      totalLocal: 0,
      totalUpstream: 0,
      added: 0,
      modified: 0,
      deleted: 0,
      unchanged: 0,
    });
    expect(diff.new).toEqual([]);
    expect(diff.updated).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toEqual([]);
    expect(diff.releaseSha).toHaveLength(64);
  });
});

describe('classificarAgente — unidade de classificação por SHA', () => {
  it.each([
    [null, 'abc123', 'novo'],
    ['abc123', null, 'removido'],
    ['abc123', 'def456', 'atualizado'],
    ['abc123', 'abc123', 'inalterado'],
  ])('classifica before=%s after=%s como %s', (before, after, esperado) => {
    expect(classificarAgente(before, after)).toBe(esperado);
  });
});
