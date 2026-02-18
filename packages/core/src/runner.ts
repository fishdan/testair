import { promises as fs } from 'node:fs';
import path from 'node:path';

import { config as dotenvConfig } from 'dotenv';
import { chromium, type Locator, type Page } from 'playwright';

import { compilePlan, type CompiledStep } from './compiler.js';
import type { TestPlan } from './schema.js';
import { resolveSecretPlaceholders } from './secrets.js';
import { loadSiteProfile, saveSiteProfile } from './site-profile.js';
import type { RunOptions, RunResult, SiteProfile, StepResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 10_000;

interface LocatorCandidate {
  strategy: string;
  resolve: (page: Page) => Locator;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toRunId(): string {
  return `run_${Date.now()}`;
}

function ensureValue(value: string | number | undefined, key: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}

function buildCandidates(target: string, selector: string | undefined, profile: SiteProfile): LocatorCandidate[] {
  const normalized = target.trim();
  const remembered = profile.selectors[normalized];

  const candidates: LocatorCandidate[] = [];
  if (selector && selector.length > 0) {
    candidates.push({ strategy: `explicit:${selector}`, resolve: (page) => page.locator(selector).first() });
  }
  if (remembered) {
    candidates.push({ strategy: `profile:${remembered}`, resolve: (page) => page.locator(remembered).first() });
  }

  // Resolution heuristics stay deterministic: role and label first, then text, then conservative CSS fallbacks.
  candidates.push(
    { strategy: `role(button):${normalized}`, resolve: (page) => page.getByRole('button', { name: normalized }).first() },
    { strategy: `role(link):${normalized}`, resolve: (page) => page.getByRole('link', { name: normalized }).first() },
    { strategy: `label:${normalized}`, resolve: (page) => page.getByLabel(normalized).first() },
    { strategy: `placeholder:${normalized}`, resolve: (page) => page.getByPlaceholder(normalized).first() },
    { strategy: `text:${normalized}`, resolve: (page) => page.getByText(normalized, { exact: true }).first() },
    { strategy: `text-fuzzy:${normalized}`, resolve: (page) => page.getByText(normalized).first() },
    {
      strategy: `css:[name=${normalized}]`,
      resolve: (page) => page.locator(`[name=${JSON.stringify(normalized)}]`).first()
    },
    {
      strategy: `css:[aria-label=${normalized}]`,
      resolve: (page) => page.locator(`[aria-label=${JSON.stringify(normalized)}]`).first()
    }
  );

  return candidates;
}

async function resolveLocator(
  page: Page,
  target: string,
  selector: string | undefined,
  profile: SiteProfile,
  timeoutMs: number
): Promise<{ locator: Locator; strategy: string }> {
  const candidates = buildCandidates(target, selector, profile);
  for (const candidate of candidates) {
    try {
      const locator = candidate.resolve(page);
      await locator.waitFor({ state: 'attached', timeout: Math.min(timeoutMs, 2000) });
      profile.selectors[target] =
        candidate.strategy.startsWith('explicit:') || candidate.strategy.startsWith('profile:')
          ? candidate.strategy.split(':').slice(1).join(':')
          : profile.selectors[target] ?? '';
      return { locator, strategy: candidate.strategy };
    } catch {
      // Try the next strategy.
    }
  }

  throw new Error(`Could not resolve target "${target}" using deterministic locator heuristics`);
}

async function executeStep(
  page: Page,
  step: CompiledStep,
  profile: SiteProfile,
  timeoutMs: number
): Promise<{ outputKey: string; values: string[] } | undefined> {
  if (step.type === 'goto') {
    const url = ensureValue(step.payload.url, 'url');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    return undefined;
  }

  if (step.type === 'click') {
    const target = ensureValue(step.payload.target, 'target');
    const selector = typeof step.payload.selector === 'string' ? step.payload.selector : undefined;
    const resolved = await resolveLocator(page, target, selector, profile, timeoutMs);
    await resolved.locator.click({ timeout: timeoutMs });
    return undefined;
  }

  if (step.type === 'fill') {
    const field = ensureValue(step.payload.field, 'field');
    const selector = typeof step.payload.selector === 'string' ? step.payload.selector : undefined;
    const value = ensureValue(step.payload.value, 'value');
    const resolved = await resolveLocator(page, field, selector, profile, timeoutMs);
    await resolved.locator.fill(resolveSecretPlaceholders(value, process.env), { timeout: timeoutMs });
    return undefined;
  }

  if (step.type === 'expect') {
    const localTimeout = typeof step.payload.timeoutMs === 'number' ? step.payload.timeoutMs : timeoutMs;
    if (typeof step.payload.textVisible === 'string') {
      await page.getByText(step.payload.textVisible).first().waitFor({ state: 'visible', timeout: localTimeout });
      return undefined;
    }
    if (typeof step.payload.urlIncludes === 'string') {
      await page.waitForURL(`**${step.payload.urlIncludes}**`, { timeout: localTimeout });
      return undefined;
    }
    if (typeof step.payload.elementVisible === 'string') {
      await page.locator(step.payload.elementVisible).first().waitFor({ state: 'visible', timeout: localTimeout });
      return undefined;
    }
    throw new Error('expect step missing valid payload');
  }

  if (step.type === 'waitFor') {
    if (typeof step.payload.textVisible === 'string') {
      await page.getByText(step.payload.textVisible).first().waitFor({ state: 'visible', timeout: timeoutMs });
      return undefined;
    }
    if (typeof step.payload.selector === 'string') {
      await page.locator(step.payload.selector).first().waitFor({ state: 'attached', timeout: timeoutMs });
      return undefined;
    }
    if (typeof step.payload.timeoutMs === 'number') {
      await page.waitForTimeout(step.payload.timeoutMs);
      return undefined;
    }
    throw new Error('waitFor step missing valid payload');
  }

  if (step.type === 'extractTextList') {
    const selector = ensureValue(step.payload.selector, 'selector');
    const outputKey = ensureValue(step.payload.outputKey, 'outputKey');
    const limit = typeof step.payload.limit === 'number' ? step.payload.limit : 5;
    const rows = page.locator(selector);
    const count = await rows.count();
    const values: string[] = [];

    for (let index = 0; index < Math.min(limit, count); index += 1) {
      const normalized = (await rows.nth(index).innerText()).replace(/\s+/g, ' ').trim();
      if (normalized.length > 0) {
        values.push(normalized);
      }
    }

    return { outputKey, values };
  }

  return undefined;
}

export async function runPlan(plan: TestPlan, options: RunOptions = {}): Promise<RunResult> {
  if (options.envFile) {
    dotenvConfig({ path: options.envFile, override: true });
  }

  const runId = options.runId ?? toRunId();
  const artifactsRoot = options.artifactsRoot ?? 'runs';
  const runDir = path.join(artifactsRoot, runId);
  const tracePath = path.join(runDir, 'trace.zip');
  const resultPath = path.join(runDir, 'RunResult.json');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const siteProfilesRoot = options.siteProfilesRoot ?? path.join(artifactsRoot, 'site-profiles');

  await fs.mkdir(runDir, { recursive: true });

  const compiled = compilePlan(plan);
  if (options.dryRun) {
    const result: RunResult = {
      runId,
      status: 'passed',
      startedAt: nowIso(),
      endedAt: nowIso(),
      durationMs: 0,
      plan,
      steps: compiled.map((step) => ({
        index: step.index,
        type: step.type,
        description: `DRY RUN: ${step.description}`,
        status: 'passed',
        startedAt: nowIso(),
        endedAt: nowIso(),
        durationMs: 0
      })),
      outputs: {},
      artifacts: {
        runDir,
        tracePath,
        resultPath
      }
    };

    await fs.writeFile(resultPath, JSON.stringify(result, null, 2), 'utf8');
    return result;
  }

  const startedAt = Date.now();
  const stepResults: StepResult[] = [];
  const outputs: Record<string, string[]> = {};
  const startedAtIso = nowIso();
  let failureScreenshotPath: string | undefined;
  let failureDomPath: string | undefined;
  let status: 'passed' | 'failed' = 'passed';

  const browser = await chromium.launch({ headless: options.headless ?? true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const domain = (() => {
    const firstGoto = compiled.find((step) => step.type === 'goto');
    if (!firstGoto || typeof firstGoto.payload.url !== 'string') {
      return 'default';
    }
    return new URL(firstGoto.payload.url).hostname.replace(/[^a-z0-9.-]/gi, '_');
  })();
  const siteProfile = await loadSiteProfile(siteProfilesRoot, domain);

  try {
    for (const step of compiled) {
      const stepStarted = Date.now();
      const stepStartedIso = nowIso();
      try {
        const extracted = await executeStep(page, step, siteProfile, timeoutMs);
        if (extracted) {
          outputs[extracted.outputKey] = extracted.values;
        }

        const stepEnded = Date.now();
        stepResults.push({
          index: step.index,
          type: step.type,
          description: step.description,
          status: 'passed',
          startedAt: stepStartedIso,
          endedAt: nowIso(),
          durationMs: stepEnded - stepStarted
        });
      } catch (error) {
        status = 'failed';
        const stepEnded = Date.now();
        failureScreenshotPath = path.join(runDir, `failure-step-${step.index + 1}.png`);
        await page.screenshot({ path: failureScreenshotPath, fullPage: true });
        const dom = await page.content();
        failureDomPath = path.join(runDir, `failure-step-${step.index + 1}.dom.html`);
        await fs.writeFile(failureDomPath, dom.slice(0, 20_000), 'utf8');

        stepResults.push({
          index: step.index,
          type: step.type,
          description: step.description,
          status: 'failed',
          startedAt: stepStartedIso,
          endedAt: nowIso(),
          durationMs: stepEnded - stepStarted,
          error: error instanceof Error ? error.message : String(error),
          artifactPaths: [failureScreenshotPath, failureDomPath]
        });

        break;
      }
    }
  } finally {
    await context.tracing.stop({ path: tracePath });
    await browser.close();
  }

  siteProfile.updatedAt = nowIso();
  await saveSiteProfile(siteProfilesRoot, siteProfile);

  const endedAt = Date.now();
  const endedAtIso = nowIso();
  const runResult: RunResult = {
    runId,
    status,
    startedAt: startedAtIso,
    endedAt: endedAtIso,
    durationMs: endedAt - startedAt,
    plan,
    steps: stepResults,
    outputs,
    artifacts: {
      runDir,
      tracePath,
      resultPath,
      failureScreenshotPath,
      failureDomPath
    }
  };

  await fs.writeFile(resultPath, JSON.stringify(runResult, null, 2), 'utf8');
  return runResult;
}
