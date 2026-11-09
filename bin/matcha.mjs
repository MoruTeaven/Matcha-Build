#!/usr/bin/env node
import { runCli } from '../src/cli.mjs';

// cac 的 parse 期望完整 argv（它内部会 slice(2)），这里直接传 process.argv
const code = await runCli(process.argv);
process.exitCode = code ?? 0;
