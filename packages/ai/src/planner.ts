import { planSchema, type TestPlan } from '@testair/core';

import { OpenAIPlannerAdapter } from './openai.js';
import type { PlanRequest, PlannerAdapter } from './types.js';
import type { AIProvider } from './types.js';

export class MockPlannerAdapter implements PlannerAdapter {
  async plan(request: PlanRequest): Promise<unknown> {
    const lowered = request.prompt.toLowerCase();
    const url = request.url ?? 'https://example.com';

    const plan: TestPlan = lowered.includes('login')
      ? {
          version: '1',
          name: 'Mock login flow',
          steps: [
            { type: 'goto', url },
            { type: 'login', username: '${SECRET:USERNAME}', password: '${SECRET:PASSWORD}' },
            { type: 'expect', urlIncludes: 'dashboard' }
          ]
        }
      : {
          version: '1',
          name: 'Mock public flow',
          steps: [
            { type: 'goto', url },
            { type: 'expect', textVisible: 'Example Domain' }
          ]
        };

    return plan;
  }
}

export async function createPlanFromPrompt(
  request: PlanRequest,
  adapter: PlannerAdapter = new MockPlannerAdapter()
): Promise<TestPlan> {
  const raw = await adapter.plan(request);
  return planSchema.parse(raw);
}

export function plannerAdapterForProvider(provider: AIProvider): PlannerAdapter {
  return provider === 'openai' ? new OpenAIPlannerAdapter() : new MockPlannerAdapter();
}
