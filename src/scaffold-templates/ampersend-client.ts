/**
 * Generated `lib/ampersend-client.ts` — pre-configured Ampersend SDK wallet + treasurer.
 * Uses AMPERSEND_SIGNING_KEY from env (1Claw vault → with-secrets, or .env.secrets.encrypted).
 */
export function ampersendClientSource(): string {
  return `import { AccountWallet, NaiveTreasurer } from "@ampersend_ai/ampersend-sdk/x402";

const AMPERSEND_BASE_URL =
  process.env.AMPERSEND_API_URL || "https://api.ampersend.ai";

/**
 * Get an Ampersend wallet backed by AMPERSEND_SIGNING_KEY (private key from ampersend.ai).
 * For Smart Account mode, set AMPERSEND_SMART_ACCOUNT_ADDRESS and import SmartAccountWallet instead.
 */
export function getAmpersendWallet(): AccountWallet {
  const key = (process.env.AMPERSEND_SIGNING_KEY || "").trim();
  if (!key) {
    throw new Error(
      "AMPERSEND_SIGNING_KEY is not set. Add it via: just enc AMPERSEND_SIGNING_KEY '0x...' " +
        "(or store in 1Claw vault at private-keys/ampersend-signing).",
    );
  }
  return new AccountWallet(key as \`0x\${string}\`);
}

/**
 * Get a Treasurer that authorizes x402 payments.
 * Default: NaiveTreasurer (auto-approves — suitable for dev/testing).
 * For production, integrate AmpersendTreasurer with spend limits via the platform.
 */
export function getAmpersendTreasurer() {
  const wallet = getAmpersendWallet();
  return new NaiveTreasurer(wallet);
}

export { AMPERSEND_BASE_URL };
`;
}
