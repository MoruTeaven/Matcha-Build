import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { hashFiles, walkFiles } from '../utils/fs.mjs';

async function gitInfo(rootDir) {
  try {
    const [{ stdout: commit }, { stdout: status }] = await Promise.all([
      execa('git', ['rev-parse', '--short', 'HEAD'], { cwd: rootDir }),
      execa('git', ['status', '--porcelain'], { cwd: rootDir }),
    ]);
    return { commit: commit.trim(), dirty: status.trim().length > 0 };
  } catch {
    return { commit: null, dirty: null };
  }
}

/** 汇总单个 target 的产物统计（文件数 / 字节 / 稳定哈希） */
export async function summarizeTarget(target, gates) {
  const files = await walkFiles(target.outDirAbs);
  let bytes = 0;
  for (const file of files) bytes += (await fs.stat(file)).size;
  const hash = await hashFiles(target.outDirAbs, files);

  return {
    runner: target.runner,
    outDir: target.outDir.replace(/\\/g, '/'),
    files: files.length,
    bytes,
    hash: `sha256:${hash}`,
    gates,
  };
}

export async function writeBuildManifest(ctx, results, startedAt) {
  const git = await gitInfo(ctx.rootDir);
  const manifest = {
    app: ctx.config.app.name,
    displayName: ctx.config.app.displayName ?? null,
    version: ctx.config.version,
    env: ctx.env,
    builtAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    git: { commit: git.commit, dirty: git.dirty },
    targets: {},
    gates: [],
    skipped: results.filter((item) => item.skipped).map((item) => ({ id: item.id, reason: item.reason })),
    failed: results.filter((item) => item.ok === false).map((item) => ({ id: item.id, error: item.error })),
  };

  for (const result of results) {
    if (!result.ok) continue;
    const { id, gates, ...rest } = result;
    manifest.targets[id] = rest;
    for (const gate of gates ?? []) {
      manifest.gates.push({ target: id, ...gate });
    }
  }

  const file = path.join(ctx.config.outDirAbs, 'build-manifest.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  return { file, manifest };
}
