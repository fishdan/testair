import { describe, expect, it } from 'vitest';

import { planSchema } from '../src/schema.js';

describe('plan schema', () => {
  it('accepts a valid plan', () => {
    const result = planSchema.safeParse({
      version: '1',
      steps: [
        { type: 'goto', url: 'https://example.com' },
        { type: 'click', target: 'More information...' },
        { type: 'expect', textVisible: 'Example Domain' }
      ]
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid expect shape', () => {
    const result = planSchema.safeParse({
      version: '1',
      steps: [{ type: 'expect', textVisible: 'ok', urlIncludes: '/home' }]
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid waitFor shape', () => {
    const result = planSchema.safeParse({
      version: '1',
      steps: [{ type: 'waitFor', textVisible: 'ok', selector: '#a' }]
    });

    expect(result.success).toBe(false);
  });
});
