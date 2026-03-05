"use client";

import { useQuery } from "@tanstack/react-query";
import { bcs } from "@mysten/sui/bcs";
import { IS_DEPLOYED, LISTINGS_REGISTRY_ID } from "@/lib/constants";
import type { RegistryEntry } from "@/lib/types";
import { MOCK_PLAYBOOKS } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";

export function useListingsRegistry() {
  const client = useSuiClient();

  return useQuery<RegistryEntry[]>({
    queryKey: ["listings-registry"],
    enabled: IS_DEPLOYED,
    queryFn: async () => {
      const entries: RegistryEntry[] = [];
      let cursor: string | null = null;
      let hasMore = true;

      while (hasMore) {
        const page = await client.listDynamicFields({
          parentId: LISTINGS_REGISTRY_ID,
          limit: 50,
          cursor,
        });

        for (const field of page.dynamicFields) {
          const listingId = bcs.Address.parse(field.name.bcs);
          entries.push({ listingId, tags: [] });
        }

        cursor = page.cursor;
        hasMore = page.hasNextPage;
      }

      return entries;
    },
    placeholderData: IS_DEPLOYED
      ? undefined
      : MOCK_PLAYBOOKS.map((s) => ({ listingId: s.id, tags: s.tags })),
  });
}
