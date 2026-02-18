#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  applyRepairPatch,
  createPlanFromPrompt,
  createRepairPatch,
  plannerAdapterForProvider,
  repairAdapterForProvider,
  type AIProvider
} from '@testair/ai';
import { compiledToDryRunLines, planSchema, redactSecretPlaceholders, runPlan, type RunResult, type TestPlan } from '@testair/core';
import { Command } from 'commander';

interface RunCommandOptions {
  env?: string;
  dryRun?: boolean;
  artifactsRoot?: string;
  repairAttempts?: string;
  provider?: AIProvider;
}

function parseProvider(value: string | undefined): AIProvider {
  if (!value || value === 'mock' || value === 'openai') {
    return (value ?? 'mock') as AIProvider;
  }
  throw new Error(`Unsupported provider: ${value}. Expected mock|openai`);
}

function redactPlan(plan: TestPlan): TestPlan {
  const copy = JSON.parse(JSON.stringify(plan)) as TestPlan;
  for (const step of copy.steps) {
    if ('value' in step && typeof step.value === 'string') {
      step.value = redactSecretPlaceholders(step.value);
    }
    if ('username' in step && typeof step.username === 'string') {
      step.username = redactSecretPlaceholders(step.username);
    }
    if ('password' in step && typeof step.password === 'string') {
      step.password = redactSecretPlaceholders(step.password);
    }
  }
  return copy;
}

async function readPlan(planPath: string): Promise<TestPlan> {
  const raw = await fs.readFile(planPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return planSchema.parse(parsed);
}

function printSummary(result: RunResult): void {
  console.log(`runId=${result.runId} status=${result.status} durationMs=${result.durationMs}`);
  for (const step of result.steps) {
    const status = step.status.toUpperCase().padEnd(6, ' ');
    console.log(`${status} step=${step.index + 1} ${step.description} (${step.durationMs}ms)`);
    if (step.error) {
      console.log(`  error=${step.error}`);
    }
  }
  if (Object.keys(result.outputs).length > 0) {
    console.log(`outputs=${JSON.stringify(result.outputs)}`);
  }
  console.log(`artifacts=${result.artifacts.runDir}`);
}

async function executeWithOptionalRepair(plan: TestPlan, options: RunCommandOptions): Promise<RunResult> {
  const artifactsRoot = options.artifactsRoot ?? 'runs';
  const maxRepairAttempts = Number(options.repairAttempts ?? '0');
  const provider = parseProvider(options.provider);

  let currentPlan = plan;
  let result = await runPlan(currentPlan, {
    envFile: options.env,
    dryRun: options.dryRun,
    artifactsRoot
  });

  let attempt = 0;
  while (result.status === 'failed' && attempt < maxRepairAttempts && !options.dryRun) {
    const domSnippet = result.artifacts.failureDomPath
      ? await fs.readFile(result.artifacts.failureDomPath, 'utf8').catch(() => '')
      : '';

    const patch = await createRepairPatch({
      plan: currentPlan,
      runResult: result,
      domSnippet,
      lastScreenshotPath: result.artifacts.failureScreenshotPath
    }, repairAdapterForProvider(provider));

    if (patch.operations.length === 0) {
      break;
    }

    currentPlan = applyRepairPatch(currentPlan, patch);
    attempt += 1;

    const repairedPlanPath = path.join(result.artifacts.runDir, `plan.repaired.${attempt}.json`);
    await fs.writeFile(repairedPlanPath, JSON.stringify(redactPlan(currentPlan), null, 2), 'utf8');

    result = await runPlan(currentPlan, {
      envFile: options.env,
      artifactsRoot
    });
  }

  return result;
}

const program = new Command();
program.name('testair').description('AI-assisted deterministic website testing').version('0.1.0');

program
  .command('plan')
  .argument('<natural-language>', 'Natural language test description')
  .option('--url <url>', 'Optional base URL for planning')
  .option('--provider <provider>', 'AI provider: mock|openai', 'mock')
  .action(async (prompt: string, cmd: { url?: string; provider?: string }) => {
    const provider = parseProvider(cmd.provider);
    const plan = await createPlanFromPrompt({ prompt, url: cmd.url }, plannerAdapterForProvider(provider));
    console.log(JSON.stringify(redactPlan(plan), null, 2));
  });

program
  .command('run')
  .argument('<plan-json>', 'Path to plan JSON file')
  .option('--env <envFile>', 'Path to .env file')
  .option('--dry-run', 'Print compiled deterministic steps without executing browser')
  .option('--artifacts-root <dir>', 'Root output directory for run artifacts', 'runs')
  .option('--repair-attempts <n>', 'Number of constrained repair attempts after failure', '0')
  .option('--provider <provider>', 'AI provider for repair loop: mock|openai', 'mock')
  .action(async (planPath: string, cmd: RunCommandOptions) => {
    const plan = await readPlan(planPath);

    if (cmd.dryRun) {
      for (const line of compiledToDryRunLines(plan)) {
        console.log(line);
      }
    }

    const result = await executeWithOptionalRepair(plan, cmd);
    printSummary(result);
  });

program
  .command('replay')
  .argument('<runId>', 'Run ID (folder under artifacts root)')
  .option('--artifacts-root <dir>', 'Root output directory for run artifacts', 'runs')
  .action(async (runId: string, cmd: { artifactsRoot?: string }) => {
    const artifactsRoot = cmd.artifactsRoot ?? 'runs';
    const runDir = path.join(artifactsRoot, runId);
    const resultPath = path.join(runDir, 'RunResult.json');

    const raw = await fs.readFile(resultPath, 'utf8');
    const result = JSON.parse(raw) as RunResult;
    printSummary(result);
    console.log(`trace=${result.artifacts.tracePath}`);
    if (result.artifacts.failureScreenshotPath) {
      console.log(`failureScreenshot=${result.artifacts.failureScreenshotPath}`);
    }
    if (result.artifacts.failureDomPath) {
      console.log(`failureDom=${result.artifacts.failureDomPath}`);
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
