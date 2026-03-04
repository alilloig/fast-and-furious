"use client";

import { useQuery } from "@tanstack/react-query";
import { IS_DEPLOYED, MARKETPLACE_PACKAGE_ID, SELLER_VAULT_TYPE } from "@/lib/constants";
import { getJsonRpcClient } from "@/lib/json-rpc-client";

/**
 * Discover a seller's SellerVault shared object ID.
 *
 * SellerVault is a shared object, so it won't appear in getOwnedObjects.
 * We find it by querying for `create_vault` transactions, then filtering
 * by sender to match the seller's address.
 */
export function useSellerVault(sellerAddress: string | undefined) {
  return useQuery<string | null>({
    queryKey: ["seller-vault", sellerAddress],
    enabled: IS_DEPLOYED && !!sellerAddress,
    staleTime: Infinity,
    queryFn: async () => {
      if (!sellerAddress) return null;
      const jsonRpc = getJsonRpcClient();

      const result = await jsonRpc.queryTransactionBlocks({
        filter: {
          MoveFunction: {
            package: MARKETPLACE_PACKAGE_ID,
            module: "purchase",
            function: "create_vault",
          },
        },
        options: {
          showObjectChanges: true,
        },
        limit: 50,
      });

      for (const tx of result.data) {
        if (!tx.objectChanges) continue;
        for (const change of tx.objectChanges) {
          if (
            change.type === "created" &&
            change.objectType === SELLER_VAULT_TYPE &&
            change.owner &&
            typeof change.owner === "object" &&
            "Shared" in change.owner
          ) {
            // Verify this vault belongs to the seller by fetching tx sender
            const txDetail = await jsonRpc.getTransactionBlock({
              digest: tx.digest,
              options: { showInput: true },
            });
            const sender = txDetail.transaction?.data.sender;
            if (sender === sellerAddress) {
              return change.objectId;
            }
          }
        }
      }

      return null;
    },
  });
}
