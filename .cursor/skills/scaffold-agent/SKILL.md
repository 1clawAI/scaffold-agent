---
name: scaffold-agent
description: >-
  Scaffolds onchain AI agent monorepos via the scaffold-agent CLI (npx scaffold-agent).
  Covers non-interactive -y flags, Shroud/1claw options, npm run build after editing
  src/cli-argv.ts, cli-wizard.ts, or scaffold.ts. Use when the user scaffolds agents,
  modifies this CLI repo, or asks about scaffold-agent flags, templates, or 1claw Shroud.
---

# scaffold-agent (this repo)

## What this is

The **published CLI** under **`scaffold-agent`** on npm. It **writes** a new directory (Next/Vite/Python + optional Foundry/Hardhat). Working on **this** repo means changing the **generator**, not a single deployed dApp.

## Before you change code

1. Read **`AGENTS.md`** in the repo root (architecture, maps, security).
2. After edits under **`src/`**, run **`npm run build`**.

## Bootstrap a project (non-interactive)

```bash
npx scaffold-agent@latest -y PROJECT_DIR \
  --env-password 'MIN_SIX_CHARS' \
  --defer-oneclaw-api-key \
  --skip-npm-install \
  --skip-auto-fund
```

Adjust **`--secrets`**, **`--llm`**, **`--shroud-*`**, **`--chain`**, **`--framework`** as needed. Unknown CLI flags **error** (strict parsing).

## Where logic lives

- **`src/cli-argv.ts`** — `parseArgs`, defaults for **`-y`**
- **`src/cli-wizard.ts`** — **`gatherWizardInputs`**
- **`src/actions/scaffold.ts`** — generated file contents

## More detail

See [reference.md](reference.md) for quick flag reminders and links.
