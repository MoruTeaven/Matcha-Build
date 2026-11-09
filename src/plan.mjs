export const STEPS = {
  clean: '清空产物目录',
  build: '执行 runner 编译',
  manifest: '生成平台清单',
  assets: '拷贝额外资源',
  gates: '跑产物契约门禁',
  report: '写 build-manifest.json',
};

export function describePlan(ids) {
  return ids.map((id) => ({ id, steps: Object.keys(STEPS) }));
}
