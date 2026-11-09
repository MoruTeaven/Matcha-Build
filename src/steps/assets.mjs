import { existsSync } from 'node:fs';
import path from 'node:path';
import { copyFileSafe } from '../utils/fs.mjs';
import { log } from '../utils/log.mjs';

/** 额外资源（logo 等）：路径相对仓库根，统一落到产物根目录 */
export async function applyAssets(target, ctx) {
  for (const relative of target.assets ?? []) {
    const from = path.resolve(ctx.rootDir, relative);
    if (!existsSync(from)) {
      log.warn(`资源不存在，跳过：${relative}`);
      continue;
    }
    await copyFileSafe(from, path.join(target.outDirAbs, path.basename(relative)));
    log.dim(`  + ${relative}`);
  }
}
