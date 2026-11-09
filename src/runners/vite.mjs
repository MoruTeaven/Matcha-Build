import { existsSync } from 'node:fs';
import path from 'node:path';
import { log } from '../utils/log.mjs';

let viteModule = null;

export async function loadVite() {
  if (viteModule) return viteModule;
  try {
    viteModule = await import('vite');
  } catch {
    throw new Error('matcha 找不到 vite：请在该项目根目录安装 vite（pnpm add -D vite）');
  }
  return viteModule;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveCoreEntry(config) {
  const candidates = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];
  for (const candidate of candidates) {
    const file = path.join(config.core.rootAbs, candidate);
    if (existsSync(file)) return file;
  }
  return path.join(config.core.rootAbs, 'index.ts');
}

/** 由配置生成 alias，客户端不再自己写 resolve.alias */
export function buildAlias(config) {
  const alias = escapeRegExp(config.core.alias);
  return [
    { find: new RegExp(`^${alias}$`), replacement: resolveCoreEntry(config) },
    { find: new RegExp(`^${alias}/(.*)$`), replacement: path.join(config.core.rootAbs, '$1') },
  ];
}

/** 配置里的 define 写原始值，这里统一 JSON.stringify */
function normalizeDefine(target, config) {
  const merged = {
    __APP_VERSION__: config.version,
    __PLATFORM__: target.id,
    ...(target.define ?? {}),
  };
  const output = {};
  for (const [key, value] of Object.entries(merged)) output[key] = JSON.stringify(value);
  return output;
}

export function createViteConfig(target, ctx) {
  const root = target.dirAbs;
  const input = target.entry ? path.resolve(root, target.entry) : path.resolve(root, 'index.html');

  return {
    root,
    base: target.base ?? '/',
    configFile: false,
    publicDir: path.join(root, 'public'),
    plugins: target.plugins ?? [],
    resolve: {
      alias: buildAlias(ctx.config),
    },
    define: normalizeDefine(target, ctx.config),
    envPrefix: ['VITE_', 'TAURI_', 'APP_'],
    build: {
      outDir: target.outDirAbs,
      emptyOutDir: false,
      sourcemap: ctx.env !== 'prod',
      target: 'es2022',
      rollupOptions: { input },
    },
    server: {
      port: target.port ?? 5177,
      strictPort: Boolean(target.port),
    },
    logLevel: 'info',
  };
}

export default {
  id: 'vite',

  async preflight() {
    await loadVite();
  },

  async build(target, ctx) {
    const vite = await loadVite();
    log.step(`vite build（base=${target.base}）`);
    await vite.build(createViteConfig(target, ctx));
    return { outDir: target.outDirAbs, runner: 'vite' };
  },

  async dev(target, ctx) {
    const vite = await loadVite();
    const config = createViteConfig(target, ctx);
    config.build = undefined;
    const server = await vite.createServer(config);
    await server.listen();
    server.printUrls();
    log.info(`dev 已启动：${target.id}（Ctrl+C 退出）`);
  },
};
