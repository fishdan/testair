import type { TestPlan } from './schema.js';

export type StepStatus = 'passed' | 'failed' | 'skipped';

export interface StepResult {
  index: number;
  type: string;
  description: string;
  status: StepStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  error?: string;
  artifactPaths?: string[];
}

export interface RunArtifacts {
  runDir: string;
  tracePath: string;
  resultPath: string;
  failureScreenshotPath?: string;
  failureDomPath?: string;
}

export interface RunResult {
  runId: string;
  status: 'passed' | 'failed';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  plan: TestPlan;
  steps: StepResult[];
  outputs: Record<string, string[]>;
  artifacts: RunArtifacts;
}

export interface RunOptions {
  runId?: string;
  artifactsRoot?: string;
  siteProfilesRoot?: string;
  envFile?: string;
  timeoutMs?: number;
  headless?: boolean;
  dryRun?: boolean;
}

export interface SiteProfile {
  domain: string;
  selectors: Record<string, string>;
  updatedAt: string;
}
