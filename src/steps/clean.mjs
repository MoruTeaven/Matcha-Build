import { ensureDir, removeDir } from '../utils/fs.mjs';

/** dist 由 matcha 独占：先清空 target 目录，Vite 侧用 emptyOutDir:false 避免二次清理 */
export async function cleanTarget(target) {
  await removeDir(target.outDirAbs);
  await ensureDir(target.outDirAbs);
}
