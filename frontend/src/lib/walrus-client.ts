import { WalrusClient } from "@mysten/walrus";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { SUI_NETWORK } from "./constants";

let _walrusClient: WalrusClient | null = null;
let _lastClient: ClientWithCoreApi | null = null;

/**
 * Get or create a WalrusClient singleton.
 * Re-creates if the underlying Sui client changes.
 */
export function getWalrusClient(suiClient: ClientWithCoreApi): WalrusClient {
  if (!_walrusClient || _lastClient !== suiClient) {
    _walrusClient = new WalrusClient({
      network: SUI_NETWORK,
      suiClient,
    });
    _lastClient = suiClient;
  }
  return _walrusClient;
}
