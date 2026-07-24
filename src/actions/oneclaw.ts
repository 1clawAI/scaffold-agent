import type { OneClawResult } from "../types.js";

const BASE_URL = "https://api.1claw.xyz";

/** POST /v1/vaults — body is VaultResponse or occasionally wrapped. */
function parseVaultIdFromCreateResponse(json: unknown): string {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid vault create response (not an object)");
  }
  const o = json as Record<string, unknown>;
  if (typeof o.id === "string" && o.id.trim()) return o.id.trim();
  const vault = o.vault;
  if (vault && typeof vault === "object") {
    const id = (vault as { id?: string }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  const data = o.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.id === "string" && d.id.trim()) return d.id.trim();
    const innerVault = d.vault;
    if (innerVault && typeof innerVault === "object") {
      const id = (innerVault as { id?: string }).id;
      if (typeof id === "string" && id.trim()) return id.trim();
    }
  }
  throw new Error(
    `Unexpected vault create response shape: ${JSON.stringify(json).slice(0, 200)}`,
  );
}

/**
 * POST /v1/agents — OpenAPI AgentCreatedResponse: { agent: AgentResponse, api_key? }
 * (not top-level id — that was a scaffold bug that left ONECLAW_AGENT_ID blank.)
 */
function parseAgentCreatedResponse(json: unknown): { id: string; apiKey: string } {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid agent create response (not an object)");
  }
  const o = json as Record<string, unknown>;
  let id: string | undefined;
  let apiKey: string | undefined;

  const agent = o.agent;
  if (agent && typeof agent === "object") {
    const aid = (agent as { id?: string }).id;
    if (typeof aid === "string" && aid.trim()) id = aid.trim();
  }
  if (!id && typeof o.id === "string" && o.id.trim()) id = o.id.trim();
  if (typeof o.api_key === "string" && o.api_key.trim()) {
    apiKey = o.api_key.trim();
  }

  const data = o.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const innerAgent = d.agent;
    if (!id && innerAgent && typeof innerAgent === "object") {
      const aid = (innerAgent as { id?: string }).id;
      if (typeof aid === "string" && aid.trim()) id = aid.trim();
    }
    if (!apiKey && typeof d.api_key === "string" && d.api_key.trim()) {
      apiKey = d.api_key.trim();
    }
  }

  if (!id || !apiKey) {
    throw new Error(
      `Unexpected agent create response (need agent.id + api_key): ${JSON.stringify(json).slice(0, 300)}`,
    );
  }
  return { id, apiKey };
}

async function getToken(apiKey: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/v1/auth/api-key-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`1Claw auth failed (${res.status}): ${body || res.statusText}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function createVault(
  token: string,
  name: string,
): Promise<string> {
  const res = await fetch(`${BASE_URL}/v1/vaults`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      description: `Vault for ${name} agent project`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to create vault (${res.status}): ${body || res.statusText}`);
  }
  const json: unknown = await res.json();
  return parseVaultIdFromCreateResponse(json);
}

async function storeSecret(
  token: string,
  vaultId: string,
  path: string,
  value: string,
  secretType: "private_key" | "api_key" = "private_key",
) {
  const res = await fetch(
    `${BASE_URL}/v1/vaults/${vaultId}/secrets/${encodeURIComponent(path)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ value, type: secretType }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Failed to store secret at ${path} (${res.status}): ${body || res.statusText}`,
    );
  }
}

async function registerAgent(
  token: string,
  name: string,
  options?: { intentsApiEnabled?: boolean; shroudEnabled?: boolean },
): Promise<{ id: string; apiKey: string }> {
  const body: Record<string, unknown> = { name };
  if (options?.intentsApiEnabled === true) {
    body.intents_api_enabled = true;
  }
  if (options?.shroudEnabled === true) {
    body.shroud_enabled = true;
  }
  const res = await fetch(`${BASE_URL}/v1/agents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to register agent (${res.status}): ${body || res.statusText}`);
  }
  const json: unknown = await res.json();
  return parseAgentCreatedResponse(json);
}

/**
 * POST /v1/agents/:id/signing-keys — provision an HSM-backed signing key.
 * Human-only endpoint; keys are generated in the HSM and stored in __agent-keys vault.
 */
async function provisionSigningKey(
  token: string,
  agentId: string,
  chain: string,
): Promise<{ address: string; publicKey: string } | null> {
  const res = await fetch(`${BASE_URL}/v1/agents/${agentId}/signing-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chain }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, unknown>;
  const data = (json.data ?? json) as Record<string, unknown>;
  return {
    address: String(data.address || ""),
    publicKey: String(data.public_key || ""),
  };
}

/**
 * Contracts the agent must be allowed to sign EIP-712 typed data for.
 * x402 payments use EIP-3009 TransferWithAuthorization on USDC + Permit2.
 * Format: array of objects with `verifying_contract` (snake_case per 1claw API).
 */
const X402_EIP712_ALLOWLIST = [
  { verifying_contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, // USDC (Base mainnet)
  { verifying_contract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" }, // USDC (Base Sepolia)
  { verifying_contract: "0x000000000022D473030F116dDEE9F6B43aC78BA3" }, // Permit2 (all chains)
];

/**
 * PATCH /v1/agents/:id — update agent configuration.
 * Used after creation to set eip712_domain_allowlist for x402 signing.
 */
async function updateAgent(
  token: string,
  agentId: string,
  update: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/v1/agents/${agentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to update agent (${res.status}): ${body || res.statusText}`);
  }
}

export async function setupOneClaw(
  apiKey: string,
  projectName: string,
  deployerPrivateKey: string,
  agentPrivateKey?: string,
  options?: {
    llmApiKey?: string;
    /** Shroud BYOK: store at e.g. api-keys/openai */
    shroudProviderApiKey?: { path: string; value: string };
    /**
     * When true (Shroud / 1Claw LLM) and no on-chain agent wallet is provided,
     * still register a 1Claw API agent so ONECLAW_AGENT_ID + key are returned.
     */
    registerShroudAgent?: boolean;
    /** POST /v1/agents `intents_api_enabled` — https://1claw.xyz/intents */
    intentsApiEnabled?: boolean;
    /** POST /v1/agents `shroud_enabled` — enable Shroud LLM proxy for this agent */
    shroudEnabled?: boolean;
    /** Ampersend signing key from ampersend.ai — stored at private-keys/ampersend-signing */
    ampersendSigningKey?: string;
    /** The Graph API key — stored at api-keys/thegraph */
    graphApiKey?: string;
    /** Chains to provision HSM signing keys for (when Intents enabled). */
    signingChains?: string[];
  },
): Promise<OneClawResult> {
  const token = await getToken(apiKey);
  const vaultId = await createVault(token, projectName);

  await storeSecret(token, vaultId, "private-keys/deployer", deployerPrivateKey);

  let agentInfo: { id: string; apiKey: string } | undefined;

  const intents = options?.intentsApiEnabled === true;
  const shroud = options?.shroudEnabled === true;

  if (agentPrivateKey) {
    await storeSecret(token, vaultId, "private-keys/agent", agentPrivateKey);
    agentInfo = await registerAgent(token, `${projectName}-agent`, {
      intentsApiEnabled: intents,
      shroudEnabled: shroud,
    });
  } else if (options?.registerShroudAgent) {
    agentInfo = await registerAgent(token, `${projectName}-shroud`, {
      intentsApiEnabled: intents,
      shroudEnabled: shroud,
    });
  }

  if (options?.llmApiKey?.trim()) {
    await storeSecret(
      token,
      vaultId,
      "llm-api-key",
      options.llmApiKey.trim(),
      "api_key",
    );
  }

  if (options?.shroudProviderApiKey?.value.trim()) {
    await storeSecret(
      token,
      vaultId,
      options.shroudProviderApiKey.path,
      options.shroudProviderApiKey.value.trim(),
      "api_key",
    );
  }

  if (options?.ampersendSigningKey?.trim()) {
    await storeSecret(
      token,
      vaultId,
      "private-keys/ampersend-signing",
      options.ampersendSigningKey.trim(),
      "private_key",
    );
  }

  if (options?.graphApiKey?.trim()) {
    await storeSecret(
      token,
      vaultId,
      "api-keys/thegraph",
      options.graphApiKey.trim(),
      "api_key",
    );
  }

  const signingKeys: { chain: string; address: string }[] = [];
  if (agentInfo && intents && options?.signingChains?.length) {
    for (const chain of options.signingChains) {
      const sk = await provisionSigningKey(token, agentInfo.id, chain);
      if (sk?.address) signingKeys.push({ chain, address: sk.address });
    }
  }

  if (agentInfo && intents) {
    await updateAgent(token, agentInfo.id, {
      eip712_domain_allowlist: X402_EIP712_ALLOWLIST,
    });
  }

  return {
    vaultId,
    agentInfo,
    signingKeys: signingKeys.length > 0 ? signingKeys : undefined,
  };
}
