import viteRunner from './runners/vite.mjs';
import taroRunner from './runners/taro.mjs';
import tauriRunner from './runners/tauri.mjs';
import staticRunner from './runners/static.mjs';

export const RUNNERS = new Map([
  ['vite', viteRunner],
  ['taro', taroRunner],
  ['tauri', tauriRunner],
  ['static', staticRunner],
]);

export function getRunner(id) {
  const runner = RUNNERS.get(id);
  if (!runner) throw new Error(`未知 runner：${id}（可用：${[...RUNNERS.keys()].join(' / ')}）`);
  return runner;
}
