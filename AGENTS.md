# Agent instructions — scaffold-agent

This repository is the **npm CLI** that **generates** onchain-agent monorepos (Foundry/Hardhat + Next.js/Vite/Python). It is **not** a generated app; consumer projects live in folders created by the CLI.

## Terminology

- **1claw / 1Claw** — [1claw.xyz](https://1claw.xyz): vault, agents, **Shroud** LLM proxy ([Shroud docs](https://docs.1claw.xyz/docs/guides/shroud)), **Intents API** ([1claw.xyz/intents](https://1claw.xyz/intents)) for HSM/TEE transaction signing across 29+ EVM chains plus Bitcoin, Solana, XRP, Cardano, and Tron.
- **OpenClaw** — separate product ([openclaw.ai](https://openclaw.ai)); do not confuse with 1claw.
- **@1claw/mcp** — MCP server with 44 tools for vault secrets, Intents API, signing keys, treasury, and execution intents.

## Build and verify

```bash
npm install
npm run build          # tsup → dist/cli.js
node dist/cli.js --version
```

After changing **`src/cli.ts`**, **`src/cli-argv.ts`**, **`src/cli-wizard.ts`**, **`src/agent-project-config.ts`**, or **`src/actions/scaffold.ts`** (templates), **always run `npm run build`** before treating the CLI as up to date.

## Run the CLI locally

```bash
node dist/cli.js --help
node dist/cli.js my-project   # interactive; creates ./my-project under cwd
```

## Non-interactive / automation (`-y`)

Use **`-y`** / **`--non-interactive`** so no stdin prompts run (CI, scripts, other agents).

- **Required** when default **`--secrets`** is **`oneclaw`**: **`--env-password`** (≥ 6 chars), unless you set **`--secrets none`**.
- **`--defer-oneclaw-api-key`**: omit **`ONECLAW_API_KEY`** at scaffold time (vault not created until key exists).
- **`--oneclaw-intents`**: with **`-y`**, register the 1Claw API agent with **Intents** enabled ([1claw.xyz/intents](https://1claw.xyz/intents)); interactive runs ask when vault setup creates an agent.
- **`--skip-npm-install`** / **`--skip-auto-fund`**: avoid install and fund script in automation.

Minimal example (creates `./my-app` in current directory):

```bash
node dist/cli.js -y my-app \
  --env-password 'your-password-here' \
  --defer-oneclaw-api-key \
  --skip-npm-install \
  --skip-auto-fund
```

Full flag list: **`scaffold-agent --help`**.

### Config file, dump, and swarm

- **`--from-config <file>`** — Merge an **`agent.json`** (or similar) into flags; **CLI arguments override** the file. Shape: **`project`** / **`name`**, **`swarm`**, **`agents`** (map of id → preset label), **`extra`** (written as **`agent.config.extra.json`** in the generated repo), plus CLI-like keys at top level or under **`options`**. Implementation: **`src/agent-project-config.ts`**.
- **`--dump-config`** / **`--dump-config-out <file>`** — Print or write the merged **`agent.json`** shape; **secret flags are omitted** from output; unset fields use the same defaults as **`-y`**.
- **`--swarm <n>`** (1–64) — Multiple generated agent wallets; primary stays **`AGENT_ADDRESS`**; extras in **`SWARM_AGENT_KEYS_JSON`**; public roster **`packages/*/public/agents.json`**. Generated Next/Vite apps include swarm UI (**`/swarm`**, header picker). Post-scaffold: **`just swarm agents=N`** when a UI package exists.

### Shroud + `-y` validation

- **`--llm oneclaw`** with **`--secrets none`** (or non-oneclaw): set **`--oneclaw-agent-id`** and **`--oneclaw-agent-api-key`**.
- **`--shroud-billing provider_api_key`**: set **`--shroud-provider-api-key`** (vault path vs `.env` depends on **`--secrets`**).

Defaults under **`-y`** (see **`--help`**): e.g. Foundry, Next.js, 1Claw Shroud, **`token_billing`**, **`gemini-2.5-flash`** Shroud defaults in generated env where applicable.

## Code map

| Area | Path |
|------|------|
| CLI entry | `src/cli.ts` |
| Arg parsing, enums, defaults | `src/cli-argv.ts` |
| Wizard / `-y` resolution | `src/cli-wizard.ts` |
| `agent.json` merge, swarm plan, `--dump-config` JSON | `src/agent-project-config.ts` |
| File generation + template strings | `src/actions/scaffold.ts` |
| Encrypted `.env` split / AES-GCM helpers | `src/actions/env.ts` |
| 1Claw vault setup (REST `fetch`, not SDK) | `src/actions/oneclaw.ts` |
| Embedded `scripts/*.mjs` templates (fund, swarm, 1Claw, …) | `src/actions/project-scripts.ts` |
| Inquirer prompts | `src/prompts.ts` |
| Shared types | `src/types.ts` |
| Reusable page/route templates | `src/scaffold-templates/*.ts` |
| Bundled output | `dist/cli.js` (do not hand-edit) |

### Pinned versions (generated Next/Vite)

In **`src/actions/scaffold.ts`**: **`AMPERSEND_SDK_VERSION`** (`@ampersend_ai/ampersend-sdk`, when Ampersend is enabled), **`ONECLAW_SDK_VERSION`** (`@1claw/sdk` — **0.41.2**, when secrets or LLM is 1Claw), and **`SCAFFOLD_UI_*`** (`@scaffold-ui/hooks` / `components` / `debug-contracts` on Next.js). Bump those constants when releasing against new SDK/UI lines; then **`npm run build`**.

## Editing templates

Generated apps embed large template literals (e.g. Next **`app/api/chat/route.ts`**). Prefer **small, focused diffs**; match existing string style and escaping. Regenerate **`dist/`** with **`npm run build`**.

## Security

- Never commit real API keys, agent keys, or deployer private keys.
- Do not suggest pasting **Ethereum addresses** into **`ONECLAW_AGENT_ID`** (UUID only).

## Generated repos: `just reset` (1Claw)

When **`secrets`** or **`llm`** is 1Claw, scaffolds include **`just reset`** to create a **new** vault + agent after install if initial setup hit limits. It prints a **backup warning** — see the generated **`README.md`** and **`scripts/reset-1claw-setup.mjs`**.

## Unified network model (generated repos)

`scaffold.config.ts` → **`targetNetwork`** is the single source of truth for the active EVM network across UI, API routes, and AI agent tools.

- **`getActiveNetwork()`** (from `network-definitions.ts`) resolves `targetNetwork` to a `NetworkDefinition` with `rpcOverrides` applied.
- **Agent on-chain tools** (`lib/agent-onchain-tools.ts`) default `chainId` and `chain` parameters to `getActiveNetwork()`, so the AI model doesn't need to guess the chain.
- **`rpcOverrides`** (in `scaffold.config.ts`) are applied in both `getActiveNetwork()` and the agent tools helper `networkForChainId()` — any chain gets its RPC override, not just the active one.
- **`ONECLAW_CHAIN_NAMES`** maps `chainId` → 1Claw slug for all 29 EVM mainnets + testnets (e.g. `8453 → "base"`, `42161 → "arbitrum"`); intent tools default to the active network's slug.

### Network commands

| Command | Description |
|---|---|
| `just check-network` | Validate `targetNetwork` chainId exists in `deployedContracts.ts` |
| `just use-network <key>` | Rewrite `targetNetwork` in `scaffold.config.ts` and run check |
| `just start` | Runs `check-network` as a precheck (warns but does not block) |

Valid keys: `ethereum`, `base`, `sepolia`, `baseSepolia`, `polygon`, `bnb`, `localhost`.

### Implementation (this CLI)

| File | Change |
|---|---|
| `src/scaffold-templates/agent-onchain-tools.ts` | `getActiveNetwork` default, `rpcOverrides`-aware `networkForChainId`, `ONECLAW_CHAIN_NAMES` (29 mainnets + testnets), sign-only/list-keys/list-txs tools |
| `src/scaffold-templates/network-config.ts` | Re-exports `rpcOverrides` from `scaffold.config` |
| `src/actions/project-scripts.ts` | `getCheckNetworkScript()` |
| `src/actions/scaffold.ts` | `check-network` script, `use-network` / `check-network` justfile recipes, start precheck, `.cursor/mcp.json` generation |
| `src/actions/oneclaw.ts` | `shroud_enabled` + `intents_api_enabled` in `registerAgent`, HSM signing key provisioning via `/v1/agents/:id/signing-keys` |

## Further reading

- Human-oriented overview: **`README.md`**
- Cursor skill (when to load): **`.cursor/skills/scaffold-agent/SKILL.md`**
- Extra CLI / flag notes: **`.cursor/skills/scaffold-agent/reference.md`**
