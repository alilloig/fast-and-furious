"use client";

import { useQuery } from "@tanstack/react-query";
import { IS_DEPLOYED } from "@/lib/constants";
import { parseSkillListing } from "@/lib/parsers";
import type { SkillListing } from "@/lib/types";
import { MOCK_SKILLS } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";

export function useSkillDetail(id: string) {
  const client = useSuiClient();

  return useQuery<SkillListing | null>({
    queryKey: ["skill-detail", id],
    enabled: IS_DEPLOYED && !!id,
    queryFn: async () => {
      const result = await client.getObject({
        objectId: id,
        include: { json: true },
      });
      if (!result.object.json) return null;
      return parseSkillListing(result.object.objectId, result.object.json);
    },
    placeholderData: IS_DEPLOYED
      ? undefined
      : MOCK_SKILLS.find((s) => s.id === id) ?? null,
  });
}
