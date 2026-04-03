/**
 * Embedded ZKNOX PQ-account factory deployments.
 *
 * Source: kohaku/packages/pq-account/deployments/deployments.json
 *
 * To add a new network: add an entry to PQ_DEPLOYMENTS following the same shape.
 * The wizard and prompts will automatically pick it up.
 */

export type PQNetworkKey = "sepolia" | "arbitrumSepolia" | "baseSepolia";

/** Only ML-DSA-44 is supported. Falcon uses a custom WASM compact encoding incompatible with @noble/post-quantum. */
export type PQSchemeKey = "mldsa";

export interface PQFactoryEntry {
  address: string;
  postQuantum: string;
  preQuantum: string;
  saltLabel: string;
}

export interface PQNetworkDeployment {
  chainId: number;
  rpcHint: string;
  bundlerHint: string;
  /** Only k1 factories listed — preQuantum="ecdsa_k1" */
  factories: Partial<Record<PQSchemeKey, PQFactoryEntry>>;
}

export const PQ_DEPLOYMENTS: Record<PQNetworkKey, PQNetworkDeployment> = {
  sepolia: {
    chainId: 11155111,
    rpcHint: "https://rpc.sepolia.org",
    bundlerHint: "https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_KEY",
    factories: {
      mldsa: {
        address: "0xF45104FCfBB9233cEa6D516d71ba57F6961B8C2e",
        postQuantum: "mldsa",
        preQuantum: "ecdsa_k1",
        saltLabel: "ZKNOX_MLDSA_K1_FACTORY_V0_0_10",
      },
    },
  },
  arbitrumSepolia: {
    chainId: 421614,
    rpcHint: "https://sepolia-rollup.arbitrum.io/rpc",
    bundlerHint: "https://api.pimlico.io/v2/arbitrum-sepolia/rpc?apikey=YOUR_KEY",
    factories: {
      mldsa: {
        address: "0xF45104FCfBB9233cEa6D516d71ba57F6961B8C2e",
        postQuantum: "mldsa",
        preQuantum: "ecdsa_k1",
        saltLabel: "ZKNOX_MLDSA_K1_FACTORY_V0_0_10",
      },
    },
  },
  baseSepolia: {
    chainId: 84532,
    rpcHint: "https://sepolia.base.org",
    bundlerHint: "https://api.pimlico.io/v2/base-sepolia/rpc?apikey=YOUR_KEY",
    factories: {
      mldsa: {
        address: "0xF45104FCfBB9233cEa6D516d71ba57F6961B8C2e",
        postQuantum: "mldsa",
        preQuantum: "ecdsa_k1",
        saltLabel: "ZKNOX_MLDSA_K1_FACTORY_V0_0_10",
      },
    },
  },
};

export const NETWORK_LABELS: Record<PQNetworkKey, string> = {
  sepolia: "Sepolia (Ethereum testnet)",
  arbitrumSepolia: "Arbitrum Sepolia",
  baseSepolia: "Base Sepolia",
};

export const SCHEME_LABELS: Record<PQSchemeKey, string> = {
  mldsa: "ML-DSA-44 (NIST FIPS 204)",
};

/** All deployed networks. */
export function availableNetworks(): PQNetworkKey[] {
  return Object.keys(PQ_DEPLOYMENTS) as PQNetworkKey[];
}

/** Schemes that have a k1 factory deployed on the given network. */
export function availableSchemesForNetwork(network: PQNetworkKey): PQSchemeKey[] {
  return Object.keys(PQ_DEPLOYMENTS[network].factories) as PQSchemeKey[];
}

/** Factory contract address for the given network + scheme (always k1 pre-quantum). */
export function getFactoryAddress(network: PQNetworkKey, scheme: PQSchemeKey): string | undefined {
  return PQ_DEPLOYMENTS[network]?.factories[scheme]?.address;
}

export function getChainId(network: PQNetworkKey): number {
  return PQ_DEPLOYMENTS[network].chainId;
}

export function getBundlerHint(network: PQNetworkKey): string {
  return PQ_DEPLOYMENTS[network].bundlerHint;
}
