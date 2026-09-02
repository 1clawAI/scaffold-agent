export type SecretsMode = "oneclaw" | "encrypted" | "none";
export type ChainFramework = "foundry" | "hardhat" | "none";
export type AppFramework = "nextjs" | "vite" | "python";
export type LlmProvider = "oneclaw" | "gemini" | "openai" | "anthropic";

/** Upstream LLM Shroud proxies to — see https://docs.1claw.co/docs/guides/shroud */
export type ShroudUpstreamProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "gemini"
  | "mistral"
  | "cohere"
  | "openrouter"
  | "darkbloom"
  | "venice";

/** How Shroud pays upstream LLM providers — user-declared during setup */
export type ShroudBillingMode = "token_billing" | "provider_api_key";

/** Chains supported by 1Claw HSM signing key provisioning (POST /v1/agents/:id/signing-keys). */
export type OneclawSigningChain = "ethereum" | "bitcoin" | "solana" | "xrp" | "cardano" | "tron";

export interface SecretsConfig {
  mode: SecretsMode;
  apiKey?: string;
  envPassword?: string;
}

export interface WalletInfo {
  address: string;
  privateKey: string;
}

/** One generated swarm wallet (index 0 is primary AGENT_ADDRESS / AGENT_PRIVATE_KEY). */
export interface SwarmAgentDef {
  id: string;
  address: string;
  privateKey: string;
  /** Optional tag from `agent.json` `agents` map (e.g. preset label). */
  preset?: string;
}

export interface IdentityConfig {
  generateAgent: boolean;
  agentAddress?: string;
  agentPrivateKey?: string;
  /** When length > 1, extras beyond [0] live in SWARM_AGENT_KEYS_JSON. */
  swarmAgents?: SwarmAgentDef[];
}

export interface DeployerConfig {
  address: string;
  privateKey: string;
}

export interface OneClawResult {
  vaultId: string;
  agentInfo?: { id: string; apiKey: string };
  /** HSM-provisioned signing key addresses keyed by chain (when Intents enabled). */
  signingKeys?: { chain: string; address: string }[];
}

/** The Graph subgraph data access — MCP for dev IDE, x402 for runtime agent, or both. */
export type GraphIntegration = "none" | "mcp" | "x402" | "both";

export interface ScaffoldConfig {
  projectName: string;
  secrets: SecretsConfig;
  identity: IdentityConfig;
  /** Add @ampersend_ai/ampersend-sdk (Next/Vite) + AMPERSEND.md; see https://docs.ampersend.ai */
  installAmpersendSdk: boolean;
  /** The Graph subgraph integration — MCP (IDE), x402 agent tool (runtime), or both. */
  graphIntegration: GraphIntegration;
  deployer: DeployerConfig;
  chain: ChainFramework;
  framework: AppFramework;
  llm: LlmProvider;
  /** Set when llm === "oneclaw" — Shroud X-Shroud-Provider header */
  shroudUpstream?: ShroudUpstreamProvider;
  /** Set when llm === "oneclaw" — Token Billing vs own key in vault / .env */
  shroudBillingMode?: ShroudBillingMode;
  oneClawVaultId?: string;
  /**
   * When true, the 1Claw API agent created during `setupOneClaw` was registered with
   * `intents_api_enabled` (TEE signing — https://1claw.co/intents). Reflected in README only.
   */
  oneclawIntentsEnabled?: boolean;
  /** Opaque blob from `agent.json` `extra` (passed to templates / future use). */
  agentConfigExtra?: unknown;
}
