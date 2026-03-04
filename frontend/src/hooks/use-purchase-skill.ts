"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { MARKETPLACE_PACKAGE_ID, MARKETPLACE_CONFIG_ID } from "@/lib/constants";

interface PurchaseSkillArgs {
  listingId: string;
  vaultId: string;
  price: bigint;
}

export function usePurchaseSkill() {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listingId, vaultId, price }: PurchaseSkillArgs) => {
      const tx = new Transaction();
      const payment = coinWithBalance({ balance: price });
      tx.moveCall({
        target: `${MARKETPLACE_PACKAGE_ID}::purchase::purchase_skill`,
        arguments: [
          tx.object(MARKETPLACE_CONFIG_ID),
          tx.object(listingId),
          tx.object(vaultId),
          payment,
        ],
      });
      return dAppKit.signAndExecuteTransaction({ transaction: tx });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-receipts"] });
    },
  });
}
