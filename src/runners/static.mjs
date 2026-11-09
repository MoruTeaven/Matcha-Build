import { log } from '../utils/log.mjs';

/** 不做编译、只做资源归集的 target（预留给纯静态页面） */
export default {
  id: 'static',

  async build(target, ctx) {
    log.step('static（无编译步骤，仅资源归集）');
    return { outDir: target.outDirAbs, runner: 'static' };
  },
};
