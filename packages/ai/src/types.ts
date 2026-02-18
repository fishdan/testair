import type { RunResult, TestPlan } from '@testair/core';

export interface PlanRequest {
  prompt: string;
  url?: string;
}

export interface RepairRequest {
  plan: TestPlan;
  runResult: RunResult;
  domSnippet?: string;
  lastScreenshotPath?: string;
}

export interface PlannerAdapter {
  plan(request: PlanRequest): Promise<unknown>;
}

export interface RepairAdapter {
  repair(request: RepairRequest): Promise<unknown>;
}

export type AIProvider = 'mock' | 'openai';
