import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { copyFileSafe, ensureDir } from '../utils/fs.mjs';
import { log } from '../utils/log.mjs';

/**
 * 平台清单：从客户端目录拷贝清单文件、生成 package.json（如 type:commonjs），
 * 并校验清单内部引用（main / preload / logo）确实存在。
 * 这一步替代了每个端各自的 copy-assets.mjs。
 */
export async function applyManifest(target) {
  const manifest = target.manifest;
  if (!manifest) return;

  const clientDir = target.dirAbs;
  const outDir = target.outDirAbs;

  for (const relative of manifest.copy ?? []) {
    const from = path.join(clientDir, relative);
    if (!existsSync(from)) throw new Error(`清单文件缺失：${target.dir}/${relative}`);
    await copyFileSafe(from, path.join(outDir, relative));
    log.dim(`  + ${relative}`);
  }

  for (const [name, content] of Object.entries(manifest.generate ?? {})) {
    const file = path.join(outDir, name);
    await ensureDir(path.dirname(file));
    await fs.writeFile(file, `${JSON.stringify(content, null, 2)}\n`, 'utf-8');
    log.dim(`  + ${name}（生成）`);
  }

  const pluginJson = path.join(outDir, 'plugin.json');
  if (existsSync(pluginJson)) {
    const plugin = JSON.parse(await fs.readFile(pluginJson, 'utf-8'));
    for (const key of ['main', 'logo', 'preload']) {
      const value = plugin[key];
      if (!value) continue;
      if (!existsSync(path.join(outDir, value))) {
        throw new Error(`plugin.json 的 ${key} 指向不存在的文件：${value}`);
      }
    }
  }

  for (const relative of manifest.require ?? []) {
    if (!existsSync(path.join(outDir, relative))) {
      throw new Error(`产物缺少必需文件：${relative}（target ${target.id}）`);
    }
  }
}
