"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { MARKETPLACE_PACKAGE_ID, LISTINGS_REGISTRY_ID } from "@/lib/constants";

interface DelistSkillArgs {
  listingId: string;
  sellerCapId: string;
}

export function useDelistSkill() {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listingId, sellerCapId }: DelistSkillArgs) => {
      const tx = new Transaction();
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
      queryClient.invalidateQueries({ queryKey: ["skill-listings"] });
    },
  });
}
