"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { MARKETPLACE_PACKAGE_ID } from "@/lib/constants";

interface WithdrawArgs {
  vaultId: string;
  amount: bigint;
}

export function useWithdraw() {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vaultId, amount }: WithdrawArgs) => {
      if (!account) throw new Error("Wallet not connected");
      const tx = new Transaction();
      const coin = tx.moveCall({
        target: `${MARKETPLACE_PACKAGE_ID}::purchase::withdraw`,
        arguments: [tx.object(vaultId), tx.pure.u64(amount)],
      });
      tx.transferObjects([coin], account.address);
      return dAppKit.signAndExecuteTransaction({ transaction: tx });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-vault-detail"] });
      queryClient.invalidateQueries({ queryKey: ["seller-vault"] });
    },
  });
}
