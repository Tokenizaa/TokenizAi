import { describe, it, expect } from 'vitest';
import { definePlugin, PluginDefinitionError } from '../../src/index';

describe('exemplo-plugin (definePlugin)', () => {
  it('normaliza ganchos ausentes e valida campos obrigatorios', () => {
    const plugin = definePlugin({ name: 'exemplo-plugin', version: '1.0.0' });
    expect(plugin.manifest.name).toBe('exemplo-plugin');
    expect(plugin.manifest.version).toBe('1.0.0');
    expect(typeof plugin.hooks.setup).toBe('function');
    expect(typeof plugin.hooks.teardown).toBe('function');
    expect(Array.isArray(plugin.hooks.subscriptions)).toBe(true);
    expect(plugin.hooks.subscriptions).toEqual([]);
  });

  it('aceita descricao opcional', () => {
    const plugin = definePlugin({
      name: 'exemplo-plugin',
      version: '1.0.0',
      description: 'um plugin de exemplo',
    });
    expect(plugin.manifest.description).toBe('um plugin de exemplo');
  });

  it('rejeita nome vazio com mensagem açãoavel', () => {
    expect(() => definePlugin({ name: '', version: '1.0.0' })).toThrow(PluginDefinitionError);
    expect(() => definePlugin({ name: '', version: '1.0.0' }).toThrow?.()).toBeTruthy();
    try {
      definePlugin({ name: '', version: '1.0.0' });
    } catch (error) {
      expect((error as Error).message).toContain('nome do plugin e obrigatorio');
      expect((error as Error).message).toContain('Ex:');
    }
  });

  it('rejeita nome com espacos/maiusculas com correcao sugerida', () => {
    try {
      definePlugin({ name: 'Meu Plugin!', version: '1.0.0' });
    } catch (error) {
      const msg = (error as Error).message;
      expect(msg).toContain('invalido');
      expect(msg).toContain('minusculas');
    }
  });

  it('rejeita versao fora do formato semantico com correcao sugerida', () => {
    try {
      definePlugin({ name: 'exemplo-plugin', version: 'v1' });
    } catch (error) {
      const msg = (error as Error).message;
      expect(msg).toContain('versao');
      expect(msg).toContain('1.0.0');
    }
  });
});
