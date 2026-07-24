/**
 * Generated `lib/graph-client.ts` — The Graph gateway client.
 * Uses GRAPH_API_KEY (in URL path) when set; otherwise x402 payments.
 * When 1claw is enabled: x402 signed by HSM (private key never leaves hardware).
 * When 1claw is not enabled: x402 signed with AGENT_PRIVATE_KEY.
 * @see https://thegraph.com/docs/en/subgraphs/tooling/x402-payments/
 */
export function graphClientSource(opts: {
  includeOneclaw: boolean;
  hasAmpersend: boolean;
  enableX402: boolean;
}): string {
  // --- 1claw HSM signer path ---
  const oneClawSignerBlock = `
import { createClient } from "@1claw/sdk";
import type { ClientEvmSigner } from "@x402/evm";

function getOneclawClient() {
  const baseUrl = (process.env.ONECLAW_API_BASE_URL || "https://api.1claw.xyz").replace(/\\/$/, "");
  const agentId = (process.env.ONECLAW_AGENT_ID || "").trim();
  const apiKey = (process.env.ONECLAW_AGENT_API_KEY || "").trim();
  if (!agentId || !apiKey) return null;
  return { client: createClient({ baseUrl, apiKey, agentId }), agentId };
}

let _cachedSignerPromise: Promise<ClientEvmSigner> | null = null;

/**
 * Build a ClientEvmSigner backed by 1claw HSM signing keys.
 * The private key never leaves the HSM — EIP-712 signing happens server-side.
 */
async function getOneclawSigner(): Promise<ClientEvmSigner> {
  const oc = getOneclawClient();
  if (!oc) {
    throw new Error(
      "x402 payment requires ONECLAW_AGENT_ID + ONECLAW_AGENT_API_KEY. " +
        "The 1claw signing key on Base pays for subgraph queries in USDC.",
    );
  }
  const { client, agentId } = oc;

  let keys: { address?: string; chain?: string; status?: string }[] | undefined;
  try {
  const keysRes = await client.signingKeys.list(agentId);
  if (keysRes.error) {
    throw new Error(\`Failed to list 1claw signing keys: \${keysRes.error.message}\`);
  }

  const keysData = keysRes.data as { signing_keys?: { address?: string; chain?: string; status?: string }[]; keys?: { address?: string; chain?: string; status?: string }[] };
  keys = keysData?.signing_keys || keysData?.keys;
  } catch (sdkErr) {
    const msg = sdkErr instanceof Error ? sdkErr.message : String(sdkErr);
    console.warn("[graph-client] SDK signingKeys.list failed, trying direct HTTP:", msg);

    const baseUrl = (process.env.ONECLAW_API_BASE_URL || "https://api.1claw.xyz").replace(/\\/$/, "");
    const agentApiKey = (process.env.ONECLAW_AGENT_API_KEY || "").trim();
    const tr = await fetch(baseUrl + "/v1/auth/agent-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, api_key: agentApiKey }),
    });
    if (!tr.ok) {
      throw new Error(\`1claw agent auth failed (\${tr.status}). Check ONECLAW_AGENT_ID + ONECLAW_AGENT_API_KEY.\`);
    }
    const { access_token } = (await tr.json()) as { access_token: string };

    const kr = await fetch(baseUrl + \`/v1/agents/\${agentId}/signing-keys\`, {
      headers: { Authorization: \`Bearer \${access_token}\` },
    });
    if (!kr.ok) {
      throw new Error(\`Failed to list signing keys (\${kr.status}): \${await kr.text().catch(() => "")}\`);
    }
    const krJson = (await kr.json()) as { signing_keys?: typeof keys; keys?: typeof keys; data?: { signing_keys?: typeof keys; keys?: typeof keys } };
    const kData = krJson.data || krJson;
    keys = kData?.signing_keys || kData?.keys;
  }

  const evmKey = keys?.find(
    (k) => (k.chain === "ethereum" || k.chain === "evm") && k.status === "active" && k.address,
  ) || keys?.find(
    (k) => k.status === "active" && k.address && k.address.startsWith("0x"),
  );
  if (!evmKey?.address) {
    throw new Error(
      "No active 1claw EVM signing key found. " +
        "Provision one at 1claw.xyz (chain: ethereum) and fund it with USDC on Base. " +
        "Keys returned: " + JSON.stringify(keys?.map((k) => ({ chain: k.chain, status: k.status })) || []),
    );
  }

  const address = evmKey.address as \\\`0x\${string}\\\`;

  const signer: ClientEvmSigner = {
    address,
    async signTypedData(message: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<\\\`0x\${string}\\\`> {
      const signRes = await client.agents.sign(agentId, {
        intent_type: "typed_data",
        chain: "base",
        typed_data: message,
      });
      if (signRes.error) {
        throw new Error(\`1claw x402 sign failed: \${signRes.error.message}\`);
      }
      const sig = (signRes.data as { signature?: string })?.signature;
      if (!sig) throw new Error("1claw sign returned no signature");
      return sig as \\\`0x\${string}\\\`;
    },
  };

  return signer;
}

function getCachedSigner(): Promise<ClientEvmSigner> {
  if (!_cachedSignerPromise) {
    _cachedSignerPromise = getOneclawSigner().catch((err) => {
      _cachedSignerPromise = null;
      throw err;
    });
  }
  return _cachedSignerPromise;
}

async function readVaultSecret(secretPath: string): Promise<string | null> {
  const apiBase = (process.env.ONECLAW_API_BASE_URL || "https://api.1claw.xyz").replace(/\\/$/, "");
  const vaultId = (process.env.ONECLAW_VAULT_ID || "").trim();
  if (!vaultId) return null;

  const userApiKey = (process.env.ONECLAW_API_KEY || "").trim();
  const agentId = (process.env.ONECLAW_AGENT_ID || "").trim();
  const agentApiKey = (process.env.ONECLAW_AGENT_API_KEY || "").trim();

  let token: string;
  if (userApiKey) {
    const tr = await fetch(apiBase + "/v1/auth/api-key-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: userApiKey }),
    });
    if (!tr.ok) return null;
    const j = (await tr.json()) as { access_token: string };
    token = j.access_token;
  } else if (agentId && agentApiKey) {
    const tr = await fetch(apiBase + "/v1/auth/agent-token", {
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
  const res = await fetch(apiBase + "/v1/vaults/" + vaultId + "/secrets/" + encPath, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { value?: string };
  return typeof j.value === "string" ? j.value.trim() : null;
}
`;

  // --- Non-1claw raw private key path ---
  const rawKeySignerBlock = opts.hasAmpersend
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

  const agentKey = (process.env.AGENT_PRIVATE_KEY || "").trim();
  if (agentKey) return agentKey;

  throw new Error(
    "No x402 signing key found. Set AGENT_PRIVATE_KEY (default), X402_PRIVATE_KEY, or AMPERSEND_SIGNING_KEY in .env",
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

  // Choose preamble based on whether we have 1claw
  const preamble = opts.includeOneclaw ? oneClawSignerBlock : rawKeySignerBlock;

  // x402 query function — different implementations per path
  const x402BlockOneclaw = `
/**
 * Query a subgraph via x402 payment — signed by the 1claw HSM signing key.
 * The private key never leaves the HSM. USDC on Base is the payment token.
 */
async function queryViaX402(
  subgraphId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const { x402Client, wrapFetchWithPayment } = await import("@x402/fetch");
  const { registerExactEvmScheme } = await import("@x402/evm/exact/client");

  const signer = await getCachedSigner();

  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  const fetchWithPayment = wrapFetchWithPayment(globalThis.fetch, client);

  const gateway = graphGatewayBase();
  const endpoint = \\\`\${gateway}/api/x402/subgraphs/id/\${subgraphId}\\\`;

  const response = await fetchWithPayment(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(\\\`x402 subgraph query failed: \${response.status} \${text}\\\`);
  }

  const json = (await response.json()) as { data?: unknown; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json;
}
`;

  const x402BlockRawKey = `
async function queryViaX402(
  subgraphId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const { createGraphQuery } = await import("@graphprotocol/client-x402");
  const gateway = graphGatewayBase();
  const endpoint = \\\`\${gateway}/api/x402/subgraphs/id/\${subgraphId}\\\`;
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
`;

  const x402BlockDisabled = `
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

  let x402Block: string;
  if (!opts.enableX402) {
    x402Block = x402BlockDisabled;
  } else if (opts.includeOneclaw) {
    x402Block = x402BlockOneclaw;
  } else {
    x402Block = x402BlockRawKey;
  }

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
${preamble}
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
  const res = await fetch(\\\`\${gateway}/api/\${apiKey}/subgraphs/id/\${subgraphId}\\\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (!res.ok) {
    throw new Error(\\\`Graph API key query failed: \${res.status} \${JSON.stringify(json)}\\\`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json;
}
${x402Block}
/** Run GraphQL against a subgraph — API key first, then x402 per-query USDC${opts.includeOneclaw ? " via 1claw HSM" : ""}. */
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
    console.error("[graph-client] x402 payment failed:", x402Msg);
    if (apiKeyError) console.error("[graph-client] API key also failed:", apiKeyError.message);
    throw new Error(
      \\\`Subgraph query failed. x402: \${x402Msg}\\\` +
        (apiKeyError ? \\\` | API key: \${apiKeyError.message}\\\` : ""),
    );
  }
}

/** Query a subgraph on The Graph Network (x402${opts.includeOneclaw ? " via 1claw HSM" : ""} or GRAPH_API_KEY). */
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
  const words = keyword.trim().split(/\\\\s+/);
  const broadWord = words[0].replace(/"/g, '\\\\"');
  const needsBroadSearch = words.length > 1;

  const query = \\\`{
    subgraphs(
      first: \${Math.min(first, 5)},
      where: { metadata_: { displayName_contains_nocase: "\${escaped}" } },
      orderBy: currentSignalledTokens,
      orderDirection: desc
    ) {
      id
      metadata { displayName description }
    }
    \${needsBroadSearch ? \\\`broader: subgraphs(
      first: \${first},
      where: { metadata_: { displayName_contains_nocase: "\${broadWord}" } },
      orderBy: currentSignalledTokens,
      orderDirection: desc
    ) {
      id
      metadata { displayName description }
    }\\\` : ""}
  }\\\`;

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
  const deprioritized: typeof results = [];
  for (const s of [...(json.data?.subgraphs ?? []), ...(json.data?.broader ?? [])]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const entry = { id: s.id, displayName: s.metadata?.displayName || s.id, description: s.metadata?.description || "" };
    if (/substream/i.test(entry.displayName)) {
      deprioritized.push(entry);
    } else {
      results.push(entry);
    }
  }
  return [...results, ...deprioritized].slice(0, first);
}
`;
}
