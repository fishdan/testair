import { OpenAIRepairAdapter } from './openai.js';
import { repairPatchSchema, type RepairPatch } from './patch.js';
import type { RepairAdapter, RepairRequest } from './types.js';
import type { AIProvider } from './types.js';

export class MockRepairAdapter implements RepairAdapter {
  async repair(request: RepairRequest): Promise<unknown> {
    const failed = request.runResult.steps.find((step) => step.status === 'failed');
    if (!failed) {
      return {
        reason: 'No failure detected',
        operations: []
      };
    }

    return {
      reason: 'Fallback selector refinement from failed click/fill target',
      operations:
        failed.type === 'click'
          ? [{ op: 'replace', path: `/steps/${failed.index}/target`, value: 'Submit' }]
          : []
    };
  }
}

export async function createRepairPatch(
  request: RepairRequest,
  adapter: RepairAdapter = new MockRepairAdapter()
): Promise<RepairPatch> {
  const raw = await adapter.repair(request);
  return repairPatchSchema.parse(raw);
}

export function repairAdapterForProvider(provider: AIProvider): RepairAdapter {
  return provider === 'openai' ? new OpenAIRepairAdapter() : new MockRepairAdapter();
}
