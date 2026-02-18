# testair

`testair` is an AI-assisted website testing platform that turns natural-language test intents into a validated DSL and executes them deterministically with Playwright.

## MVP Scope
- Natural language -> validated JSON DSL
- Deterministic DSL compiler + Playwright runner
- Constrained repair loop with validated patch operations
- Secrets referenced as `${SECRET:NAME}` placeholders and injected from env at runtime
- Minimal CLI and minimal REST server
- File-based artifacts (`runs/<runId>/...`) and site profiles (`runs/site-profiles/<domain>.json`)

## Repo Layout

```text
testair/
  packages/
    core/      # DSL schema, compiler, runner, artifacts, site profiles
    ai/        # planner/repair interfaces + mock adapters + patch validation
    cli/       # testair CLI (plan/run/replay)
    server/    # minimal REST API
  projects/    # per-site test projects (plans + env templates)
  examples/
  scripts/
  README.md
```

## Install

```bash
pnpm install && pnpm build
# or
npm install && npm run build
```

## Quick Demo

1. Dry run a public example (shows deterministic compiled steps):

```bash
node packages/cli/dist/index.js run examples/public-example.plan.json --dry-run
```

2. Execute the public example:

```bash
node packages/cli/dist/index.js run examples/public-example.plan.json
```

3. Replay a run summary:

```bash
node packages/cli/dist/index.js replay <runId>
```

Artifacts are stored under `runs/<runId>/`:
- `RunResult.json`
- `trace.zip`
- failure screenshot and DOM snippet on failed runs

## CLI

### Plan

```bash
node packages/cli/dist/index.js plan "go to https://example.com and verify Example Domain" --url https://example.com
# OpenAI-backed planning
OPENAI_API_KEY=... node packages/cli/dist/index.js plan "log in and create a project" --url https://app.example.com --provider openai
```

Outputs validated DSL JSON (mock planner adapter in MVP).

### Run

```bash
node packages/cli/dist/index.js run examples/public-example.plan.json --env .env --repair-attempts 1
# OpenAI-backed repair loop
OPENAI_API_KEY=... node packages/cli/dist/index.js run examples/public-example.plan.json --repair-attempts 1 --provider openai
```

Options:
- `--dry-run`: print compiled steps without browser execution
- `--env`: load env file for secret injection
- `--repair-attempts`: constrained AI repair retries
- `--artifacts-root`: override artifacts directory (default `runs`)
- `--provider`: `mock` (default) or `openai`

### Replay

```bash
node packages/cli/dist/index.js replay <runId>
```

## DSL

Top-level plan:

```json
{
  "version": "1",
  "steps": []
}
```

Supported steps:
- `goto { url }`
- `click { target, selector? }`
- `fill { field, value, selector? }`
- `expect { textVisible | urlIncludes | elementVisible, timeoutMs? }`
- `login { username, password }` (macro expanded deterministically)
- `waitFor { textVisible | selector | timeoutMs }`
- `extractTextList { selector, limit?, outputKey }` (writes structured output to `RunResult.outputs`)

Validation is enforced with Zod in `packages/core/src/schema.ts`.

## Deterministic Compiler + Runner

- Compiler in `packages/core/src/compiler.ts` expands macros and emits normalized steps.
- Runner in `packages/core/src/runner.ts` executes steps in order with stable locator heuristics:
  - role (`getByRole`), label (`getByLabel`), text (`getByText`) first
  - conservative CSS fallbacks
- Trace recording is always enabled.
- Site profile selectors are persisted per domain and reused on future runs.

## Repair Loop (Constrained)

- AI repair input includes `runResult`, optional DOM snippet, and screenshot path.
- AI output must pass strict Zod validation in `packages/ai/src/patch.ts`.
- Allowed patch paths are restricted to safe step fields only (e.g. `/steps/1/target`).
- CLI applies patch, writes repaired plan snapshot, and re-runs.

## API Server

Build server package then run:

```bash
node packages/server/dist/index.js
```

Endpoints:
- `POST /runs` body `{ plan, envRef?, metadata? }`
- `GET /runs/:id`
- `GET /runs/:id/artifacts/:name`

## AI Adapter Design

`packages/ai` defines provider-agnostic interfaces:
- `PlannerAdapter` for NL -> plan output
- `RepairAdapter` for failure -> patch output

MVP ships mock adapters:
- `MockPlannerAdapter`
- `MockRepairAdapter`

OpenAI adapter is included:
- `OpenAIPlannerAdapter`
- `OpenAIRepairAdapter`

Environment variables for OpenAI:
- `OPENAI_API_KEY` (required when `--provider openai` is used)
- `TESTAIR_OPENAI_MODEL` (optional, default `gpt-4.1-mini`)
- `OPENAI_BASE_URL` (optional)
- `TESTAIR_OPENAI_TIMEOUT_MS` (optional)

## Security Notes

- No arbitrary code execution from model outputs.
- Plans and patches are validated with Zod before execution.
- Secrets are placeholders (`${SECRET:NAME}`) in DSL and resolved from env only at runtime.
- CLI redacts secret placeholders when printing plans.
- Runner never intentionally logs resolved secret values.

## Extending Step Types

1. Add schema/type in `packages/core/src/schema.ts`.
2. Add compiler mapping in `packages/core/src/compiler.ts`.
3. Add runtime execution logic in `packages/core/src/runner.ts`.
4. Add tests in `packages/core/test` and (if relevant) `packages/ai/test`.
