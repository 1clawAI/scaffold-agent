@AGENTS.md

## Claude Code

- Prefer **concise** edits; keep new top-level doc sections short (Claude docs suggest keeping CLAUDE.md lean).
- For behavior and flags, treat **`AGENTS.md`** as source of truth; run **`npm run build`** after TypeScript changes under **`src/`** (including **`src/agent-project-config.ts`**).
- Use **`scaffold-agent --help`** (or **`node dist/cli.js --help`**) when verifying CLI flags rather than guessing.
- **Plan / careful mode** for wide template changes in **`src/actions/scaffold.ts`** (large generated strings, easy to break escaping).
