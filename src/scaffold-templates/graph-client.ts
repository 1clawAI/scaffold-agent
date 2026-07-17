/**
 * Generated `lib/graph-client.ts` — The Graph x402 subgraph query client.
 * Pays per-query in USDC via x402 — no API key required for small volumes.
 * Optional GRAPH_API_KEY for high-volume fallback via the hosted gateway.
 */
export function graphClientSource(opts: {
  includeOneclaw: boolean;
  hasAmpersend: boolean;
}): string {
  const keyResolution = opts.hasAmpersend
    ? `
/**
 * x402 signing key — reuses Ampersend signing key when available,
 * falls back to X402_PRIVATE_KEY env var.
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
  throw new Error(
    "No x402 signing key found. Set X402_PRIVATE_KEY or AMPERSEND_SIGNING_KEY in .env",
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

async function resolveX402Key(): Promise<string> {
  const fromEnv = (process.env.X402_PRIVATE_KEY || "").trim();
  if (fromEnv) return fromEnv;

  const fromVault = await readVaultSecret("private-keys/x402-signing");
  if (fromVault) return fromVault;

  throw new Error(
    "X402_PRIVATE_KEY not found in env or 1Claw vault (private-keys/x402-signing). " +
      "Store it: just vault private-keys/x402-signing '0x...'",
  );
}
`
      : `
async function resolveX402Key(): Promise<string> {
  const fromEnv = (process.env.X402_PRIVATE_KEY || "").trim();
  if (fromEnv) return fromEnv;

  throw new Error(
    "X402_PRIVATE_KEY is not set. Add it via .env",
  );
}
`;

  return `import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const GRAPH_GATEWAY = "https://gateway.thegraph.com";
const X402_CHAIN_ID = Number(process.env.X402_CHAIN_ID || "8453");
${keyResolution}
/**
 * Resolve optional Graph API key — for high-volume hosted gateway fallback.
 */
function resolveGraphApiKey(): string | null {
  return (process.env.GRAPH_API_KEY || "").trim() || null;
}

/**
 * Query a subgraph on The Graph Network using x402 payment.
 * Falls back to API-key gateway if GRAPH_API_KEY is set and x402 fails.
 */
export async function querySubgraph(
  subgraphId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const x402Url = \`\${GRAPH_GATEWAY}/api/subgraphs/id/\${subgraphId}\`;
  const body = JSON.stringify({ query, variables });

  try {
    const key = await resolveX402Key();
    const account = privateKeyToAccount(key as Hex);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    });

    const res = await fetch(x402Url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (res.status === 402) {
      const paymentHeader = res.headers.get("X-Payment-Request");
      if (!paymentHeader) throw new Error("402 received but no X-Payment-Request header");

      const paymentReq = JSON.parse(paymentHeader);
      const signature = await walletClient.signMessage({
        message: paymentReq.message || paymentReq.payload || "",
      });

      const payRes = await fetch(x402Url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payment": signature,
          "X-Payment-Request": paymentHeader,
        },
        body,
      });

      if (!payRes.ok) {
        throw new Error(\`Graph x402 query failed after payment: \${payRes.status} \${await payRes.text()}\`);
      }
      return await payRes.json();
    }

    if (!res.ok) throw new Error(\`Graph query failed: \${res.status}\`);
    return await res.json();
  } catch (err) {
    const apiKey = resolveGraphApiKey();
    if (!apiKey) throw err;

    const fallbackUrl = \`\${GRAPH_GATEWAY}/api/\${apiKey}/subgraphs/id/\${subgraphId}\`;
    const res = await fetch(fallbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) throw new Error(\`Graph API key fallback failed: \${res.status} \${await res.text()}\`);
    return await res.json();
  }
}

/**
 * Search for subgraphs by keyword using The Graph's explorer API.
 */
export async function searchSubgraphs(
  keyword: string,
  first = 5,
): Promise<{ id: string; displayName: string; description: string }[]> {
  const url = "https://api.thegraph.com/subgraphs/name/graphprotocol/graph-network-arbitrum";
  const query = \`{
    subgraphs(
      first: \${first},
      where: { metadata_: { displayName_contains_nocase: "\${keyword.replace(/"/g, '\\\\"')}" } },
      orderBy: currentSignalledTokens,
      orderDirection: desc
    ) {
      id
      metadata { displayName description }
      currentVersion { subgraphDeployment { ipfsHash } }
    }
  }\`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: { subgraphs?: { id: string; metadata?: { displayName?: string; description?: string }; currentVersion?: { subgraphDeployment?: { ipfsHash?: string } } }[] };
  };
  return (json.data?.subgraphs ?? []).map(s => ({
    id: s.id,
    displayName: s.metadata?.displayName || s.id,
    description: s.metadata?.description || "",
  }));
}
`;
}
