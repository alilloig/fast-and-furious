"use client";

import { useQuery } from "@tanstack/react-query";
import { IS_DEPLOYED, MARKETPLACE_CONFIG_ID } from "@/lib/constants";
import { parseMarketplaceConfig } from "@/lib/parsers";
import type { MarketplaceConfig } from "@/lib/types";
import { useSuiClient } from "./use-sui-client";

const MOCK_CONFIG: MarketplaceConfig = {
  id: "0x0",
  version: 1,
  feeBps: 250,
  feeRecipient: "0x0",
};

export function useMarketplaceConfig() {
  const client = useSuiClient();

  return useQuery<MarketplaceConfig>({
    queryKey: ["marketplace-config"],
    enabled: IS_DEPLOYED,
    queryFn: async () => {
      const result = await client.getObject({
        objectId: MARKETPLACE_CONFIG_ID,
        include: { json: true },
      });
      if (!result.object.json) throw new Error("Config not found");
      return parseMarketplaceConfig(result.object.objectId, result.object.json);
    },
    placeholderData: IS_DEPLOYED ? undefined : MOCK_CONFIG,
  });
}
