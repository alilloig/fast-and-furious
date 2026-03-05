"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDAppKit, useCurrentAccount } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { useSuiClient } from "./use-sui-client";
import { getWalrusClient } from "@/lib/walrus-client";
import { MARKETPLACE_PACKAGE_ID, LISTINGS_REGISTRY_ID } from "@/lib/constants";

interface DelistPlaybookArgs {
  listingId: string;
  sellerCapId: string;
  walrusBlobObjectId?: string;
  deleteBlob?: boolean;
}

export function useDelistPlaybook() {
  const dAppKit = useDAppKit();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listingId, sellerCapId, walrusBlobObjectId, deleteBlob }: DelistPlaybookArgs) => {
      const tx = new Transaction();

      // Add Walrus blob deletion to the PTB if requested
      if (deleteBlob && walrusBlobObjectId) {
        const owner = currentAccount?.address;
        if (!owner) throw new Error("Wallet not connected");
        const walrusClient = getWalrusClient(suiClient);
        walrusClient.deleteBlobTransaction({
          blobObjectId: walrusBlobObjectId,
          owner,
          transaction: tx,
        });
      }

      // Add skill::delist Move call to the same PTB
      tx.moveCall({
        target: `${MARKETPLACE_PACKAGE_ID}::skill::delist`,
        arguments: [
          tx.object(listingId),
          tx.object(sellerCapId),
          tx.object(LISTINGS_REGISTRY_ID),
        ],
      });

      return dAppKit.signAndExecuteTransaction({ transaction: tx });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings-registry"] });
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-listings"] });
    },
  });
}
