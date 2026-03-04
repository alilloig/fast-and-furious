"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { MARKETPLACE_PACKAGE_ID } from "@/lib/constants";

export function useCreateVault() {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${MARKETPLACE_PACKAGE_ID}::purchase::create_vault`,
      });
      return dAppKit.signAndExecuteTransaction({ transaction: tx });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-vault"] });
    },
  });
}
