import { promises as fs } from 'node:fs';
import path from 'node:path';

import express from 'express';
import { planSchema, runPlan, type RunResult } from '@testair/core';
import { z } from 'zod';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT ?? '4000');
const ARTIFACTS_ROOT = process.env.ARTIFACTS_ROOT ?? 'runs';

const createRunBodySchema = z.object({
  plan: planSchema,
  envRef: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.string()).optional()
});

function runResultPath(runId: string): string {
  return path.join(ARTIFACTS_ROOT, runId, 'RunResult.json');
}

async function readRun(runId: string): Promise<RunResult> {
  const raw = await fs.readFile(runResultPath(runId), 'utf8');
  return JSON.parse(raw) as RunResult;
}

app.post('/runs', async (req, res) => {
  const parsed = createRunBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const runResult = await runPlan(parsed.data.plan, {
      envFile: parsed.data.envRef,
      artifactsRoot: ARTIFACTS_ROOT
    });

    res.status(201).json({
      runId: runResult.runId,
      status: runResult.status,
      resultPath: runResult.artifacts.resultPath,
      metadata: parsed.data.metadata ?? {}
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('/runs/:id', async (req, res) => {
  try {
    const run = await readRun(req.params.id);
    res.json(run);
  } catch {
    res.status(404).json({ error: 'Run not found' });
  }
});

app.get('/runs/:id/artifacts/:name', async (req, res) => {
  const runDir = path.join(ARTIFACTS_ROOT, req.params.id);
  const artifactPath = path.resolve(runDir, req.params.name);
  if (!artifactPath.startsWith(path.resolve(runDir))) {
    res.status(400).json({ error: 'Invalid artifact path' });
    return;
  }

  try {
    await fs.access(artifactPath);
    res.download(artifactPath);
  } catch {
    res.status(404).json({ error: 'Artifact not found' });
  }
});

app.listen(PORT, () => {
  console.log(`testair server listening on http://localhost:${PORT}`);
});
