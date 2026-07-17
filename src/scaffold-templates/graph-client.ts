/**
 * Generated `lib/graph-client.ts` — The Graph gateway client.
 * Uses GRAPH_API_KEY (in URL path) when set; otherwise x402 via @graphprotocol/client-x402.
 * @see https://thegraph.com/docs/en/subgraphs/tooling/x402-payments/
 */
export function graphClientSource(opts: {
  includeOneclaw: boolean;
  hasAmpersend: boolean;
  enableX402: boolean;
}): string {
  const keyResolution = opts.hasAmpersend
    ? `
/**
 * x402 signing key — reuses Ampersend signing key when available,
 * falls back to AGENT_PRIVATE_KEY (fund with USDC on Base).
 */
async function resolveX402Key(): Promise<string> {
  const fromX402 = (process.env.X402_PRIVATE_KEY || "").trim();
  if (fromX402) return fromX402;

  const fromAmpersend = (process.env.AMPERSEND_SIGNING_KEY || "").trim();
  if (fromAmpersend) return fromAmpersend;
${opts.includeOneclaw ? `
  const { readVaultSecret } = await import("./ampersend-client");
  const fromVault = await readVaultSecret("private-keys/ampersend-signing");
  if (fromVault) return fromVault;
` : ""}
  const agentKey = (process.env.AGENT_PRIVATE_KEY || "").trim();
  if (agentKey) return agentKey;

  throw new Error(
    "No x402 signing key found. Set AGENT_PRIVATE_KEY (default), X402_PRIVATE_KEY, or AMPERSEND_SIGNING_KEY in .env",
  );
}
`
    : opts.includeOneclaw
      ? `
async function readVaultSecret(secretPath: string): Promise<string | null> {
  const base = (process.env.ONECLAW_API_BASE_URL || "https://api.1claw.xyz").replace(
    /\\/$/,
    "",
  );
  const vaultId = (process.env.ONECLAW_VAULT_ID || "").trim();
  if (!vaultId) return null;

  const userApiKey = (process.env.ONECLAW_API_KEY || "").trim();
  const agentId = (process.env.ONECLAW_AGENT_ID || "").trim();
  const agentApiKey = (process.env.ONECLAW_AGENT_API_KEY || "").trim();

  let token: string;
  if (userApiKey) {
    const tr = await fetch(base + "/v1/auth/api-key-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: userApiKey }),
    });
    if (!tr.ok) return null;
    const j = (await tr.json()) as { access_token: string };
    token = j.access_token;
  } else if (agentId && agentApiKey) {
    const tr = await fetch(base + "/v1/auth/agent-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, api_key: agentApiKey }),
    });
    if (!tr.ok) return null;
    const j = (await tr.json()) as { access_token: string };
    token = j.access_token;
  } else {
    return null;
  }

  const encPath = encodeURIComponent(secretPath);
  const res = await fetch(
    base + "/v1/vaults/" + vaultId + "/secrets/" + encPath,
    { headers: { Authorization: "Bearer " + token } },
  );
  if (!res.ok) return null;
  const j = (await res.json()) as { value?: string };
  return typeof j.value === "string" ? j.value.trim() : null;
}

/**
 * x402 payment key — defaults to the agent wallet (AGENT_PRIVATE_KEY).
 * Fund this address with USDC on Base to pay for subgraph queries.
 * Override with X402_PRIVATE_KEY or vault secret private-keys/agent.
 */
async function resolveX402Key(): Promise<string> {
  const fromX402 = (process.env.X402_PRIVATE_KEY || "").trim();
  if (fromX402) return fromX402;

  const agentKey = (process.env.AGENT_PRIVATE_KEY || "").trim();
  if (agentKey) return agentKey;

  const fromVault = await readVaultSecret("private-keys/agent");
  if (fromVault) return fromVault;

  throw new Error(
    "No x402 payment key found. AGENT_PRIVATE_KEY is the default payer — " +
      "fund it with USDC on Base. Or set X402_PRIVATE_KEY for a dedicated payer.",
  );
}
`
      : `
/**
 * x402 payment key — defaults to the agent wallet (AGENT_PRIVATE_KEY).
 * Fund this address with USDC on Base to pay for subgraph queries.
 */
async function resolveX402Key(): Promise<string> {
  const fromX402 = (process.env.X402_PRIVATE_KEY || "").trim();
  if (fromX402) return fromX402;

  const agentKey = (process.env.AGENT_PRIVATE_KEY || "").trim();
  if (agentKey) return agentKey;

  throw new Error(
    "No x402 payment key found. Set AGENT_PRIVATE_KEY (default payer — fund with USDC on Base) or X402_PRIVATE_KEY.",
  );
}
`;

  const x402Block = opts.enableX402
    ? `
async function queryViaX402(
  subgraphId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const { createGraphQuery } = await import("@graphprotocol/client-x402");
  const gateway = graphGatewayBase();
  const endpoint = \`\${gateway}/api/x402/subgraphs/id/\${subgraphId}\`;
  const privateKey = await resolveX402Key();
  const gql = createGraphQuery({
    endpoint,
    privateKey,
    chain: resolveX402Chain(),
  });
  const result = await gql(query, variables);
  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  return result;
}
`
    : `
async function queryViaX402(
  _subgraphId: string,
  _query: string,
  _variables?: Record<string, unknown>,
): Promise<unknown> {
  throw new Error(
    "x402 Graph queries are disabled. Enable --graph x402|both or set GRAPH_API_KEY from Subgraph Studio.",
  );
}
`;

  const graphApiKeyResolver = opts.includeOneclaw
    ? `
/** Studio API key — env GRAPH_API_KEY or 1Claw vault secret api-keys/thegraph. */
async function resolveGraphApiKey(): Promise<string | null> {
  const fromEnv = (process.env.GRAPH_API_KEY || "").trim();
  if (fromEnv) return fromEnv;
  return readVaultSecret("api-keys/thegraph");
}
`
    : `
async function resolveGraphApiKey(): Promise<string | null> {
  return (process.env.GRAPH_API_KEY || "").trim() || null;
}
`;

  return `/** The Graph Network registry subgraph (Arbitrum) — used for keyword search. */
const GRAPH_NETWORK_SUBGRAPH_ID = "DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp";
${keyResolution}
${graphApiKeyResolver}
/** base (mainnet) or base-sepolia (testnet) — matches The Graph x402 docs (X402_CHAIN). */
function resolveX402Chain(): "base" | "base-sepolia" {
  const chain = (process.env.X402_CHAIN || "").trim().toLowerCase();
  if (chain === "base-sepolia" || chain === "base_sepolia") return "base-sepolia";
  if (chain === "base") return "base";
  const id = Number(process.env.X402_CHAIN_ID || "8453");
  return id === 84532 ? "base-sepolia" : "base";
}

function graphGatewayBase(): string {
  return resolveX402Chain() === "base-sepolia"
    ? "https://testnet.gateway.thegraph.com"
    : "https://gateway.thegraph.com";
}

async function queryViaApiKey(
  subgraphId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown | null> {
  const apiKey = await resolveGraphApiKey();
  if (!apiKey) return null;

  const gateway = graphGatewayBase();
  const res = await fetch(\`\${gateway}/api/\${apiKey}/subgraphs/id/\${subgraphId}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (!res.ok) {
    throw new Error(\`Graph API key query failed: \${res.status} \${JSON.stringify(json)}\`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json;
}
${x402Block}
/** Run GraphQL against a subgraph — API key first, then x402 per-query USDC. */
async function runGraphQL(
  subgraphId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  let apiKeyError: Error | null = null;
  try {
    const viaKey = await queryViaApiKey(subgraphId, query, variables);
    if (viaKey !== null) return viaKey;
  } catch (err) {
    apiKeyError = err instanceof Error ? err : new Error(String(err));
    if (!(await resolveGraphApiKey())) throw err;
  }

  try {
    return await queryViaX402(subgraphId, query, variables);
  } catch (x402Err) {
    const x402Msg = x402Err instanceof Error ? x402Err.message : String(x402Err);
    const isNoAllocations = apiKeyError?.message?.includes("no allocations");
    const isPaymentRequired = apiKeyError?.message?.includes("402") || x402Msg.includes("402");
    if (isNoAllocations || isPaymentRequired) {
      throw new Error(
        "This subgraph is x402-only (no indexer allocations for API key queries). " +
        "Either fund the agent wallet with USDC on Base for x402 payments, or try a different " +
        "subgraph for the same protocol — search with a broader keyword like just the protocol " +
        'name (e.g. "uniswap" instead of "Uniswap V3") to find alternatives that work with API keys.',
      );
    }
    throw x402Err;
  }
}

/** Query a subgraph on The Graph Network (x402 or GRAPH_API_KEY). */
export async function querySubgraph(
  subgraphId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  return runGraphQL(subgraphId, query, variables);
}

/** Search subgraphs by keyword via the Graph Network registry subgraph. */
export async function searchSubgraphs(
  keyword: string,
  first = 8,
): Promise<{ id: string; displayName: string; description: string }[]> {
  const escaped = keyword.replace(/"/g, '\\\\"');
  const words = keyword.trim().split(/\\s+/);
  const broadWord = words[0].replace(/"/g, '\\\\"');
  const needsBroadSearch = words.length > 1;

  const query = \`{
    subgraphs(
      first: \${Math.min(first, 5)},
      where: { metadata_: { displayName_contains_nocase: "\${escaped}" } },
      orderBy: currentSignalledTokens,
      orderDirection: desc
    ) {
      id
      metadata { displayName description }
    }
    \${needsBroadSearch ? \`broader: subgraphs(
      first: \${first},
      where: { metadata_: { displayName_contains_nocase: "\${broadWord}" } },
      orderBy: currentSignalledTokens,
      orderDirection: desc
    ) {
      id
      metadata { displayName description }
    }\` : ""}
  }\`;

  const json = (await runGraphQL(GRAPH_NETWORK_SUBGRAPH_ID, query)) as {
    data?: {
      subgraphs?: {
        id: string;
        metadata?: { displayName?: string; description?: string };
      }[];
      broader?: {
        id: string;
        metadata?: { displayName?: string; description?: string };
      }[];
    };
  };

  const seen = new Set<string>();
  const results: { id: string; displayName: string; description: string }[] = [];
  for (const s of json.data?.subgraphs ?? []) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    results.push({ id: s.id, displayName: s.metadata?.displayName || s.id, description: s.metadata?.description || "" });
  }
  for (const s of json.data?.broader ?? []) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    results.push({ id: s.id, displayName: s.metadata?.displayName || s.id, description: s.metadata?.description || "" });
  }
  return results.slice(0, first);
}
`;
}
