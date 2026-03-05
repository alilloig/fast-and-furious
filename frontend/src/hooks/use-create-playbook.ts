"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { MARKETPLACE_PACKAGE_ID, MARKETPLACE_CONFIG_ID } from "@/lib/constants";

interface CreatePlaybookArgs {
  title: string;
  description: string;
  price: bigint;
  category: string;
  tags: string[];
}

/**
 * Step 1 of the two-step listing flow: creates an unfinalized SkillListing on-chain.
 * The listing is inactive and not yet registered in the ListingsRegistry.
 * After this, the seller must encrypt + upload + call finalize.
 */
export function useCreatePlaybook() {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: CreatePlaybookArgs) => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${MARKETPLACE_PACKAGE_ID}::skill::create`,
        arguments: [
          tx.object(MARKETPLACE_CONFIG_ID),
          tx.pure.string(args.title),
          tx.pure.string(args.description),
          tx.pure.u64(args.price),
          tx.pure.string(args.category),
          tx.pure.vector("string", args.tags),
        ],
      });
      return dAppKit.signAndExecuteTransaction({ transaction: tx });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-caps"] });
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    },
  });
}
