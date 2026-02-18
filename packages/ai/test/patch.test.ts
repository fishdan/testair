import { describe, expect, it } from 'vitest';

import { applyRepairPatch, repairPatchSchema } from '../src/patch.js';

describe('repair patch', () => {
  it('accepts safe patch operations', () => {
    const parsed = repairPatchSchema.safeParse({
      reason: 'update target',
      operations: [{ op: 'replace', path: '/steps/1/target', value: 'Log in' }]
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects unsupported path', () => {
    const parsed = repairPatchSchema.safeParse({
      reason: 'unsafe update',
      operations: [{ op: 'replace', path: '/metadata/admin', value: true }]
    });

    expect(parsed.success).toBe(false);
  });

  it('applies patch to plan', () => {
    const updated = applyRepairPatch(
      {
        version: '1',
        steps: [
          { type: 'goto', url: 'https://example.com' },
          { type: 'click', target: 'Sign in' }
        ]
      },
      {
        reason: 'button renamed',
        operations: [{ op: 'replace', path: '/steps/1/target', value: 'Submit' }]
      }
    );

    expect(updated.steps[1]).toMatchObject({ type: 'click', target: 'Submit' });
  });
});
