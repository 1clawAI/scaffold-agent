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
): Promise<{ id: string; apiKey: string }> {
  const res = await fetch(`${BASE_URL}/v1/agents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to register agent (${res.status}): ${body || res.statusText}`);
  }
  const json: unknown = await res.json();
  return parseAgentCreatedResponse(json);
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
  },
): Promise<OneClawResult> {
  const token = await getToken(apiKey);
  const vaultId = await createVault(token, projectName);

  await storeSecret(token, vaultId, "private-keys/deployer", deployerPrivateKey);

  let agentInfo: { id: string; apiKey: string } | undefined;

  if (agentPrivateKey) {
    await storeSecret(token, vaultId, "private-keys/agent", agentPrivateKey);
    agentInfo = await registerAgent(token, `${projectName}-agent`);
  } else if (options?.registerShroudAgent) {
    agentInfo = await registerAgent(token, `${projectName}-shroud`);
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

  return { vaultId, agentInfo };
}
