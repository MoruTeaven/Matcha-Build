import staticRunner from './runners/static.mjs';
import viteRunner from './runners/vite.mjs';

/**
 * runner 注册表：内核只内置 vite（官方支持）与 static。
 * 其它端（taro / tauri / …）由插件包在 build.config.ts 的 plugins 里注册。
 */
const BUILTIN = ['vite', 'static'];

const REGISTRY = new Map([
  ['vite', viteRunner],
  ['static', staticRunner],
]);

/**
 * 注册一个 runner 插件。同名重复注册视为更新（配置文件热重载时会出现）。
 * 内置 runner（vite / static）不允许被插件覆盖。
 */
export function registerRunner(plugin) {
  if (!plugin || typeof plugin !== 'object') {
    throw new Error('runner 插件必须是对象');
  }
  if (!plugin.id || typeof plugin.id !== 'string') {
    throw new Error('runner 插件缺少 id 字段');
  }
  if (typeof plugin.build !== 'function') {
    throw new Error(`runner 插件 ${plugin.id} 缺少 build() 方法`);
  }
  if (BUILTIN.includes(plugin.id)) {
    throw new Error(`runner 插件 id 与内置 runner 冲突：${plugin.id}`);
  }
  REGISTRY.set(plugin.id, plugin);
  return plugin;
}

export function registerPlugins(plugins = []) {
  for (const plugin of plugins ?? []) registerRunner(plugin);
}

export function getRunner(id) {
  const runner = REGISTRY.get(id);
  if (!runner) {
    throw new Error(
      `未知 runner：${id}（内置：${[...REGISTRY.keys()].join(' / ')}）。` +
        `如需 ${id}，请安装 @moruteaven/matchabuild-plugin-${id} 并在 build.config.ts 的 plugins 里注册`,
    );
  }
  return runner;
}

export function listRunners() {
  return [...REGISTRY.keys()];
}
