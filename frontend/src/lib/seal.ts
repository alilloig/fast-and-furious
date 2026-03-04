import { SealClient } from "@mysten/seal";
import type { SealCompatibleClient } from "@mysten/seal";
import { SEAL_SERVER_CONFIGS } from "./constants";

let _sealClient: SealClient | null = null;
let _lastClient: SealCompatibleClient | null = null;

/**
 * Get or create a SealClient singleton.
 * Re-creates if the underlying Sui client changes (e.g. network switch).
 */
export function getSealClient(suiClient: SealCompatibleClient): SealClient {
  if (!_sealClient || _lastClient !== suiClient) {
    _sealClient = new SealClient({
      suiClient,
      serverConfigs: SEAL_SERVER_CONFIGS,
    });
    _lastClient = suiClient;
  }
  return _sealClient;
}
