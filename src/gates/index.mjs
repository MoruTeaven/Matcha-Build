import { bomGate } from './bom.mjs';
import { envLeakGate } from './env-leak.mjs';
import { manifestIntegrityGate } from './manifest-integrity.mjs';
import { noCoreLeakGate } from './no-core-leak.mjs';
import { sharedUiGate } from './shared-ui.mjs';

export const GATES = new Map([
  [bomGate.id, bomGate],
  [envLeakGate.id, envLeakGate],
  [manifestIntegrityGate.id, manifestIntegrityGate],
  [noCoreLeakGate.id, noCoreLeakGate],
  [sharedUiGate.id, sharedUiGate],
]);

export const DEFAULT_GATES = ['manifest-integrity', 'no-core-leak', 'env-leak', 'bom'];

export async function runGates(target, ctx, enabled) {
  const ids = target.gates ?? enabled ?? DEFAULT_GATES;
  const results = [];

  for (const id of ids) {
    const gate = GATES.get(id);
    if (!gate) {
      results.push({ id, ok: false, detail: `未知门禁：${id}（可用：${[...GATES.keys()].join(' / ')}）` });
      continue;
    }
    try {
      const detail = await gate.check(target, ctx);
      results.push({ id, ok: true, detail: String(detail) });
    } catch (error) {
      results.push({ id, ok: false, detail: error.message });
    }
  }

  return results;
}
