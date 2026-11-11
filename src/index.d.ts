/**
 * @moruteaven/matchabuild 的公开类型。
 * 构建工具本身是纯 ESM JS，这里只声明项目在 build.config.ts 与插件包里用到的契约。
 */

/**
 * runner 标识：vite / static 是内核内置，其余由插件提供
 * （如 taro 来自 @moruteaven/matchabuild-plugin-taro）。
 */
export type RunnerId = string;

export interface ManifestConfig {
  /** 清单类型标记：现在仅作元数据，具体清单逻辑由 runner 插件决定 */
  kind?: string;
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
  /** 可选 target：依赖未就绪时跳过而不是让整个构建失败 */
  optional?: boolean;
}

/** 规范化后的 target（loadConfig 后） */
export type ResolvedTarget = TargetConfig & {
  id: string;
  dirAbs: string;
  outDirAbs: string;
  unavailable: string | null;
};

/** 构建上下文（runner / gate 的第二个参数） */
export interface BuildContext {
  rootDir: string;
  env: string;
  config: {
    rootDir: string;
    app: BuildConfig['app'];
    core: { root: string; alias: string; mode: 'source' | 'built'; rootAbs: string };
    outDir: string;
    outDirAbs: string;
    targets: Record<string, ResolvedTarget>;
    gates: { enabled: string[]; options: Record<string, unknown> };
    version: string;
  };
}

export interface BuildResult {
  runner: string;
  [key: string]: unknown;
}

/** runner 插件契约（BUILD-SPEC §12） */
export interface RunnerPlugin {
  /** 唯一标识，与 target.runner 对应 */
  id: string;
  /** 构建前的前置检查（缺依赖时在这里给出可操作的错误） */
  preflight?(target: ResolvedTarget, ctx: BuildContext): Promise<unknown>;
  /** 执行构建，产物写进 target.outDirAbs */
  build(target: ResolvedTarget, ctx: BuildContext): Promise<BuildResult>;
  /** 开发态（可选） */
  dev?(target: ResolvedTarget, ctx: BuildContext): Promise<void>;
}

export interface BuildConfig {
  app: {
    name: string;
    displayName?: string;
    /** 版本来源，默认 package.json */
    versionFrom?: string;
  };
  /** runner 插件列表 */
  plugins?: RunnerPlugin[];
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

/** 类型辅助：写插件时包一层 */
export declare function defineRunnerPlugin(plugin: RunnerPlugin): RunnerPlugin;

/** 注册 runner 插件（一般由 loadConfig 内部调用） */
export declare function registerRunner(plugin: RunnerPlugin): RunnerPlugin;
export declare function registerPlugins(plugins: RunnerPlugin[]): void;

/** 取已注册的 runner；未注册时抛错并提示安装对应插件包 */
export declare function getRunner(id: string): RunnerPlugin;
export declare function listRunners(): string[];

export declare class ConfigError extends Error {
  exitCode: number;
}

/** 通用能力：拷贝平台清单文件、生成 JSON、校验清单引用（插件按需调用） */
export declare function applyManifest(target: ResolvedTarget, ctx?: BuildContext): Promise<void>;

/** 通用能力：把 target.assets 列出的文件拷到产物根（插件按需调用） */
export declare function applyAssets(target: ResolvedTarget, ctx: BuildContext): Promise<void>;

/** 加载并规范化配置；路径解析为绝对路径，target 带 unavailable 标记 */
export declare function loadConfig(
  rootDir: string,
  options?: { config?: string },
): Promise<BuildContext['config'] & { configPath: string }>;

/** CLI 入口：返回进程退出码（0 成功 / 1 构建失败 / 2 配置错误 / 3 门禁失败） */
export declare function runCli(argv: string[]): Promise<number>;
