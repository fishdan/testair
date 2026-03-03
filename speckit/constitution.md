# Testair Spec-Kit Constitution

Status: Active
Version: 1.0.0
Last Updated: 2026-03-03

## 1. Purpose And Scope

This constitution governs all product, code, and test changes in `testair`.

`testair` exists to provide deterministic, AI-assisted website testing where natural-language intent is transformed into validated DSL and executed via Playwright with constrained repair.

Every change MUST be tied to an approved spec-kit task. Work outside an approved task is prohibited.

## 2. Product Intent And Non-Goals

### 2.1 Product Intent (MUST)

- Preserve deterministic behavior from DSL validation through execution.
- Keep AI outputs constrained and schema-validated before execution.
- Maintain traceable run artifacts and replayable outcomes.
- Keep secrets injection runtime-only via placeholder-based references.

### 2.2 Non-Goals (MUST NOT)

- No arbitrary code execution from AI outputs.
- No unvalidated DSL or patch execution.
- No secret value logging, persistence, or commit to repository files.
- No feature additions that bypass artifacts, validation, or deterministic execution paths.

## 3. Governance Rules

### 3.1 Task Gating (MUST)

- Every code change MUST reference a spec-kit task ID and acceptance criteria.
- If no task exists, implementation MUST stop until a task is defined.
- Off-scope requests MUST be rejected or converted into new tasks before work continues.

### 3.2 Completion Criteria (MUST)

A task is complete only when:

- Acceptance criteria are met.
- Required tests (including module-level regression suites) are green.
- Relevant docs are updated.
- `progress.ai` contains a dated summary of decisions, files changed, and test outcomes.

## 4. Architecture And Security Invariants

### 4.1 Core System Invariants (MUST)

- `packages/core` remains source of truth for DSL schema/compiler/runner behavior.
- `packages/ai` remains provider-agnostic and constrained by schema-validated interfaces.
- CLI/server MUST consume shared core/ai contracts rather than forking behavior.

### 4.2 Security Invariants (MUST)

- Secrets remain `${SECRET:NAME}` placeholders in plans and resolve only at runtime.
- Logs and artifacts MUST NOT expose resolved secret values.
- Patch operations MUST stay constrained to approved safe paths.

## 5. Testing Constitution (Enforceable)

### 5.1 Test Unit Model (MUST)

- The atomic reusable artifact is a `test step` (example: `register`, `login`, `change_address`).
- Each step MUST define a contract:
  - `inputs`: required data/state.
  - `outputs`: produced data for downstream steps.
  - `preconditions`: required session/app state.
  - `postconditions`: state guarantees after completion.

### 5.2 Execution Model (MUST)

- Regression suites MUST execute `test modules`, not standalone steps.
- A `test module` is an ordered chain of steps with explicit data passing from one step to the next.
- Step chaining MUST support context handoff (for example authorization/session/user identifiers).
- Browser/session reuse across chained steps is allowed and encouraged when it improves realism and speed.
- Reused browser/session state MUST be intentional and documented in the module definition.

### 5.3 Isolation And Reusability (MUST)

- Each step MUST be independently invocable in a valid precondition context.
- Steps MUST NOT embed hardcoded dependency on unrelated steps.
- Modules MAY reuse any compatible step as long as contracts are satisfied.

### 5.4 Regression Coverage Policy (MUST)

- New feature work MUST ship with:
  - New or updated reusable step(s), and
  - At least one module that includes the new behavior in a realistic flow.
- Bug fixes MUST include a regression module update that fails before the fix and passes after.
- Coverage growth is cumulative through module composition; one-off ad hoc tests are prohibited as final coverage artifacts.

### 5.5 Prohibited Testing Patterns (MUST NOT)

- No monolithic end-to-end tests that cannot be decomposed into reusable steps.
- No suites that report coverage only through isolated single-step executions.
- No hidden state transfer between steps; all shared state MUST be explicit in context objects or documented session sharing.

## 6. Quality Gates For PRs

A PR MUST NOT merge unless all are true:

- Task scope matches an approved spec-kit task.
- Lint/typecheck/tests pass for touched packages.
- Module-level regression tests for impacted behavior pass.
- Determinism and security invariants are preserved.
- `progress.ai` updated with dated implementation notes and results.

## 7. Documentation And Traceability

- `progress.ai` MUST be updated during work, not retroactively only at the end.
- Updates MUST include: decisions, touched files, test results, and unresolved risks.
- Major features MAY have dedicated files under `progress/features/` when history is deep.

## 8. Amendment Rules

- Constitution changes require a dedicated spec-kit task and explicit rationale.
- Any amendment MUST preserve deterministic execution and constrained AI behavior.
- If there is conflict between convenience and this constitution, this constitution wins.

## 9. Version Control Discipline

### 9.1 Branch Requirement (MUST)

- All implementation work MUST be done on a non-`main` branch.
- Direct commits to `main` are prohibited.
- Completed task work MUST be merged back into `main`.

### 9.2 Clean Main Requirement (MUST)

- A new work branch MUST NOT be created if `main` has uncommitted, staged, or untracked changes.
- Before branch creation, `main` MUST be clean (`git status` shows no local changes).
- If `main` is dirty, work MUST stop until changes are committed, stashed, or removed through an explicit decision.

### 9.3 Branch Hygiene (MUST)

- Each branch MUST map to a specific approved spec-kit task.
- Branch names SHOULD reflect task intent (for example `task/<id>-<slug>`).
- A branch MUST NOT include unrelated changes outside its task scope.
