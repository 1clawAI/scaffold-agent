/**
 * Generated `packages/nextjs/lib/agent-onchain-tools.ts` — Vercel AI SDK `tool`s for
 * deployed contracts (viem) and optional 1Claw Intents (@1claw/sdk).
 */

/** True when generated app includes `@1claw/sdk` (1Claw LLM and/or vault secrets). */
export function agentOnchainToolsModuleSource(includeOneclawSdk: boolean, includeAmpersend: boolean = false, includeGraph: boolean = false): string {
  const ampersendImport = includeAmpersend
    ? `import { getPaymentFetch } from "@/lib/ampersend-client";
`
    : "";
  const graphImport = includeGraph
    ? `import { querySubgraph, searchSubgraphs } from "@/lib/graph-client";
`
    : "";
  const oneclawImport = includeOneclawSdk
    ? `import { createClient } from "@1claw/sdk";
`
    : "";
  const oneclawClientFn = includeOneclawSdk
    ? `
function getOneclawAgentClient() {
  const baseUrl = (process.env.ONECLAW_API_BASE_URL || "https://api.1claw.co").replace(
    /\\/$/,
    "",
  );
  const agentId = (process.env.ONECLAW_AGENT_ID || "").trim();
  const apiKey = (process.env.ONECLAW_AGENT_API_KEY || "").trim();
  if (!agentId || !apiKey) return null;
  return createClient({ baseUrl, apiKey, agentId });
}
`
    : "";

  const oneclawChainMapBlock = includeOneclawSdk
    ? `
const ONECLAW_CHAIN_NAMES: Record<number, string> = {
  // Mainnets (29 EVM chains supported by 1Claw Intents API)
  1: "ethereum",
  10: "optimism",
  25: "cronos",
  56: "bnb",
  100: "gnosis",
  137: "polygon",
  146: "sonic",
  250: "fantom",
  324: "zksync",
  480: "world-chain",
  1088: "metis",
  1101: "polygon-zkevm",
  1284: "moonbeam",
  1329: "sei",
  5000: "mantle",
  8217: "kaia",
  8453: "base",
  34443: "mode",
  42161: "arbitrum",
  42170: "arbitrum-nova",
  42220: "celo",
  43114: "avalanche",
  59144: "linea",
  80094: "berachain",
  81457: "blast",
  167000: "taiko",
  534352: "scroll",
  7777777: "zora",
  4663: "robinhood",
  // Testnets
  11155111: "sepolia",
  84532: "base-sepolia",
  5042002: "arc-testnet",
  46630: "robinhood-testnet",
  // Local
  31337: "localhost",
};

function oneclawChainForActive(): string {
  const active = getActiveNetwork();
  return ONECLAW_CHAIN_NAMES[active.chainId] || "ethereum";
}
`
    : "";

  const walletEnsToolsBlock = `,
    list_project_addresses: tool({
      description:
        "List configured project wallet addresses from .env (agent + deployer). Use before get_wallet_balance when the user says 'my wallet'.",
      parameters: z.object({}),
      execute: async () => {
        const addrs = getProjectAddresses();
        return {
          activeChainId: active.chainId,
          activeNetwork: active.key,
          ...addrs,
        };
      },
    }),
    get_wallet_balance: tool({
      description:
        "Get native currency and configured ERC-20 token balances for an address on a scaffold network. Defaults to the agent wallet, then deployer. Use for 'check my balance' requests.",
      parameters: z.object({
        address: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/i)
          .optional()
          .describe("Explicit 0x address. Overrides wallet."),
        wallet: z
          .enum(["agent", "deployer"])
          .optional()
          .describe("Project wallet from .env when address is omitted."),
        chainId: z
          .number()
          .optional()
          .describe("EVM chain id. Defaults to active network in scaffold.config."),
      }),
      execute: async ({ address, wallet, chainId }) => {
        const resolvedChainId = chainId ?? active.chainId;
        let target = address;
        if (!target) {
          const addrs = getProjectAddresses();
          if (wallet === "deployer") target = addrs.deployerAddress ?? undefined;
          else if (wallet === "agent") target = addrs.agentAddress ?? undefined;
          else target = addrs.agentAddress ?? addrs.deployerAddress ?? undefined;
        }
        if (!target) {
          return {
            error:
              "No address — set AGENT_ADDRESS or DEPLOYER_ADDRESS in .env, or pass address.",
          };
        }
        return fetchWalletBalances(target as Address, resolvedChainId);
      },
    }),
    resolve_ens: tool({
      description:
        "Resolve ENS names to addresses or reverse-resolve addresses to .eth names on Ethereum mainnet.",
      parameters: z.object({
        name: z
          .string()
          .optional()
          .describe("ENS name, e.g. vitalik.eth"),
        address: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/i)
          .optional()
          .describe("Address for reverse ENS lookup"),
      }),
      execute: async ({ name, address }) => {
        if (!name && !address) {
          return { error: "Provide name (forward) or address (reverse)." };
        }
        try {
          if (name) {
            const normalized = normalize(name);
            const resolved = await getEnsAddress(ensPublicClient, { name: normalized });
            return { name: normalized, address: resolved };
          }
          const ensName = await getEnsName(ensPublicClient, {
            address: address as Address,
          });
          return { address, name: ensName };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { error: msg };
        }
      },
    }),
    lookup_erc8004_agents: tool({
      description:
        "Search the ERC-8004 agent registry (Agent0) for agents owned by project wallets on the active network.",
      parameters: z.object({
        address: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/i)
          .optional()
          .describe("Owner address; defaults to agent + deployer from .env"),
      }),
      execute: async ({ address }) => {
        const owners: string[] = [];
        if (address) {
          owners.push(address);
        } else {
          const addrs = getProjectAddresses();
          if (addrs.agentAddress) owners.push(addrs.agentAddress);
          if (addrs.deployerAddress) owners.push(addrs.deployerAddress);
        }
        if (owners.length === 0) {
          return { error: "No owner address — pass address or set AGENT_ADDRESS / DEPLOYER_ADDRESS." };
        }
        try {
          const { SDK } = await import("agent0-sdk");
          const sdk = new SDK({
            chainId: active.chainId,
            rpcUrl: active.rpcUrl,
          });
          const agents = await sdk.searchAgents({
            owners,
            chains: [active.chainId],
          });
          return { chainId: active.chainId, owners, agents };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { error: msg };
        }
      },
    })`;

  const oneclawSigningBalanceTool = includeOneclawSdk
    ? `,
    oneclaw_check_signing_balances: tool({
      description:
        "List 1Claw HSM signing keys and their on-chain native + token balances on the active network.",
      parameters: z.object({}),
      execute: async () => {
        const client = getOneclawAgentClient();
        const agentId = (process.env.ONECLAW_AGENT_ID || "").trim();
        if (!client || !agentId) {
          return { error: "Missing ONECLAW_AGENT_ID or ONECLAW_AGENT_API_KEY." };
        }
        const res = await client.signingKeys.list(agentId);
        if (res.error) {
          return { error: res.error.message, type: res.error.type };
        }
        const keys = (res.data as { signing_keys?: { address?: string; chain?: string }[] })
          ?.signing_keys;
        if (!Array.isArray(keys) || keys.length === 0) {
          return { activeChainId: active.chainId, signingKeys: [] };
        }
        const signingKeys = [];
        for (const key of keys) {
          const addr = key.address;
          if (typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/i.test(addr)) {
            const balance = await fetchWalletBalances(addr as Address, active.chainId);
            signingKeys.push({ ...key, balance });
          } else {
            signingKeys.push({ ...key, balance: { error: "No valid address on key" } });
          }
        }
        return { activeChainId: active.chainId, signingKeys };
      },
    })`
    : "";

  const oneclawToolsBlock = includeOneclawSdk
    ? `,
    oneclaw_intent_simulate: tool({
      description:
        "Simulate an EVM transaction via 1Claw Intents + Tenderly (no signing). Requires ONECLAW_AGENT_ID, ONECLAW_AGENT_API_KEY, and intents enabled for the agent. See https://1claw.co/intents",
      parameters: z.object({
        chain: z
          .string()
          .optional()
          .describe("1Claw chain name, e.g. base, sepolia, ethereum. Defaults to active network."),
        to: z.string().regex(/^0x[a-fA-F0-9]{40}$/i),
        valueEther: z
          .string()
          .describe("ETH value as a decimal string, e.g. 0 or 0.01"),
        data: z
          .string()
          .regex(/^0x[a-fA-F0-9]*$/i)
          .optional()
          .describe("Optional contract calldata (0x-prefixed hex)"),
      }),
      execute: async ({ chain, to, valueEther, data }) => {
        const client = getOneclawAgentClient();
        const agentId = (process.env.ONECLAW_AGENT_ID || "").trim();
        if (!client || !agentId) {
          return {
            error:
              "Missing ONECLAW_AGENT_ID or ONECLAW_AGENT_API_KEY — cannot call Intents API.",
          };
        }
        const resolvedChain = chain || oneclawChainForActive();
        const valueWei = parseEther(valueEther || "0").toString();
        const res = await client.agents.simulateTransaction(agentId, {
          chain: resolvedChain,
          to,
          value: valueWei,
          data: data || "0x",
        });
        if (res.error) {
          return { error: res.error.message, type: res.error.type };
        }
        return res.data;
      },
    }),
    oneclaw_intent_submit: tool({
      description:
        "Submit a transaction intent to 1Claw — signing and optional broadcast happen in the TEE (keys never in the model). Requires ONECLAW_AGENT_ID, ONECLAW_AGENT_API_KEY, and intents_api_enabled on the agent. See https://1claw.co/intents",
      parameters: z.object({
        chain: z
          .string()
          .optional()
          .describe("1Claw chain name. Defaults to active network."),
        to: z.string().regex(/^0x[a-fA-F0-9]{40}$/i),
        valueEther: z.string().describe("ETH value as a decimal string, e.g. 0 or 0.05"),
        data: z
          .string()
          .regex(/^0x[a-fA-F0-9]*$/i)
          .optional(),
        simulate_first: z.boolean().optional().describe("If true, simulate before signing"),
      }),
      execute: async ({ chain, to, valueEther, data, simulate_first }) => {
        const client = getOneclawAgentClient();
        const agentId = (process.env.ONECLAW_AGENT_ID || "").trim();
        if (!client || !agentId) {
          return {
            error:
              "Missing ONECLAW_AGENT_ID or ONECLAW_AGENT_API_KEY — cannot call Intents API.",
          };
        }
        const resolvedChain = chain || oneclawChainForActive();
        const valueWei = parseEther(valueEther || "0").toString();
        const res = await client.agents.submitTransaction(
          agentId,
          {
            chain: resolvedChain,
            to,
            value: valueWei,
            data: data || "0x",
            simulate_first: simulate_first ?? true,
          },
        );
        if (res.error) {
          return { error: res.error.message, type: res.error.type };
        }
        return res.data;
      },
    }),
    oneclaw_intent_sign_only: tool({
      description:
        "Sign an EVM transaction via 1Claw without broadcasting (BYORPC). Returns the raw signed_tx hex and tx_hash. Use for MEV protection, custom relayers, or manual broadcast. See https://1claw.co/intents",
      parameters: z.object({
        chain: z
          .string()
          .optional()
          .describe("1Claw chain name. Defaults to active network."),
        to: z.string().regex(/^0x[a-fA-F0-9]{40}$/i),
        valueEther: z.string().describe("ETH value as a decimal string"),
        data: z
          .string()
          .regex(/^0x[a-fA-F0-9]*$/i)
          .optional(),
      }),
      execute: async ({ chain, to, valueEther, data }) => {
        const client = getOneclawAgentClient();
        const agentId = (process.env.ONECLAW_AGENT_ID || "").trim();
        if (!client || !agentId) {
          return { error: "Missing ONECLAW_AGENT_ID or ONECLAW_AGENT_API_KEY." };
        }
        const resolvedChain = chain || oneclawChainForActive();
        const valueWei = parseEther(valueEther || "0").toString();
        const res = await client.agents.signTransaction(agentId, {
          chain: resolvedChain,
          to,
          value: valueWei,
          data: data || "0x",
        });
        if (res.error) {
          return { error: res.error.message, type: res.error.type };
        }
        return res.data;
      },
    }),
    oneclaw_list_signing_keys: tool({
      description:
        "List the agent's HSM-backed signing keys (address, chain, status) provisioned via 1Claw.",
      parameters: z.object({}),
      execute: async () => {
        const client = getOneclawAgentClient();
        const agentId = (process.env.ONECLAW_AGENT_ID || "").trim();
        if (!client || !agentId) {
          return { error: "Missing ONECLAW_AGENT_ID or ONECLAW_AGENT_API_KEY." };
        }
        const res = await client.signingKeys.list(agentId);
        if (res.error) {
          return { error: res.error.message, type: res.error.type };
        }
        return res.data;
      },
    }),
    oneclaw_list_transactions: tool({
      description:
        "List recent 1Claw Intents transactions for this agent (tx_hash, chain, status, value).",
      parameters: z.object({}),
      execute: async () => {
        const client = getOneclawAgentClient();
        const agentId = (process.env.ONECLAW_AGENT_ID || "").trim();
        if (!client || !agentId) {
          return { error: "Missing ONECLAW_AGENT_ID or ONECLAW_AGENT_API_KEY." };
        }
        const res = await client.agents.listTransactions(agentId);
        if (res.error) {
          return { error: res.error.message, type: res.error.type };
        }
        return res.data;
      },
    })${oneclawSigningBalanceTool}`
    : "";

  const ampersendToolsBlock = includeAmpersend
    ? `,
    x402_paid_fetch: tool({
      description:
        "Fetch a URL that requires x402 payment. Automatically handles the 402 Payment Required flow: signs a USDC payment via the Ampersend wallet and retries the request. Use for any API behind an x402 paywall (e.g. https://httpay.xyz/api/market-mood). Requires AMPERSEND_SIGNING_KEY.",
      parameters: z.object({
        url: z.string().url().describe("The full URL to fetch (must be HTTPS)"),
        method: z
          .enum(["GET", "POST", "PUT", "DELETE"])
          .optional()
          .describe("HTTP method. Defaults to GET."),
        body: z
          .string()
          .optional()
          .describe("Request body as JSON string (for POST/PUT)"),
        headers: z
          .record(z.string())
          .optional()
          .describe("Extra headers to include"),
      }),
      execute: async ({ url, method, body, headers }) => {
        try {
          const payFetch = await getPaymentFetch();
          const init: RequestInit = { method: method || "GET" };
          if (body) {
            init.body = body;
            init.headers = { "Content-Type": "application/json", ...headers };
          } else if (headers) {
            init.headers = headers;
          }
          const res = await payFetch(url, init);
          const contentType = res.headers.get("content-type") || "";
          const text = await res.text();
          if (!res.ok) {
            return {
              error: \`HTTP \${res.status} \${res.statusText}\`,
              body: text.slice(0, 4000),
            };
          }
          if (contentType.includes("application/json")) {
            try {
              return { status: res.status, data: JSON.parse(text) };
            } catch {
              return { status: res.status, data: text.slice(0, 4000) };
            }
          }
          return { status: res.status, data: text.slice(0, 4000) };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { error: msg };
        }
      },
    })`
    : "";

  const graphToolsBlock = includeGraph
    ? `,
    graph_search_subgraphs: tool({
      description:
        "Search The Graph Network for subgraphs by keyword. Returns subgraph IDs, display names, and descriptions. Use this to discover subgraphs before querying them with graph_subgraph_query.",
      parameters: z.object({
        keyword: z.string().describe("Search keyword (protocol name, e.g. 'uniswap', 'aave', 'ens')"),
        first: z.number().optional().describe("Max results to return (default 5)"),
      }),
      execute: async ({ keyword, first }) => {
        try {
          const results = await searchSubgraphs(keyword, first ?? 5);
          if (results.length === 0) return { results: [], message: "No subgraphs found for that keyword" };
          return { results };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { error: msg };
        }
      },
    }),
    graph_subgraph_query: tool({
      description:
        "Query a subgraph on The Graph Network using GraphQL. Some subgraphs work with the project API key; newer Substreams-powered subgraphs require x402 USDC payment. If a query returns 402, try a different subgraph for the same protocol (e.g. prefer 'Uniswap-V3' over 'Substreams Uniswap v3'). Use graph_search_subgraphs first to find the subgraph ID. When presenting results to the user, format them as a clean readable table — convert timestamps to dates, round USD to 2 decimals, and show swaps as 'sold X TOKEN → bought Y TOKEN'.",
      parameters: z.object({
        subgraphId: z.string().describe("The subgraph ID from The Graph (e.g. from graph_search_subgraphs results)"),
        query: z.string().describe("GraphQL query string"),
        variables: z
          .string()
          .optional()
          .describe("JSON-encoded variables for the GraphQL query"),
      }),
      execute: async ({ subgraphId, query, variables }) => {
        try {
          const vars = variables ? JSON.parse(variables) : undefined;
          const result = await querySubgraph(subgraphId, query, vars);
          const cleaned = JSON.stringify(result)
            .replace(/0x[a-fA-F0-9]{40,}/g, (m) => m.slice(0, 10) + "…" + m.slice(-6))
            .replace(/"(amountUSD|amount0|amount1)":"(-?\\d+\\.\\d{2})\\d+"/g, '"$1":"$2"')
            .replace(/"timestamp":"(\\d+)"/g, (_, ts) => \`"timestamp":"\${new Date(Number(ts) * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC"\`);
          return { data: JSON.parse(cleaned) };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { error: msg };
        }
      },
    })`
    : "";

  return `import { tool } from "ai";
import { z } from "zod";
import {
  createPublicClient,
  http,
  parseEther,
  formatUnits,
  erc20Abi,
  type Abi,
  type Address,
} from "viem";
import { getEnsAddress, getEnsName } from "viem/actions";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";
import deployedContracts from "@/contracts/deployedContracts";
import { getActiveNetwork, NETWORKS, rpcOverrides, type NetworkDefinition } from "@/lib/networks";
import { viemChainForNetwork } from "@repo/viem-chain";
${oneclawImport}${ampersendImport}${graphImport}
function networkForChainId(chainId: number): NetworkDefinition | null {
  for (const n of Object.values(NETWORKS) as NetworkDefinition[]) {
    if (n.chainId === chainId) {
      const byChain = rpcOverrides[String(n.chainId)];
      const byKey = rpcOverrides[n.key];
      const override = byChain || byKey;
      return override?.trim() ? { ...n, rpcUrl: override.trim() } : n;
    }
  }
  return null;
}

function getContractMeta(chainId: number, contractName: string) {
  const byChain = (deployedContracts as Record<string, Record<string, { address: string; abi: Abi }>>)[
    String(chainId)
  ];
  if (!byChain) return { error: \`No deployments for chainId \${chainId}\` as const };
  const meta = byChain[contractName];
  if (!meta) {
    return {
      error: \`Unknown contract "\${contractName}" on chain \${chainId}. Try list_deployed_contracts.\` as const,
    };
  }
  return { meta: { address: meta.address as Address, abi: meta.abi } };
}

const ensPublicClient = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum.publicnode.com"),
});

function getProjectAddresses() {
  const agent = (process.env.AGENT_ADDRESS || process.env.NEXT_PUBLIC_AGENT_ADDRESS || "").trim();
  const deployer = (process.env.DEPLOYER_ADDRESS || "").trim();
  const hex = /^0x[a-fA-F0-9]{40}$/i;
  return {
    agentAddress: agent && hex.test(agent) ? agent : null,
    deployerAddress: deployer && hex.test(deployer) ? deployer : null,
  };
}

async function fetchWalletBalances(address: Address, chainId: number) {
  const net = networkForChainId(chainId);
  if (!net) {
    return { error: \`chainId \${chainId} is not in scaffold NETWORKS — add it or switch targetNetwork.\` };
  }
  const client = createPublicClient({
    chain: viemChainForNetwork(net),
    transport: http(net.rpcUrl),
  });
  try {
    const wei = await client.getBalance({ address });
    const nativeFormatted = formatUnits(wei, net.nativeCurrency.decimals);
    const contracts = net.tokens.map((t) => ({
      address: t.address as Address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address] as const,
    }));
    const tokens: { symbol: string; balance: string; decimals: number; address: string }[] = [];
    if (contracts.length) {
      const results = await client.multicall({ contracts, allowFailure: true });
      results.forEach((r, i) => {
        const t = net.tokens[i];
        tokens.push({
          symbol: t.symbol,
          balance: r.status === "success" ? formatUnits(r.result as bigint, t.decimals) : "0",
          decimals: t.decimals,
          address: t.address,
        });
      });
    }
    return {
      address,
      chainId,
      network: net.key,
      native: {
        symbol: net.nativeCurrency.symbol,
        balance: nativeFormatted,
        decimals: net.nativeCurrency.decimals,
      },
      tokens,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg, address, chainId, network: net.key };
  }
}
${oneclawClientFn}${oneclawChainMapBlock}
/**
 * Preset tools for the chat route: read deployed ABIs and eth_call via viem.${
    includeOneclawSdk
      ? " When ONECLAW_AGENT_ID and ONECLAW_AGENT_API_KEY are set, also exposes 1Claw Intents (simulate, submit, sign-only, list keys/txs). Supports 29+ EVM chains plus non-EVM. See https://1claw.co/intents"
      : ""
  }
 */
export function buildAgentOnchainTools() {
  const active = getActiveNetwork();

  return {
    list_deployed_contracts: tool({
      description:
        "List contracts from deployedContracts.ts (addresses + names per chain). Use before contract_read.",
      parameters: z.object({}),
      execute: async () => {
        const data = deployedContracts as Record<
          string,
          Record<string, { address: string; abi: readonly unknown[] }>
        >;
        const out: { chainId: number; contracts: { name: string; address: string }[] }[] =
          [];
        for (const [cid, contracts] of Object.entries(data)) {
          const names = Object.keys(contracts);
          if (names.length === 0) continue;
          out.push({
            chainId: Number(cid),
            contracts: names.map((name) => ({
              name,
              address: contracts[name].address,
            })),
          });
        }
        return { activeChainId: active.chainId, activeNetwork: active.key, deployments: out };
      },
    }),
    contract_read: tool({
      description:
        "Call a read-only (view/pure) contract function via RPC using the deployed ABI from deployedContracts.ts. chainId defaults to the active network.",
      parameters: z.object({
        chainId: z.number().optional().describe("EVM chain id, e.g. 31337, 11155111, 8453. Defaults to active network."),
        contractName: z.string().describe("Contract key in deployedContracts, e.g. YourContract"),
        functionName: z.string(),
        argsJson: z
          .string()
          .optional()
          .describe('JSON array of arguments, e.g. [] or ["0xabc..."]'),
      }),
      execute: async ({ chainId, contractName, functionName, argsJson }) => {
        const resolvedChainId = chainId ?? active.chainId;
        const got = getContractMeta(resolvedChainId, contractName);
        if ("error" in got) return { error: got.error };
        const net = networkForChainId(resolvedChainId);
        if (!net) {
          return {
            error: \`chainId \${resolvedChainId} is not in scaffold NETWORKS — add it or switch targetNetwork.\`,
          };
        }
        let args: readonly unknown[] = [];
        if (argsJson && argsJson.trim()) {
          try {
            const parsed = JSON.parse(argsJson) as unknown;
            if (!Array.isArray(parsed)) {
              return { error: "argsJson must be a JSON array" };
            }
            args = parsed;
          } catch {
            return { error: "Invalid argsJson — must be valid JSON array" };
          }
        }
        const client = createPublicClient({
          chain: viemChainForNetwork(net),
          transport: http(net.rpcUrl),
        });
        try {
          const result = await client.readContract({
            address: got.meta.address,
            abi: got.meta.abi,
            functionName,
            ...(args.length ? { args } : {}),
          });
          return { result: result as unknown };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { error: msg };
        }
      },
    })${walletEnsToolsBlock}${oneclawToolsBlock}${ampersendToolsBlock}${graphToolsBlock},
  };
}
`;
}

/** Import line + streamText fields for Next chat routes using streamText from the AI SDK. */
export function chatRouteAgentToolsStreamTextFragment(): string {
  return `
import { buildAgentOnchainTools } from "@/lib/agent-onchain-tools";

const _agentOnchainTools = buildAgentOnchainTools();
`;
}
