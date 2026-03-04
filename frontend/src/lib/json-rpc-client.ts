import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { SUI_NETWORK } from "./constants";

let _client: SuiJsonRpcClient | null = null;

/**
 * Singleton JSON-RPC client.
 * Used exclusively for vault lookup (queryTransactionBlocks / getOwnedObjects)
 * which aren't available on gRPC.
 */
export function getJsonRpcClient(): SuiJsonRpcClient {
  if (!_client) {
    _client = new SuiJsonRpcClient({
      url: getJsonRpcFullnodeUrl(SUI_NETWORK),
      network: SUI_NETWORK,
    });
  }
  return _client;
}
