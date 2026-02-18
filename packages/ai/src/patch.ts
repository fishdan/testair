import { z } from 'zod';

import { planSchema, type TestPlan } from '@testair/core';

const allowedPathSchema = z
  .string()
  .regex(
    /^\/steps\/\d+\/(target|selector|field|value|url|textVisible|urlIncludes|elementVisible|timeoutMs)$/,
    'Unsupported patch path'
  );

export const patchOperationSchema = z.object({
  op: z.enum(['replace', 'add']),
  path: allowedPathSchema,
  value: z.union([z.string(), z.number().int().nonnegative()])
});

export const repairPatchSchema = z.object({
  reason: z.string().min(1),
  operations: z.array(patchOperationSchema).max(8)
});

export type PatchOperation = z.infer<typeof patchOperationSchema>;
export type RepairPatch = z.infer<typeof repairPatchSchema>;

export function applyRepairPatch(plan: TestPlan, patch: RepairPatch): TestPlan {
  const copy = JSON.parse(JSON.stringify(plan)) as TestPlan;

  for (const op of patch.operations) {
    const segments = op.path.split('/').slice(1);
    if (segments.length !== 3) {
      throw new Error(`Invalid patch path: ${op.path}`);
    }

    const stepIndex = Number(segments[1]);
    const field = segments[2];
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= copy.steps.length) {
      throw new Error(`Patch step index out of range: ${stepIndex}`);
    }

    if (!field) {
      throw new Error(`Patch field is required: ${op.path}`);
    }
    const stepRecord = copy.steps[stepIndex] as Record<string, unknown>;
    stepRecord[field] = op.value;
  }

  return planSchema.parse(copy);
}
