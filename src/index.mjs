export { defineBuildConfig, loadConfig, ConfigError } from './config.mjs';
export { runCli } from './cli.mjs';
export { getRunner, registerRunner, registerPlugins, listRunners } from './runner.mjs';

/**
 * 类型辅助：写 runner 插件时用它包一层，可获得 RunnerPlugin 的类型提示。
 * @template {import('./index.d.ts').RunnerPlugin} T
 * @param {T} plugin
 * @returns {T}
 */
export function defineRunnerPlugin(plugin) {
  return plugin;
}
