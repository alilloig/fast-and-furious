"use client";

import { useMutation } from "@tanstack/react-query";
import { useCurrentClient } from "@mysten/dapp-kit-react";
import { verifyBlobIntegrity } from "@/lib/verify-integrity";
import type { SkillListing, PurchaseReceipt } from "@/lib/types";

interface VerifyIntegrityArgs {
  encryptedBytes: Uint8Array;
  skill: SkillListing;
  receipt: PurchaseReceipt;
}

export function useVerifyIntegrity() {
  const suiClient = useCurrentClient();
  return useMutation({
    mutationFn: async (args: VerifyIntegrityArgs) => {
      return verifyBlobIntegrity(args.encryptedBytes, args.skill, args.receipt, suiClient);
    },
  });
}
