"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import {
  MARKETPLACE_PACKAGE_ID,
  MARKETPLACE_CONFIG_ID,
  LISTINGS_REGISTRY_ID,
} from "@/lib/constants";

interface CreatePackageArgs {
  title: string;
  description: string;
  skillIds: string[];
  price: bigint;
  discountBps: number;
  tags: string[];
}

export function useCreatePackage() {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: CreatePackageArgs) => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${MARKETPLACE_PACKAGE_ID}::package_listing::create`,
        arguments: [
          tx.object(MARKETPLACE_CONFIG_ID),
          tx.object(LISTINGS_REGISTRY_ID),
          tx.pure.string(args.title),
          tx.pure.string(args.description),
          tx.pure.vector("address", args.skillIds),
          tx.pure.u64(args.price),
          tx.pure.u64(args.discountBps),
          tx.pure.vector("string", args.tags),
        ],
      });
      return dAppKit.signAndExecuteTransaction({ transaction: tx });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings-registry"] });
      queryClient.invalidateQueries({ queryKey: ["package-seller-caps"] });
      queryClient.invalidateQueries({ queryKey: ["my-packages"] });
    },
  });
}
