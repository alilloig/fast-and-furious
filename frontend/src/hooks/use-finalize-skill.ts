"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import {
  MARKETPLACE_PACKAGE_ID,
  LISTINGS_REGISTRY_ID,
} from "@/lib/constants";

interface FinalizeSkillArgs {
  sellerCapId: string;
  listingId: string;
  walrusBlobId: string;
  walrusQuiltId: string | null;
  fileNames: string[];
  sealKeyId: number[];
  rootHash: number[];
  encodingNonce: number;
}

/**
 * Step 2 of the two-step listing flow: finalizes a SkillListing by populating
 * Walrus blob ID, Seal key identity, activating the listing, and registering
 * it in the ListingsRegistry so buyers can discover it.
 */
export function useFinalizeSkill() {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: FinalizeSkillArgs) => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${MARKETPLACE_PACKAGE_ID}::skill::finalize`,
        arguments: [
          tx.object(args.sellerCapId),
          tx.object(args.listingId),
          tx.object(LISTINGS_REGISTRY_ID),
          tx.pure.string(args.walrusBlobId),
          tx.pure.option("string", args.walrusQuiltId),
          tx.pure.vector("string", args.fileNames),
          tx.pure.vector("u8", args.sealKeyId),
          tx.pure.vector("u8", args.rootHash),
          tx.pure.u64(args.encodingNonce),
        ],
      });
      return dAppKit.signAndExecuteTransaction({ transaction: tx });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings-registry"] });
      queryClient.invalidateQueries({ queryKey: ["seller-caps"] });
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    },
  });
}
