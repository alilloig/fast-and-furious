"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import {
  MARKETPLACE_PACKAGE_ID,
  MARKETPLACE_CONFIG_ID,
  LISTINGS_REGISTRY_ID,
} from "@/lib/constants";

interface CreateSkillArgs {
  title: string;
  description: string;
  price: bigint;
  category: string;
  tags: string[];
  walrusBlobId: string;
  walrusQuiltId: string | null;
  sealKeyId: number[];
}

export function useCreateSkill() {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: CreateSkillArgs) => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${MARKETPLACE_PACKAGE_ID}::skill::create`,
        arguments: [
          tx.object(MARKETPLACE_CONFIG_ID),
          tx.object(LISTINGS_REGISTRY_ID),
          tx.pure.string(args.title),
          tx.pure.string(args.description),
          tx.pure.u64(args.price),
          tx.pure.string(args.category),
          tx.pure.vector("string", args.tags),
          tx.pure.string(args.walrusBlobId),
          tx.pure.option("string", args.walrusQuiltId),
          tx.pure.vector("u8", args.sealKeyId),
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
