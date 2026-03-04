"use client";

import { useQuery } from "@tanstack/react-query";
import { IS_DEPLOYED } from "@/lib/constants";
import { parseSellerVaultInfo } from "@/lib/parsers";
import type { SellerVaultInfo } from "@/lib/types";
import { MOCK_VAULT_INFO } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";

export function useSellerVaultDetail(vaultId: string | null | undefined) {
  const client = useSuiClient();

  return useQuery<SellerVaultInfo | null>({
    queryKey: ["seller-vault-detail", vaultId],
    enabled: IS_DEPLOYED && !!vaultId,
    queryFn: async () => {
      if (!vaultId) return null;
      const result = await client.getObject({
        objectId: vaultId,
        include: { json: true },
      });
      if (!result.object?.json) return null;
      return parseSellerVaultInfo(vaultId, result.object.json);
    },
    placeholderData: IS_DEPLOYED ? undefined : MOCK_VAULT_INFO,
  });
}
