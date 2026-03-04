"use client";

import { useQuery } from "@tanstack/react-query";
import { IS_DEPLOYED } from "@/lib/constants";
import { parseSkillListing } from "@/lib/parsers";
import type { SkillListing } from "@/lib/types";
import { MOCK_SKILLS } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";

export function useSkillListings(listingIds: string[]) {
  const client = useSuiClient();

  return useQuery<SkillListing[]>({
    queryKey: ["skill-listings", listingIds],
    enabled: IS_DEPLOYED && listingIds.length > 0,
    queryFn: async () => {
      const skills: SkillListing[] = [];

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
          const skill = parseSkillListing(obj.objectId, obj.json);
          if (skill.isActive) skills.push(skill);
        }
      }

      return skills;
    },
    placeholderData: IS_DEPLOYED ? undefined : MOCK_SKILLS.filter((s) => s.isActive),
  });
}
