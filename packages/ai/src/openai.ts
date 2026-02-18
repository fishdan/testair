import { planSchema, type RunResult, type TestPlan } from '@testair/core';

import { repairPatchSchema } from './patch.js';
import type { PlanRequest, PlannerAdapter, RepairAdapter, RepairRequest } from './types.js';

interface OpenAIClientConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
}

interface ChatCompletionMessage {
  role: 'developer' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionChoice {
  message?: {
    content?: string;
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

function envRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createConfigFromEnv(): OpenAIClientConfig {
  return {
    apiKey: envRequired('OPENAI_API_KEY'),
    model: process.env.TESTAIR_OPENAI_MODEL ?? 'gpt-4.1-mini',
    baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    timeoutMs: Number(process.env.TESTAIR_OPENAI_TIMEOUT_MS ?? '30000')
  };
}

function stringifyRunFailure(runResult: RunResult): string {
  const failed = runResult.steps.find((step) => step.status === 'failed');
  if (!failed) {
    return 'No failed step in run result.';
  }

  return JSON.stringify(
    {
      runId: runResult.runId,
      failedStep: {
        index: failed.index,
        type: failed.type,
        description: failed.description,
        error: failed.error
      }
    },
    null,
    2
  );
}

async function chatCompletionJson(messages: ChatCompletionMessage[], config: OpenAIClientConfig): Promise<unknown> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${body}`);
    }

    const parsed = (await response.json()) as ChatCompletionResponse;
    const content = parsed.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI API returned no assistant content');
    }

    return JSON.parse(content) as unknown;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function summarizePlan(plan: TestPlan): string {
  return JSON.stringify(plan, null, 2);
}

export class OpenAIPlannerAdapter implements PlannerAdapter {
  private readonly config: OpenAIClientConfig;

  constructor(config: OpenAIClientConfig = createConfigFromEnv()) {
    this.config = config;
  }

  async plan(request: PlanRequest): Promise<unknown> {
    const userPrompt = [
      `Natural language test request: ${request.prompt}`,
      request.url ? `Optional URL hint: ${request.url}` : undefined,
      'Return ONLY valid JSON for the test plan.',
      'Plan must match DSL version 1 and include at least one step.',
      'Use ${SECRET:NAME} placeholders for any secrets (never real values).',
      `Top-level keys must be exactly: ${JSON.stringify(Object.keys(planSchema.shape))}`
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');

    return chatCompletionJson(
      [
        {
          role: 'developer',
          content:
            'You generate deterministic website test plans as JSON. Output must be raw JSON only, no markdown, no prose.'
        },
        { role: 'user', content: userPrompt }
      ],
      this.config
    );
  }
}

export class OpenAIRepairAdapter implements RepairAdapter {
  private readonly config: OpenAIClientConfig;

  constructor(config: OpenAIClientConfig = createConfigFromEnv()) {
    this.config = config;
  }

  async repair(request: RepairRequest): Promise<unknown> {
    const userPrompt = [
      'Given a failed deterministic browser run, return a constrained JSON patch object.',
      'Allowed ops: add, replace',
      'Allowed paths: /steps/{index}/target|selector|field|value|url|textVisible|urlIncludes|elementVisible|timeoutMs',
      'Return ONLY JSON with shape: { reason: string, operations: [{ op, path, value }] }.',
      'Do not include explanations outside JSON.',
      `Current plan:\n${summarizePlan(request.plan)}`,
      `Failure summary:\n${stringifyRunFailure(request.runResult)}`,
      request.domSnippet ? `DOM snippet:\n${request.domSnippet.slice(0, 2000)}` : undefined,
      request.lastScreenshotPath ? `Screenshot path: ${request.lastScreenshotPath}` : undefined,
      `Patch keys must be exactly: ${JSON.stringify(Object.keys(repairPatchSchema.shape))}`
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n\n');

    return chatCompletionJson(
      [
        {
          role: 'developer',
          content:
            'You repair test plans by outputting a minimal safe JSON patch object only. No markdown. No comments.'
        },
        { role: 'user', content: userPrompt }
      ],
      this.config
    );
  }
}
