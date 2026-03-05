"use client";

import { useQuery } from "@tanstack/react-query";
import { IS_DEPLOYED } from "@/lib/constants";
import { parsePlaybookListing } from "@/lib/parsers";
import type { PlaybookListing } from "@/lib/types";
import { MOCK_PLAYBOOKS } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";

export function usePlaybookListings(listingIds: string[]) {
  const client = useSuiClient();

  return useQuery<PlaybookListing[]>({
    queryKey: ["playbook-listings", listingIds],
    enabled: IS_DEPLOYED && listingIds.length > 0,
    queryFn: async () => {
      const playbooks: PlaybookListing[] = [];

      for (let i = 0; i < listingIds.length; i += 50) {
        const batch = listingIds.slice(i, i + 50);
        const result = await client.getObjects({
          objectIds: batch,
          include: { json: true },
        });

        for (const obj of result.objects) {
          if (obj instanceof Error) continue;
          if (!obj.type.includes("::skill::SkillListing")) continue;
          if (!obj.json) continue;
          const playbook = parsePlaybookListing(obj.objectId, obj.json);
          if (playbook.isActive) playbooks.push(playbook);
        }
      }

      return playbooks;
    },
    placeholderData: IS_DEPLOYED ? undefined : MOCK_PLAYBOOKS.filter((s) => s.isActive),
  });
}
