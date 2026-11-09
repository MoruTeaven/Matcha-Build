import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import { z } from 'zod';

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
    this.exitCode = 2;
  }
}

const CONFIG_FILES = [
  'build.config.ts',
  'build.config.mts',
  'build.config.mjs',
  'build.config.js',
];

const manifestSchema = z.object({
  kind: z.enum(['utools', 'ztools', 'web', 'custom']).optional(),
  copy: z.array(z.string()).default([]),
  generate: z.record(z.any()).default({}),
  require: z.array(z.string()).default([]),
});

const targetSchema = z.object({
  runner: z.enum(['vite', 'taro', 'tauri', 'static']),
  dir: z.string(),
  outDir: z.string(),
  base: z.string().default('/'),
  entry: z.string().optional(),
  plugins: z.array(z.any()).default([]),
  env: z.record(z.string()).default({}),
  define: z.record(z.any()).default({}),
  manifest: manifestSchema.optional(),
  assets: z.array(z.string()).default([]),
  platforms: z.array(z.string()).optional(),
  bundle: z.array(z.string()).optional(),
  gates: z.array(z.string()).optional(),
  port: z.number().int().positive().optional(),
  /** 可选 target：依赖未就绪时跳过而不是让整个构建失败（渐进接入用） */
  optional: z.boolean().default(false),
});

const configSchema = z.object({
  app: z.object({
    name: z.string(),
    displayName: z.string().optional(),
    versionFrom: z.string().default('package.json'),
  }),
  core: z
    .object({
      root: z.string().default('core/src'),
      alias: z.string().default('@mocha/core'),
      mode: z.enum(['source', 'built']).default('source'),
    })
    .default(() => ({ root: 'core/src', alias: '@mocha/core', mode: 'source' })),
  outDir: z.string().default('dist'),
  targets: z.record(targetSchema),
  gates: z
    .object({
      enabled: z.array(z.string()).default([]),
      options: z.record(z.any()).default({}),
    })
    .default(() => ({ enabled: [], options: {} })),
});

/**
 * 恒等函数，只为在 build.config.ts 里获得类型提示。
 * @template {import('./index.d.ts').BuildConfig} T
 * @param {T} config
 * @returns {T}
 */
export function defineBuildConfig(config) {
  return config;
}

function formatZodError(error) {
  return error.issues
    .map((issue) => `  · ${issue.path.join('.') || '<root>'}：${issue.message}`)
    .join('\n');
}

function readVersion(rootDir, versionFrom) {
  const file = path.resolve(rootDir, versionFrom);
  if (!fs.existsSync(file)) {
    throw new ConfigError(`app.versionFrom 指向的文件不存在：${versionFrom}`);
  }
  if (path.extname(file) === '.json') {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!pkg.version) throw new ConfigError(`${versionFrom} 里没有 version 字段`);
    return pkg.version;
  }
  throw new ConfigError(`暂不支持的版本来源：${versionFrom}（目前只支持 JSON）`);
}

function normalize(rootDir, configPath, parsed) {
  const outDirAbs = path.resolve(rootDir, parsed.outDir);
  const targets = {};
  const usedOutDirs = new Map();

  for (const [id, target] of Object.entries(parsed.targets)) {
    const dirAbs = path.resolve(rootDir, target.dir);
    const outDir = path.resolve(rootDir, target.outDir);
    const relative = path.relative(outDirAbs, outDir);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new ConfigError(`target "${id}" 的 outDir（${target.outDir}）必须位于 ${parsed.outDir}/ 之内`);
    }
    if (usedOutDirs.has(outDir)) {
      throw new ConfigError(`target "${id}" 与 "${usedOutDirs.get(outDir)}" 产出到同一目录：${target.outDir}`);
    }
    usedOutDirs.set(outDir, id);

    targets[id] = {
      ...target,
      id,
      dirAbs,
      outDirAbs: outDir,
      unavailable: fs.existsSync(dirAbs) ? null : `目录不存在：${target.dir}`,
    };
  }

  return {
    rootDir,
    configPath,
    app: parsed.app,
    core: {
      ...parsed.core,
      rootAbs: path.resolve(rootDir, parsed.core.root),
    },
    outDir: parsed.outDir,
    outDirAbs,
    targets,
    gates: parsed.gates,
    version: readVersion(rootDir, parsed.app.versionFrom),
  };
}

export async function loadConfig(rootDir, options = {}) {
  const configPath = options.config
    ? path.resolve(rootDir, options.config)
    : CONFIG_FILES.map((file) => path.join(rootDir, file)).find((file) => fs.existsSync(file));

  if (!configPath || !fs.existsSync(configPath)) {
    throw new ConfigError(`找不到构建配置（${CONFIG_FILES.join(' / ')}），请确认在项目根目录运行`);
  }

  const jiti = createJiti(pathToFileURL(configPath).href, {
    interopDefault: true,
    moduleCache: false,
    fsCache: false,
  });

  let loaded;
  try {
    loaded = await jiti.import(pathToFileURL(configPath).href);
  } catch (error) {
    throw new ConfigError(`加载 ${path.basename(configPath)} 失败：${error.message}`);
  }

  const raw = loaded?.default ?? loaded;
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError(`build.config 校验失败：\n${formatZodError(parsed.error)}`);
  }

  return normalize(rootDir, configPath, parsed.data);
}
