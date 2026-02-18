import type { ClickStep, ExpectStep, ExtractTextListStep, FillStep, TestPlan, TestStep, WaitForStep } from './schema.js';

export interface CompiledStep {
  index: number;
  sourceStepIndex: number;
  type: 'goto' | 'click' | 'fill' | 'expect' | 'waitFor' | 'extractTextList';
  description: string;
  payload: Record<string, string | number>;
}

function normalizeText(value: string): string {
  return value.trim();
}

function compileClick(step: ClickStep, sourceStepIndex: number, indexStart: number): CompiledStep[] {
  return [
    {
      index: indexStart,
      sourceStepIndex,
      type: 'click',
      description: `click ${step.target}`,
      payload: {
        target: normalizeText(step.target),
        selector: step.selector ?? ''
      }
    }
  ];
}

function compileFill(step: FillStep, sourceStepIndex: number, indexStart: number): CompiledStep[] {
  return [
    {
      index: indexStart,
      sourceStepIndex,
      type: 'fill',
      description: `fill ${step.field}`,
      payload: {
        field: normalizeText(step.field),
        value: step.value,
        selector: step.selector ?? ''
      }
    }
  ];
}

function compileExpect(step: ExpectStep, sourceStepIndex: number, indexStart: number): CompiledStep[] {
  const payload: Record<string, string | number> = {};
  if (step.textVisible) {
    payload.textVisible = step.textVisible;
  }
  if (step.urlIncludes) {
    payload.urlIncludes = step.urlIncludes;
  }
  if (step.elementVisible) {
    payload.elementVisible = step.elementVisible;
  }
  if (step.timeoutMs) {
    payload.timeoutMs = step.timeoutMs;
  }

  return [
    {
      index: indexStart,
      sourceStepIndex,
      type: 'expect',
      description: 'expect condition',
      payload
    }
  ];
}

function compileWaitFor(step: WaitForStep, sourceStepIndex: number, indexStart: number): CompiledStep[] {
  const payload: Record<string, string | number> = {};
  if (step.textVisible) {
    payload.textVisible = step.textVisible;
  }
  if (step.selector) {
    payload.selector = step.selector;
  }
  if (step.timeoutMs) {
    payload.timeoutMs = step.timeoutMs;
  }

  return [
    {
      index: indexStart,
      sourceStepIndex,
      type: 'waitFor',
      description: 'wait for condition',
      payload
    }
  ];
}

function compileExtractTextList(step: ExtractTextListStep, sourceStepIndex: number, indexStart: number): CompiledStep[] {
  return [
    {
      index: indexStart,
      sourceStepIndex,
      type: 'extractTextList',
      description: `extract text list ${step.outputKey}`,
      payload: {
        selector: step.selector,
        limit: step.limit ?? 5,
        outputKey: step.outputKey
      }
    }
  ];
}

function compileLogin(step: Extract<TestStep, { type: 'login' }>, sourceStepIndex: number, indexStart: number): CompiledStep[] {
  // Heuristic login macro: resolve username/password fields by label text first,
  // then click a common submit CTA.
  return [
    {
      index: indexStart,
      sourceStepIndex,
      type: 'fill',
      description: 'login username',
      payload: { field: 'username', value: step.username, selector: '' }
    },
    {
      index: indexStart + 1,
      sourceStepIndex,
      type: 'fill',
      description: 'login password',
      payload: { field: 'password', value: step.password, selector: '' }
    },
    {
      index: indexStart + 2,
      sourceStepIndex,
      type: 'click',
      description: 'login submit',
      payload: { target: 'Sign in', selector: '' }
    },
    {
      index: indexStart + 3,
      sourceStepIndex,
      type: 'waitFor',
      description: 'wait for post-login navigation',
      payload: { timeoutMs: 2000 }
    }
  ];
}

export function compilePlan(plan: TestPlan): CompiledStep[] {
  const compiled: CompiledStep[] = [];
  for (const [sourceIndex, step] of plan.steps.entries()) {
    const start = compiled.length;
    switch (step.type) {
      case 'goto':
        compiled.push({
          index: start,
          sourceStepIndex: sourceIndex,
          type: 'goto',
          description: `goto ${step.url}`,
          payload: { url: step.url }
        });
        break;
      case 'click':
        compiled.push(...compileClick(step, sourceIndex, start));
        break;
      case 'fill':
        compiled.push(...compileFill(step, sourceIndex, start));
        break;
      case 'expect':
        compiled.push(...compileExpect(step, sourceIndex, start));
        break;
      case 'login':
        compiled.push(...compileLogin(step, sourceIndex, start));
        break;
      case 'waitFor':
        compiled.push(...compileWaitFor(step, sourceIndex, start));
        break;
      case 'extractTextList':
        compiled.push(...compileExtractTextList(step, sourceIndex, start));
        break;
      default: {
        const neverStep: never = step;
        throw new Error(`Unknown step ${(neverStep as { type: string }).type}`);
      }
    }
  }
  return compiled;
}

export function compiledToDryRunLines(plan: TestPlan): string[] {
  return compilePlan(plan).map((step) => {
    const payload = Object.entries(step.payload)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(', ');
    return `${step.index + 1}. ${step.type}(${payload})`;
  });
}

export function generatePlaywrightScript(plan: TestPlan): string {
  const lines = compiledToDryRunLines(plan).map((entry) => `// ${entry}`);
  return [
    "import { chromium } from 'playwright';",
    '',
    'async function run() {',
    '  const browser = await chromium.launch({ headless: true });',
    '  const page = await browser.newPage();',
    ...lines.map((line) => `  ${line}`),
    '  await browser.close();',
    '}',
    '',
    'run().catch((error) => {',
    '  console.error(error);',
    '  process.exitCode = 1;',
    '});',
    ''
  ].join('\n');
}
