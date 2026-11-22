#!/usr/bin/env tsx
/**
 * @nettoscorp/plugin-sdk — CLI de desenvolvimento de plugins (dev-cli)
 *
 * Comandos:
 *   plugin-sdk plugin dev  <dir>   inicia servidor de dev (watch + recarregamento)
 *   plugin-sdk plugin build <dir>  empacota o plugin para producao (esbuild/Vite)
 *   plugin-sdk plugin test  <dir>  executa o harness de testes (vitest)
 *
 * Principios de DX (Developer Tooling Engineer):
 *  - todo comando tem --help que ensina o uso com exemplos reais
 *  - erros nomeiam a causa E a correcao; stack trace so com --verbose
 *  - saida dual: tabela/cores num TTY; texto simples e JSON quando pipeado
 *  - codigos de saida sao API: 0 ok, 1 erro generico, 2 uso invalido, 3 plugin invalido/nao encontrado
 *  - inicializacao rapida: importacao preguiçosa de Vite/vitest; esbuild no caminho critico
 */

import { build as esbuildBuild } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createHttpServer } from 'node:http';

// ---------------------------------------------------------------------------
// Constantes e saida dual (TTY vs pipe)
// ---------------------------------------------------------------------------

export const VERSION = '2.0.0';

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_USAGE = 2;
export const EXIT_PLUGIN = 3;

type Color = 'reset' | 'bold' | 'red' | 'green' | 'yellow' | 'cyan' | 'gray';

const ANSI: Record<Color, string> = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

interface Output {
  json: boolean;
  color: boolean;
  quiet: boolean;
  verbose: boolean;
}

function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
}

function createOutput(opts: {
  json?: boolean;
  noColor?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}): Output {
  const color = opts.noColor ? false : supportsColor() && !opts.json;
  return {
    json: !!opts.json,
    color,
    quiet: !!opts.quiet,
    verbose: !!opts.verbose,
  };
}

function colorize(c: Color, text: string, out: Output): string {
  return out.color ? `${ANSI[c]}${text}${ANSI.reset}` : text;
}

function bold(text: string, out: Output): string {
  return colorize('bold', text, out);
}

function outLog(out: Output, ...parts: unknown[]): void {
  if (out.quiet || out.json) return;
  process.stdout.write(parts.map(String).join(' ') + '\n');
}

function outInfo(out: Output, ...parts: unknown[]): void {
  if (out.quiet || out.json) return;
  process.stdout.write(colorize('cyan', '>', out) + ' ' + parts.map(String).join(' ') + '\n');
}

function outOk(out: Output, ...parts: unknown[]): void {
  if (out.quiet || out.json) return;
  process.stdout.write(colorize('green', '✔', out) + ' ' + parts.map(String).join(' ') + '\n');
}

function outWarn(out: Output, ...parts: unknown[]): void {
  if (out.quiet || out.json) return;
  process.stderr.write(colorize('yellow', '!', out) + ' ' + parts.map(String).join(' ') + '\n');
}

// ---------------------------------------------------------------------------
// Erros açãoeis (nomeiam a causa e a correcao)
// ---------------------------------------------------------------------------

export class CliError extends Error {
  constructor(public code: number, public message: string, public fix?: string) {
    super(message);
    this.name = 'CliError';
  }
}

function pluginError(dir: string, hint: string): CliError {
  return new CliError(
    EXIT_PLUGIN,
    `Plugin invalido ou nao encontrado em '${dir}'.`,
    hint,
  );
}

function notFoundError(what: string, fix: string): CliError {
  return new CliError(EXIT_PLUGIN, `${what} nao encontrado.`, fix);
}

// ---------------------------------------------------------------------------
// Parsing de argumentos (sem dependencias externas: inicializacao rapida)
// ---------------------------------------------------------------------------

const GLOBAL_FLAGS = new Set([
  'help',
  'version',
  'verbose',
  'quiet',
  'json',
  'no-color',
  'dry-run',
  'color',
]);

const FLAG_ALIASES: Record<string, string> = {
  h: 'help',
  v: 'verbose',
  q: 'quiet',
};

interface ParsedArgs {
  command: string | null;
  subcommand: string | null;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=', 2);
      const name = FLAG_ALIASES[key] ?? key;
      if (value === undefined) {
        // booleano, a menos que o prox item seja um valor nao-flag para flags que aceitam valor
        flags[name] = true;
      } else {
        flags[name] = value;
      }
      i++;
      continue;
    }
    if (arg.startsWith('-') && arg.length > 1) {
      // agrupamento de flags curtas: -vq -> verbose + quiet
      for (let j = 1; j < arg.length; j++) {
        const short = arg[j];
        const name = FLAG_ALIASES[short] ?? short;
        flags[name] = true;
      }
      i++;
      continue;
    }
    positional.push(arg);
    i++;
  }
  return {
    command: positional[0] ?? null,
    subcommand: positional[1] ?? null,
    positional: positional.slice(positional[0] ? (positional[1] ? 2 : 1) : 0),
    flags,
  };
}

function flagString(flags: Record<string, string | boolean>, name: string): string | undefined {
  const v = flags[name];
  return v === true || v === undefined ? undefined : String(v);
}

function flagBool(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] === true;
}

// ---------------------------------------------------------------------------
// Resolucao do ponto de entrada de um plugin
// ---------------------------------------------------------------------------

const ENTRY_CANDIDATES = ['plugin.ts', 'index.ts', 'src/plugin.ts', 'src/index.ts'];

function resolvePluginDir(rawDir: string, out: Output): string {
  const dir = path.resolve(rawDir);
  if (!fs.existsSync(dir)) {
    throw notFoundError(
      `Diretorio '${rawDir}'`,
      `Informe um diretorio valido que contenha o plugin, ex: plugin-sdk plugin build ./meu-plugin`,
    );
  }
  if (!fs.statSync(dir).isDirectory()) {
    throw notFoundError(
      `'${rawDir}' nao e um diretorio`,
      `Informe o caminho de um diretorio de plugin, nao de um arquivo.`,
    );
  }
  return dir;
}

function resolveEntry(dir: string): string | null {
  for (const candidate of ENTRY_CANDIDATES) {
    const full = path.join(dir, candidate);
    if (fs.existsSync(full)) return full;
  }
  // tente ler package.json main/exports
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const main = pkg.main || pkg.exports?.['.']?.import || pkg.exports?.['.'];
      if (typeof main === 'string') {
        const full = path.join(dir, main);
        if (fs.existsSync(full)) return full;
      }
    } catch {
      // ignora package.json invalido; o erro sera reportado no build/dev
    }
  }
  return null;
}

function describeEntry(dir: string): string {
  for (const candidate of ENTRY_CANDIDATES) {
    if (fs.existsSync(path.join(dir, candidate))) return candidate;
  }
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.main) return `package.json main: ${pkg.main}`;
    } catch {
      /* ignore */
    }
  }
  return 'nenhum ponto de entrada (plugin.ts / index.ts / src/plugin.ts)';
}

// ---------------------------------------------------------------------------
// Ajuda (a documentacao que os usuarios realmente leem)
// ---------------------------------------------------------------------------

function helpRoot(out: Output): string {
  const lines: string[] = [];
  lines.push(bold('@nettoscorp/plugin-sdk — CLI de desenvolvimento de plugins', out));
  lines.push(`versao ${VERSION}\n`);
  lines.push(bold('Uso:', out));
  lines.push(`  plugin-sdk <comando> [argumentos] [opcoes]\n`);
  lines.push(bold('Comandos:', out));
  lines.push(`  ${colorize('cyan', 'plugin dev', out)}  <dir>  [opcoes]  inicia o servidor de dev do plugin (watch + recarregamento)`);
  lines.push(`  ${colorize('cyan', 'plugin build', out)} <dir>  [opcoes]  empacota o plugin para producao (esbuild por padrao)`);
  lines.push(`  ${colorize('cyan', 'plugin test', out)}  <dir>  [opcoes]  executa o harness de testes do plugin (vitest)`);
  lines.push(`  ${colorize('cyan', 'plugin', out)                      lista os comandos de plugin disponiveis\n`);
  lines.push(bold('Opcoes globais (valem para todos os comandos):', out));
  lines.push(`  -h, --help          mostra esta ajuda`);
  lines.push(`  --version           mostra a versao do CLI`);
  lines.push(`  -v, --verbose       saida detalhada (inclui stack traces em erros)`);
  lines.push(`  -q, --quiet         apenas erros`);
  lines.push(`  --json              saida maquina-legivel (JSON, sem cores)`);
  lines.push(`  --no-color          forca saida sem cores`);
  lines.push(`  --dry-run           mostra o que faria, sem executar nada\n`);
  lines.push(bold('Exemplos:', out));
  lines.push(`  plugin-sdk plugin dev ./meu-plugin --port 5173`);
  lines.push(`  plugin-sdk plugin build ./meu-plugin --out ./dist --minify`);
  lines.push(`  plugin-sdk plugin test ./meu-plugin --json`);
  lines.push('');
  lines.push(`Ajuda especifica: plugin-sdk plugin dev --help`);
  return lines.join('\n');
}

function helpPlugin(out: Output): string {
  const lines: string[] = [];
  lines.push(bold('plugin-sdk plugin — gerenciamento de plugins', out));
  lines.push(`\nUso: plugin-sdk plugin <comando> [argumentos] [opcoes]\n`);
  lines.push(bold('Comandos:', out));
  lines.push(`  ${colorize('cyan', 'dev', out)   <dir>   servidor de dev com watch e recarregamento`);
  lines.push(`  ${colorize('cyan', 'build', out)<dir>   empacotamento para producao`);
  lines.push(`  ${colorize('cyan', 'test', out) <dir>   execucao de testes (vitest)`);
  lines.push(`\nRode plugin-sdk plugin <comando> --help para detalhes de cada comando.\n`);
  return lines.join('\n');
}

function helpDev(out: Output): string {
  const lines: string[] = [];
  lines.push(bold('plugin-sdk plugin dev — servidor de dev do plugin', out));
  lines.push(`\nInicia um servidor de desenvolvimento para o plugin em <dir>, com`);
  lines.push(`reconstrucao automatica ao salvar arquivos (watch) e recarregamento.`);
  lines.push(`\nUso: plugin-sdk plugin dev <dir> [opcoes]\n`);
  lines.push(bold('Argumentos:', out));
  lines.push(`  <dir>   diretorio do plugin (padrao: .)`);
  lines.push(bold('Opcoes:', out));
  lines.push(`  --port <n>      porta do servidor (padrao: 5173)`);
  lines.push(`  --host <h>      endereco do servidor (padrao: localhost)`);
  lines.push(`  --bundler <b>   bundler: esbuild (padrao) | vite`);
  lines.push(`  --dry-run       mostra o que faria, sem iniciar o servidor`);
  lines.push(`\nExemplos:`);
  lines.push(`  plugin-sdk plugin dev ./meu-plugin`);
  lines.push(`  plugin-sdk plugin dev ./meu-plugin --port 3000 --bundler vite`);
  lines.push(`\nSaida: em um TTY exibe uma tabela de status; pipeado ou com --json exibe JSON.\n`);
  return lines.join('\n');
}

function helpBuild(out: Output): string {
  const lines: string[] = [];
  lines.push(bold('plugin-sdk plugin build — empacotamento para producao', out));
  lines.push(`\nEmpacota o plugin de <dir> em um unico arquivo ja pronto para o host carregar.`);
  lines.push(`Usa esbuild por padrao (inicializacao rapida, sem configuracao).\n`);
  lines.push(`Uso: plugin-sdk plugin build <dir> [opcoes]\n`);
  lines.push(bold('Argumentos:', out));
  lines.push(`  <dir>   diretorio do plugin (padrao: .)`);
  lines.push(bold('Opcoes:', out));
  lines.push(`  --out <dir>     diretorio de saida (padrao: ./dist)`);
  lines.push(`  --format <f>    formato do bundle: esm (padrao) | iife`);
  lines.push(`  --minify        minifica o bundle`);
  lines.push(`  --bundler <b>   bundler: esbuild (padrao) | vite`);
  lines.push(`  --dry-run       mostra o que faria, sem gravar arquivos`);
  lines.push(`\nExemplos:`);
  lines.push(`  plugin-sdk plugin build ./meu-plugin`);
  lines.push(`  plugin-sdk plugin build ./meu-plugin --out ./dist --minify --format iife`);
  lines.push(`\nSaida: em um TTY exibe uma tabela com arquivo, tamanho e tempo;`);
  lines.push(`pipeado ou com --json exibe JSON maquina-legivel.\n`);
  return lines.join('\n');
}

function helpTest(out: Output): string {
  const lines: string[] = [];
  lines.push(bold('plugin-sdk plugin test — harness de testes do plugin', out));
  lines.push(`\nExecuta os testes do plugin em <dir> com vitest.`);
  lines.push(`Procura arquivos *.test.ts (ou *.test.js) no diretorio.\n`);
  lines.push(`Uso: plugin-sdk plugin test <dir> [opcoes]\n`);
  lines.push(bold('Argumentos:', out));
  lines.push(`  <dir>   diretorio do plugin (padrao: .)`);
  lines.push(bold('Opcoes:', out));
  lines.push(`  --watch   executa vitest em modo observacao (nao encerra)`);
  lines.push(`  --run     executa uma vez e encerra (padrao)`);
  lines.push(`\nExemplos:`);
  lines.push(`  plugin-sdk plugin test ./meu-plugin`);
  lines.push(`  plugin-sdk plugin test ./meu-plugin --json`);
  lines.push(`\nO codigo de saida e o mesmo do vitest (0 = todos passaram).\n`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Bundler: esbuild (caminho critico — rapido, sem configuracao)
// ---------------------------------------------------------------------------

interface BundleResult {
  entry: string;
  outFile: string;
  format: string;
  size: number;
  durationMs: number;
}

async function bundleWithEsbuild({
  entry,
  outFile,
  format,
  minify,
  out,
}: {
  entry: string;
  outFile: string;
  format: 'esm' | 'iife';
  minify: boolean;
  out: Output;
}): Promise<BundleResult> {
  const start = Date.now();
  await esbuildBuild({
    entryPoints: [entry],
    outfile: outFile,
    format,
    bundle: true,
    minify,
    sourcemap: true,
    platform: 'neutral',
    target: 'es2022',
    logLevel: 'silent',
    packages: 'external',
  });
  const stat = fs.statSync(outFile);
  return { entry, outFile, format, size: stat.size, durationMs: Date.now() - start };
}

async function bundleWithVite({
  entry,
  outFile,
  format,
  minify,
  out,
}: {
  entry: string;
  outFile: string;
  format: 'esm' | 'iife';
  minify: boolean;
  out: Output;
}): Promise<BundleResult> {
  // Vite e importado preguiçosamente apenas quando solicitado, para nao
  // encarecer a inicializacao de `plugin build`/`plugin test`.
  const { build: viteBuild } = await import('vite');
  const start = Date.now();
  const root = path.dirname(entry);
  // Vite gera em root/dist por default; copiamos/renomeamos para outFile.
  await viteBuild({
    root,
    base: '',
    build: {
      outDir: '.vite-build-tmp',
      emptyOutDir: true,
      minify,
      target: 'es2022',
      write: true,
      // entrada unica via lib mode
      lib: {
        entry,
        name: path.basename(root),
        formats: [format === 'iife' ? 'iife' : 'es'],
        fileName: () => 'plugin.js',
      },
      rollupOptions: {
        external: [], // sem externalizacao forcada; plugin auto-contido
      },
    },
    plugins: [],
  } as any);
  const tmp = path.join(root, '.vite-build-tmp', 'plugin.js');
  if (!fs.existsSync(tmp)) {
    // tenta achar qualquer plugin.js gerado
    const matches = findFiles(root, '.vite-build-tmp', 'plugin.js');
    if (matches.length) tmp = matches[0];
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.copyFileSync(tmp, outFile);
  // limpa temporario
  try { fs.rmSync(path.join(root, '.vite-build-tmp'), { recursive: true, force: true }); } catch {}
  const stat = fs.statSync(outFile);
  return { entry, outFile, format, size: stat.size, durationMs: Date.now() - start };
}

function findFiles(root: string, sub: string, name: string): string[] {
  const dir = path.join(root, sub);
  if (!fs.existsSync(dir)) return [];
  let results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { recursive: true } as any)) {
      if (entry === name) results.push(path.join(dir, entry));
    }
  } catch {}
  return results;
}

// ---------------------------------------------------------------------------
// Servidor de dev simples (esbuild sob demanda) — fallback quando nao ha Vite
// ---------------------------------------------------------------------------

interface DevServer {
  start(port: number, host: string): Promise<void>;
  stop(): Promise<void>;
  url(): string;
}

async function createEsbuildDevServer({
  entry,
  port,
  host,
  out,
}: {
  entry: string;
  port: number;
  host: string;
  out: Output;
}): Promise<DevServer> {
  let watcher: fs.FSWatcher | null = null;
  let server: ReturnType<typeof createHttpServer> | null = null;
  let currentUrl = '';

  const buildOnce = async () => {
    const start = Date.now();
    try {
      await esbuildBuild({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        platform: 'neutral',
        target: 'es2022',
        logLevel: 'silent',
        packages: 'external',
        write: false,
      });
      outOk(out, `plugin recarregado em ${Date.now() - start}ms`);
    } catch (error) {
      outWarn(out, `falha ao recarregar plugin: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  server = createHttpServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    if (url === '/' || url === '/plugin.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' });
      // esbuild serve um bundle em memoria (sem write). Para simplicidade, re-empacota por requisicao.
      esbuildBuild({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        platform: 'neutral',
        target: 'es2022',
        logLevel: 'silent',
        packages: 'external',
        write: false,
      }).then((result) => {
        res.end(result.outputFiles?.[0]?.text ?? '// plugin vazio');
      }).catch((error) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Erro ao empacotar plugin: ${error instanceof Error ? error.message : String(error)}`);
      });
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  return {
    start: async (listenPort: number, listenHost: string) => {
      await new Promise<void>((resolve, reject) => {
        (server as ReturnType<typeof createHttpServer>).listen(listenPort, listenHost, (err?: Error | null) => {
          if (err) return reject(err);
          currentUrl = `http://${listenHost}:${listenPort}`;
          resolve();
        });
      });
      // watch: reconstrui ao mudar arquivos do plugin
      const dir = path.dirname(entry);
      watcher = fs.watch(dir, { recursive: true }, () => {
        void buildOnce();
      });
      outOk(out, `servidor de dev rodando em ${currentUrl}`);
      outInfo(out, `ponto de entrada: ${entry}`);
    },
    stop: async () => {
      if (watcher) watcher.close();
      if (server) {
        await new Promise<void>((resolve) => (server as ReturnType<typeof createHttpServer>).close(() => resolve()));
      }
    },
    url: () => currentUrl,
  };
}

async function createViteDevServer({
  root,
  port,
  host,
  out,
}: {
  root: string;
  port: number;
  host: string;
  out: Output;
}): Promise<DevServer> {
  const { createServer: createViteServer } = await import('vite');
  let server: any = null;
  let currentUrl = '';

  server = await createViteServer({
    root,
    server: { port, host, open: false },
    logLevel: 'info',
  });
  await server.listen();
  const addr = server.server.address();
  const portNum = typeof addr === 'object' && addr ? addr.port : port;
  currentUrl = `http://${host}:${portNum}`;
  outOk(out, `servidor de dev (Vite) rodando em ${currentUrl}`);
  outInfo(out, `raiz: ${root}`);

  return {
    start: async () => {}, // ja iniciado
    stop: async () => { await server.close(); },
    url: () => currentUrl,
  };
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

async function cmdDev(positional: string[], flags: Record<string, string | boolean>, out: Output): Promise<number> {
  const rawDir = positional[0] ?? '.';
  const dir = resolvePluginDir(rawDir, out);
  const entry = resolveEntry(dir);
  if (!entry) {
    throw pluginError(dir, `Adicione um ponto de entrada (${ENTRY_CANDIDATES.join(', ')}) ou configure 'main' no package.json do plugin.`);
  }

  const port = Number(flagString(flags, 'port') ?? '5173');
  const host = String(flagString(flags, 'host') ?? 'localhost');
  const bundler = String(flagString(flags, 'bundler') ?? 'esbuild');
  const dryRun = flagBool(flags, 'dry-run');

  if (out.json) {
    process.stdout.write(JSON.stringify({
      command: 'plugin dev',
      dir,
      entry,
      port,
      host,
      bundler,
      dryRun,
    }) + '\n');
  } else {
    outLog(out, bold('plugin dev', out), '->', dir);
    outLog(out, `  entrada: ${entry}`);
    outLog(out, `  bundler: ${bundler}  porta: ${port}`);
  }

  if (dryRun) {
    outOk(out, 'dry-run: servidor nao iniciado.');
    return EXIT_OK;
  }

  let server: DevServer;
  if (bundler === 'vite') {
    try {
      server = await createViteDevServer({ root: dir, port, host, out });
    } catch (error) {
      // Vite nao disponivel ou falhou: fallback transparente para esbuild
      outWarn(out, `Vite indisponivel (${error instanceof Error ? error.message : String(error)}); usando esbuild.`);
      server = await createEsbuildDevServer({ entry, port, host, out });
    }
  } else {
    server = await createEsbuildDevServer({ entry, port, host, out });
  }

  await server.start(port, host);

  // encerra limpo em SIGINT/SIGTERM
  const signals = ['SIGINT', 'SIGTERM'] as const;
  let stopped = false;
  for (const sig of signals) {
    process.on(sig, async () => {
      if (stopped) return;
      stopped = true;
      outLog(out, `\nencerrando servidor de dev...`);
      await server.stop();
      process.exit(EXIT_OK);
    });
  }

  // mantem o processo vivo ate sinal
  return new Promise(() => {
    // servidor de dev roda indefinidamente; resolve nunca (encerrado por sinal)
  });
}

async function cmdBuild(positional: string[], flags: Record<string, string | boolean>, out: Output): Promise<number> {
  const rawDir = positional[0] ?? '.';
  const dir = resolvePluginDir(rawDir, out);
  const entry = resolveEntry(dir);
  if (!entry) {
    throw pluginError(dir, `Adicione um ponto de entrada (${ENTRY_CANDIDATES.join(', ')}) ou configure 'main' no package.json do plugin.`);
  }

  const outDir = String(flagString(flags, 'out') ?? 'dist');
  const format = (String(flagString(flags, 'format') ?? 'esm') as 'esm' | 'iife');
  if (format !== 'esm' && format !== 'iife') {
    throw new CliError(EXIT_USAGE, `formato invalido '${format}'.`, `Use --format esm ou --format iife.`);
  }
  const minify = flagBool(flags, 'minify');
  const bundler = String(flagString(flags, 'bundler') ?? 'esbuild');
  const dryRun = flagBool(flags, 'dry-run');

  fs.mkdirSync(path.resolve(dir, outDir), { recursive: true });
  const outFile = path.resolve(dir, outDir, 'plugin.js');

  if (out.json) {
    process.stdout.write(JSON.stringify({
      command: 'plugin build',
      dir,
      entry,
      outFile,
      format,
      minify,
      bundler,
      dryRun,
    }) + '\n');
  } else {
    outLog(out, bold('plugin build', out), '->', dir);
    outLog(out, `  entrada: ${entry}`);
    outLog(out, `  saida: ${outFile}  formato: ${format}  minify: ${minify}  bundler: ${bundler}`);
  }

  if (dryRun) {
    outOk(out, 'dry-run: nenhum arquivo gravado.');
    return EXIT_OK;
  }

  let result: BundleResult;
  try {
    if (bundler === 'vite') {
      result = await bundleWithVite({ entry, outFile, format, minify, out });
    } else {
      result = await bundleWithEsbuild({ entry, outFile, format, minify, out });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(EXIT_ERROR, `falha ao empacotar o plugin: ${message}`, `Verifique o ponto de entrada '${entry}' e dependencias do plugin. Rode com --verbose para o rastreio completo.`);
  }

  if (out.json) {
    process.stdout.write(JSON.stringify({
      ok: true,
      entry: result.entry,
      outFile: result.outFile,
      format: result.format,
      size: result.size,
      durationMs: result.durationMs,
    }) + '\n');
  } else {
    outOk(out, `plugin empacotado em ${result.durationMs}ms`);
    outLog(out, `  ${result.outFile}  (${(result.size / 1024).toFixed(1)} KB, formato ${result.format})`);
  }
  return EXIT_OK;
}

async function cmdTest(positional: string[], flags: Record<string, string | boolean>, out: Output): Promise<number> {
  const rawDir = positional[0] ?? '.';
  const dir = resolvePluginDir(rawDir, out);

  // verifica se existem testes no diretorio
  const hasTests = fs.readdirSync(dir).some((f) => f.endsWith('.test.ts') || f.endsWith('.test.js') || f.endsWith('.spec.ts') || f.endsWith('.spec.js'));
  const subdirTests = fs.existsSync(path.join(dir, 'tests')) || fs.existsSync(path.join(dir, '__tests__'));
  if (!hasTests && !subdirTests) {
    throw pluginError(dir, `Adicione arquivos de teste (*.test.ts) no diretorio do plugin ou em tests/ / __tests__.`);
  }

  const watch = flagBool(flags, 'watch');
  const run = flagBool(flags, 'run');
  const dryRun = flagBool(flags, 'dry-run');

  if (out.json) {
    process.stdout.write(JSON.stringify({
      command: 'plugin test',
      dir,
      watch,
      dryRun,
    }) + '\n');
  } else {
    outLog(out, bold('plugin test', out), '->', dir);
  }

  if (dryRun) {
    outOk(out, 'dry-run: testes nao executados.');
    return EXIT_OK;
  }

  // vitest e executado como processo filho para manter o CLI leve e rapido de iniciar.
  const { spawn } = await import('node:child_process');
  const args = watch ? [] : ['run'];
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vitest', ...args], {
      cwd: dir,
      stdio: 'inherit',
      env: { ...process.env },
      shell: true,
    });
    child.on('error', (error) => {
      reject(new CliError(EXIT_ERROR, `falha ao iniciar o vitest: ${error.message}`, `Instale o vitest (ja eh devDependencia do plugin-sdk) ou rode `npx vitest` no diretorio do plugin.`));
    });
    child.on('exit', (code) => {
      resolve(typeof code === 'number' ? code : EXIT_ERROR);
    });
  });
}

// ---------------------------------------------------------------------------
// Roteador e ponto de entrada
// ---------------------------------------------------------------------------

function route(argv: string[], out: Output): Promise<number> | number {
  const parsed = parseArgs(argv);

  // flags globais antes de tudo
  if (flagBool(parsed.flags, 'help') || parsed.command === null) {
    outLog(out, helpRoot(out));
    return parsed.command === null ? EXIT_USAGE : EXIT_OK;
  }
  if (flagBool(parsed.flags, 'version')) {
    outLog(out, `plugin-sdk ${VERSION}`);
    return EXIT_OK;
  }

  if (parsed.command !== 'plugin') {
    throw new CliError(EXIT_USAGE, `comando desconhecido '${parsed.command}'.`, `Use: plugin-sdk plugin dev|build|test. Rode plugin-sdk --help para ver todos os comandos.`);
  }

  const sub = parsed.subcommand;
  const positional = parsed.positional;

  if (!sub) {
    outLog(out, helpPlugin(out));
    return EXIT_USAGE;
  }
  if (flagBool(parsed.flags, 'help')) {
    switch (sub) {
    case 'dev': outLog(out, helpDev(out)); return EXIT_OK;
    case 'build': outLog(out, helpBuild(out)); return EXIT_OK;
    case 'test': outLog(out, helpTest(out)); return EXIT_OK;
    default: throw new CliError(EXIT_USAGE, `comando de plugin desconhecido '${sub}'.`, `Use: plugin-sdk plugin dev|build|test.`);
    }
  }

  switch (sub) {
    case 'dev': return cmdDev(positional, parsed.flags, out);
    case 'build': return cmdBuild(positional, parsed.flags, out);
    case 'test': return cmdTest(positional, parsed.flags, out);
    default: throw new CliError(EXIT_USAGE, `comando de plugin desconhecido '${sub}'.`, `Use: plugin-sdk plugin dev|build|test.`);
  }
}

async function main(argv: string[]): Promise<number> {
  // --json e --no-color sao lidos antecipadamente para configurar a saida.
  const quick = parseArgs(argv);
  const out = createOutput({
    json: flagBool(quick.flags, 'json'),
    noColor: flagBool(quick.flags, 'no-color'),
    quiet: flagBool(quick.flags, 'quiet'),
    verbose: flagBool(quick.flags, 'verbose'),
  });

  try {
    const code = await route(argv, out);
    return typeof code === 'number' ? code : EXIT_OK;
  } catch (error) {
    if (error instanceof CliError) {
      if (out.json) {
        process.stdout.write(JSON.stringify({
          ok: false,
          code: error.code,
          message: error.message,
          fix: error.fix,
        }) + '\n');
      } else {
        process.stderr.write(colorize('red', '✗', out) + ' ' + error.message + '\n');
        if (error.fix) {
          process.stderr.write(`  ${colorize('cyan', 'Fix:', out)} ${error.fix}\n`);
        }
        if (error instanceof Error && flagBool(quick.flags, 'verbose')) {
          process.stderr.write(`${error.stack ?? ''}\n`);
        }
        if (!(error instanceof CliError) || !(error.code === EXIT_USAGE)) {
          process.stderr.write(`  Rode com --verbose para o rastreio completo.\n`);
        }
      }
      return error.code;
    }
    // erro inesperado: nunca vaza stack trace cru ao usuario sem --verbose
    const message = error instanceof Error ? error.message : String(error);
    if (out.json) {
      process.stdout.write(JSON.stringify({ ok: false, code: EXIT_ERROR, message }) + '\n');
    } else {
      process.stderr.write(colorize('red', '✗', out) + ' ' + message + '\n');
      process.stderr.write(`  ${colorize('cyan', 'Fix:', out)} inesperado. Rode com --verbose para o rastreio completo.\n`);
      if (flagBool(quick.flags, 'verbose') && error instanceof Error) {
        process.stderr.write(`${error.stack ?? ''}\n`);
      }
    }
    return EXIT_ERROR;
  }
}

if (process.argv[1] && process.argv[1].endsWith('dev-cli.ts') || process.argv[1]?.includes('dev-cli')) {
  void main(process.argv.slice(2)).then((code) => process.exit(code));
}

export { parseArgs, createOutput, route, main, CliError, EXIT_OK, EXIT_ERROR, EXIT_USAGE, EXIT_PLUGIN };
