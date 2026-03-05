"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { useSuiClient } from "./use-sui-client";
import { getWalrusClient } from "@/lib/walrus-client";
import { MARKETPLACE_PACKAGE_ID } from "@/lib/constants";

interface ExtendStorageArgs {
  /** Walrus Blob Sui object ID */
  blobObjectId: string;
  /** Number of additional epochs */
  epochs: number;
  /** SellerCap object ID */
  sellerCapId: string;
  /** SkillListing object ID */
  listingId: string;
  /** Current storage_end_epoch (for computing new value) */
  currentEndEpoch: number;
}

/**
 * Two-step extend flow:
 * 1. Build & execute a Walrus extend transaction (pays WAL)
 * 2. Update on-chain storage_end_epoch via skill::update_storage_end_epoch (pays SUI gas)
 */
export function useExtendStorage() {
  const dAppKit = useDAppKit();
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: ExtendStorageArgs) => {
      const walrusClient = getWalrusClient(suiClient);

      // Step 1: Extend blob on Walrus (Sui transaction paying WAL)
      const extendTx = await walrusClient.extendBlobTransaction({
        blobObjectId: args.blobObjectId,
        epochs: args.epochs,
      });
      await dAppKit.signAndExecuteTransaction({ transaction: extendTx });

      // Step 2: Read the updated blob object to get new endEpoch
      const { object } = await suiClient.getObject({
        objectId: args.blobObjectId,
        include: { json: true },
      });
      let newEndEpoch = args.currentEndEpoch + args.epochs;
      if (object.json) {
        const storage = (object.json as Record<string, unknown>).storage as
          | Record<string, unknown>
          | undefined;
        if (storage?.end_epoch) {
          newEndEpoch = Number(storage.end_epoch);
        }
      }

      // Step 3: Update on-chain listing storage_end_epoch
      const tx = new Transaction();
      tx.moveCall({
        target: `${MARKETPLACE_PACKAGE_ID}::skill::update_storage_end_epoch`,
        arguments: [
          tx.object(args.sellerCapId),
          tx.object(args.listingId),
          tx.pure.u64(newEndEpoch),
        ],
      });
      await dAppKit.signAndExecuteTransaction({ transaction: tx });

      return { newEndEpoch };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-detail"] });
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    },
  });
}
