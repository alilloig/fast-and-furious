"use client";

import { useQuery } from "@tanstack/react-query";
import { IS_DEPLOYED } from "@/lib/constants";
import { parsePlaybookListing } from "@/lib/parsers";
import type { PlaybookListing } from "@/lib/types";
import { MOCK_PLAYBOOKS } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";

export function usePlaybookDetail(id: string) {
  const client = useSuiClient();

  return useQuery<PlaybookListing | null>({
    queryKey: ["playbook-detail", id],
    enabled: IS_DEPLOYED && !!id,
    queryFn: async () => {
      const result = await client.getObject({
        objectId: id,
        include: { json: true },
      });
      if (!result.object.json) return null;
      return parsePlaybookListing(result.object.objectId, result.object.json);
    },
    placeholderData: IS_DEPLOYED
      ? undefined
      : MOCK_PLAYBOOKS.find((s) => s.id === id) ?? null,
  });
}
