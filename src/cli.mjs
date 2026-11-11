import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';
import cac from 'cac';
import pc from 'picocolors';
import { ConfigError, loadConfig } from './config.mjs';
import { DEFAULT_GATES, runGates } from './gates/index.mjs';
import { describePlan, STEPS } from './plan.mjs';
import { getRunner } from './runner.mjs';
import { cleanTarget } from './steps/clean.mjs';
import { summarizeTarget, writeBuildManifest } from './steps/report.mjs';
import { removeDir, walkFiles } from './utils/fs.mjs';
import { banner, log, setTarget } from './utils/log.mjs';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const run = promisify(execFile);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function selectTargets(config, requested, filter) {
  const all = Object.keys(config.targets);
  let ids = requested?.length ? [...requested] : all;

  for (const id of ids) {
    if (!config.targets[id]) {
      throw new ConfigError(`未知 target：${id}（可用：${all.join(' / ')}）`);
    }
  }

  if (filter) ids = ids.filter((id) => id.includes(filter));
  return ids;
}

function enabledGates(config) {
  return config.gates.enabled.length > 0 ? config.gates.enabled : DEFAULT_GATES;
}

function printGates(gates) {
  for (const gate of gates) {
    if (gate.ok) log.dim(`  ✓ ${gate.id}：${gate.detail}`);
    else log.error(`  ✗ ${gate.id}：${gate.detail}`);
  }
}

async function runBuildForTarget(id, ctx, options) {
  const config = ctx.config;
  const target = config.targets[id];
  setTarget(id);

  if (target.unavailable) {
    log.warn(`跳过 ${id}：${target.unavailable}`);
    return { id, skipped: true, reason: target.unavailable };
  }

  await cleanTarget(target);
  log.step('已清空产物目录');

  const runner = getRunner(target.runner);
  await runner.preflight?.(target, ctx);
  const built = await runner.build(target, ctx);

  // 清单/资产由 runner 插件按需调用（applyManifest / applyAssets 是内核导出的公共能力），
  // 内核不再替某个端隐式执行——保证"官方内核只有 web"的边界。

  const gates = options.gates === false ? [] : await runGates(target, ctx, enabledGates(config));
  printGates(gates);

  const summary = await summarizeTarget(target, gates);
  log.success(`产出 ${summary.files} 个文件 / ${formatBytes(summary.bytes)} → ${summary.outDir}`);

  return { id, ok: true, ...built, ...summary };
}

async function buildAction(targets, options) {
  try {
    const rootDir = path.resolve(options.cwd ?? process.cwd());
    const config = await loadConfig(rootDir);
    const ids = selectTargets(config, targets, options.filter);
    const env = options.env ?? 'prod';

    banner(`build ${ids.join(' ')}`, `${config.app.name}@${config.version} · env=${env}`);

    const ctx = { rootDir, config, env };
    const startedAt = Date.now();
    const results = [];
    let buildFailed = false;

    for (const id of ids) {
      try {
        results.push(await runBuildForTarget(id, ctx, options));
      } catch (error) {
        const target = config.targets[id];
        if (target?.optional) {
          setTarget(id);
          log.warn(`可选 target 未就绪，跳过：${error.message}`);
          results.push({ id, skipped: true, reason: error.message });
          continue;
        }
        buildFailed = true;
        setTarget(id);
        log.error(error.message);
        if (error.stack && process.env.MATCHA_DEBUG) log.dim(error.stack);
        results.push({ id, ok: false, error: error.message });
      }
    }

    const { file } = await writeBuildManifest(ctx, results, startedAt);
    log.info(`元数据：${path.relative(rootDir, file)}`);

    if (options.json) console.log(JSON.stringify({ results }, null, 2));

    const gateFailed = results.some((item) => item.gates?.some((gate) => !gate.ok));
    const success = results.filter((item) => item.ok).map((item) => item.id);

    banner('完成', `${success.join(' ') || '无'}${results.some((item) => item.skipped) ? ` · 跳过 ${results.filter((item) => item.skipped).map((item) => item.id).join(' ')}` : ''}`);

    if (buildFailed) return 1;
    if (gateFailed) return 3;
    return 0;
  } catch (error) {
    return failWith(error);
  }
}

async function verifyAction(targets, options) {
  try {
    const rootDir = path.resolve(options.cwd ?? process.cwd());
    const config = await loadConfig(rootDir);
    const ids = selectTargets(config, targets, options.filter);
    const ctx = { rootDir, config, env: options.env ?? 'prod' };
    let failed = false;

    banner(`verify ${ids.join(' ')}`, `${config.app.name}@${config.version}`);

    for (const id of ids) {
      const target = config.targets[id];
      setTarget(id);
      const produced = existsSync(target.outDirAbs) ? await walkFiles(target.outDirAbs) : [];
      if (produced.length === 0) {
        if (target.optional) {
          log.warn(`可选 target 尚未构建：${target.outDir}`);
          continue;
        }
        log.warn(`尚未构建：${target.outDir}`);
        failed = true;
        continue;
      }
      const gates = await runGates(target, ctx, enabledGates(config));
      printGates(gates);
      if (gates.some((gate) => !gate.ok)) failed = true;
    }

    return failed ? 3 : 0;
  } catch (error) {
    return failWith(error);
  }
}

async function cleanAction(targets, options) {
  try {
    const rootDir = path.resolve(options.cwd ?? process.cwd());
    const config = await loadConfig(rootDir);
    const ids = targets?.length ? targets : Object.keys(config.targets);

    for (const id of ids) {
      const target = config.targets[id];
      if (!target) throw new ConfigError(`未知 target：${id}`);
      setTarget(id);
      await removeDir(target.outDirAbs);
      log.success(`已清理 ${target.outDir}`);
    }

    if (!targets?.length) {
      await removeDir(config.outDirAbs);
      log.dim(`已清理 ${config.outDir}/`);
    }
    return 0;
  } catch (error) {
    return failWith(error);
  }
}

async function devAction(targets, options) {
  try {
    const rootDir = path.resolve(options.cwd ?? process.cwd());
    const config = await loadConfig(rootDir);
    const ids = selectTargets(config, targets, null);
    if (ids.length === 0) throw new ConfigError('请指定要启动的 target');

    const ctx = { rootDir, config, env: 'dev' };
    banner(`dev ${ids.join(' ')}`, 'Ctrl+C 退出');

    const tasks = ids.map(async (id) => {
      const target = config.targets[id];
      if (target.unavailable) {
        log.warn(`跳过 ${id}：${target.unavailable}`);
        return;
      }
      setTarget(id);
      const runner = getRunner(target.runner);
      await runner.preflight?.(target, ctx);
      if (!runner.dev) throw new Error(`${target.runner} runner 不支持 dev`);
      await runner.dev(target, ctx);
    });

    await Promise.all(tasks);
    return 0;
  } catch (error) {
    return failWith(error);
  }
}

async function doctorAction(options) {
  try {
    const rootDir = path.resolve(options.cwd ?? process.cwd());
    const config = await loadConfig(rootDir);
    const checks = [];

    checks.push(['Node', process.version, true]);
    try {
      const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
      const { stdout } = await run(pnpmBin, ['--version']);
      checks.push(['pnpm', stdout.trim(), true]);
    } catch {
      checks.push(['pnpm', '未安装', false]);
    }

    try {
      await import('vite');
      checks.push(['vite', '可解析', true]);
    } catch {
      checks.push(['vite', '不可解析，请安装 vite', false]);
    }

    for (const [id, target] of Object.entries(config.targets)) {
      if (target.unavailable) {
        checks.push([`target ${id}`, target.unavailable, false]);
        continue;
      }
      try {
        const runner = getRunner(target.runner);
        const preflight = await runner.preflight?.(target, { rootDir, config, env: 'dev' });
        checks.push([`target ${id}`, preflight ? '就绪' : '就绪', true]);
      } catch (error) {
        checks.push([`target ${id}`, error.message, false]);
      }
    }

    try {
      const stats = await fs.statfs(rootDir);
      const freeGB = (stats.bfree * stats.bsize) / 1024 ** 3;
      checks.push(['磁盘剩余', `${freeGB.toFixed(2)} GB`, freeGB > 2]);
    } catch {
      checks.push(['磁盘剩余', '无法读取', false]);
    }

    banner('doctor', `${config.app.name}@${config.version}`);
    for (const [name, detail, ok] of checks) {
      if (ok) log.success(`${name}：${detail}`);
      else log.error(`${name}：${detail}`);
    }

    return checks.every(([, , ok]) => ok) ? 0 : 1;
  } catch (error) {
    return failWith(error);
  }
}

async function graphAction(options) {
  try {
    const rootDir = path.resolve(options.cwd ?? process.cwd());
    const config = await loadConfig(rootDir);
    const plan = describePlan(Object.keys(config.targets));

    banner('graph', `${config.app.name}@${config.version}`);
    for (const item of plan) {
      const target = config.targets[item.id];
      console.log(`${pc.bold(item.id)} ${pc.dim(`(${target.runner} → ${target.outDir})`)}`);
      for (const step of item.steps) console.log(`  ${pc.dim('·')} ${step} — ${STEPS[step]}`);
    }
    return 0;
  } catch (error) {
    return failWith(error);
  }
}

function failWith(error) {
  if (error instanceof ConfigError) {
    log.error(error.message);
    return 2;
  }
  log.error(error.stack ?? error.message);
  return 1;
}

export async function runCli(argv) {
  const cli = cac('matcha');

  cli.option('--cwd <dir>', '项目根目录', { default: process.cwd() });

  cli
    .command('build [...targets]', '构建产物')
    .option('--env <env>', '构建环境：dev | prod', { default: 'prod' })
    .option('-f, --filter <keyword>', '只构建 id 匹配的 target')
    .option('--no-gates', '跳过门禁')
    .option('--json', '额外输出机器可读结果')
    .action(buildAction);

  cli
    .command('verify [...targets]', '只跑产物契约门禁，不重新构建')
    .option('--env <env>', '环境', { default: 'prod' })
    .option('--filter <keyword>', '只检查 id 匹配的 target')
    .action(verifyAction);

  cli.command('clean [...targets]', '清理产物').action(cleanAction);

  cli.command('dev [...targets]', '启动开发态').action(devAction);

  cli.command('doctor', '环境与依赖自检').action(doctorAction);

  cli.command('graph', '打印 target → 步骤').action(graphAction);

  cli.help();
  cli.version(pkg.version);

  cli.parse(argv, { run: false });
  if (!cli.matchedCommand) {
    cli.outputHelp();
    return 0;
  }

  const code = await cli.runMatchedCommand();
  return typeof code === 'number' ? code : 0;
}
