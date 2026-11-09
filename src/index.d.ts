/**
 * @moruteaven/matcha 的公开类型。
 * 构建工具本身是纯 ESM JS，这里只声明项目在 build.config.ts 里用到的契约。
 */

export type RunnerId = 'vite' | 'taro' | 'tauri' | 'static';

export interface ManifestConfig {
  /** 平台清单类型；utools / ztools 会走内置校验 */
  kind?: 'utools' | 'ztools' | 'web' | 'custom';
  /** 从客户端目录原样拷贝到产物目录的文件（如 plugin.json、preload.js） */
  copy?: string[];
  /** 在产物目录生成 JSON 文件，如 { 'package.json': { type: 'commonjs' } } */
  generate?: Record<string, unknown>;
  /** 产物里必须存在的文件，缺失即失败 */
  require?: string[];
}

export interface TargetConfig {
  runner: RunnerId;
  /** 客户端源码目录（相对仓库根） */
  dir: string;
  /** 产物目录（相对仓库根，必须在 outDir 之内） */
  outDir: string;
  base?: string;
  entry?: string;
  plugins?: unknown[];
  env?: Record<string, string>;
  define?: Record<string, string | number | boolean>;
  manifest?: ManifestConfig;
  /** 额外拷贝到产物根的文件（相对仓库根） */
  assets?: string[];
  /** taro 的平台列表 */
  platforms?: string[];
  /** tauri 的打包目标 */
  bundle?: string[];
  /** 覆盖全局门禁列表 */
  gates?: string[];
  /** dev server 端口 */
  port?: number;
}

export interface BuildConfig {
  app: {
    name: string;
    displayName?: string;
    /** 版本来源，默认 package.json */
    versionFrom?: string;
  };
  core?: {
    root?: string;
    alias?: string;
    mode?: 'source' | 'built';
  };
  outDir?: string;
  targets: Record<string, TargetConfig>;
  gates?: {
    enabled?: string[];
    options?: Record<string, unknown>;
  };
}

export declare function defineBuildConfig(config: BuildConfig): BuildConfig;

export declare class ConfigError extends Error {
  exitCode: number;
}

/** 加载并规范化配置；路径解析为绝对路径，target 带 unavailable 标记 */
export declare function loadConfig(
  rootDir: string,
  options?: { config?: string },
): Promise<{
  rootDir: string;
  configPath: string;
  app: BuildConfig['app'];
  core: { root: string; alias: string; mode: 'source' | 'built'; rootAbs: string };
  outDir: string;
  outDirAbs: string;
  targets: Record<string, TargetConfig & { id: string; dirAbs: string; outDirAbs: string; unavailable: string | null }>;
  gates: { enabled: string[]; options: Record<string, unknown> };
  version: string;
}>;

/** CLI 入口：返回进程退出码（0 成功 / 1 构建失败 / 2 配置错误 / 3 门禁失败） */
export declare function runCli(argv: string[]): Promise<number>;
