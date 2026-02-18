# iby.us project

This folder holds plans and local config for testing `app.iby.us`.

## Files
- `plans/login-smoke.plan.json`: initial login smoke test
- `plans/wallet-activity-last5.plan.json`: login then report latest 5 wallet activity rows
- `.env.example`: env variable template for local `.env.local`

## Run

```bash
cp projects/iby.us/.env.example projects/iby.us/.env.local
# fill in real credentials locally

node packages/cli/dist/index.js run projects/iby.us/plans/login-smoke.plan.json --env projects/iby.us/.env.local
node packages/cli/dist/index.js run projects/iby.us/plans/wallet-activity-last5.plan.json --env projects/iby.us/.env.local
```

## Notes
- The site currently uses hCaptcha on login flows in some cases. If captcha is presented, this deterministic test may fail unless test mode/bypass is enabled for the environment.
- Secrets stay in env files and are referenced in DSL as `${SECRET:...}` placeholders.
- `wallet-activity-last5` writes extracted rows to `RunResult.outputs.walletActivityLast5`.
