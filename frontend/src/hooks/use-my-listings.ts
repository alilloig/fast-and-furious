"use client";

import { useQuery } from "@tanstack/react-query";
import { IS_DEPLOYED } from "@/lib/constants";
import { parseSkillListing } from "@/lib/parsers";
import type { SkillListing, SellerCap } from "@/lib/types";
import { MOCK_SKILLS, MOCK_SELLER_CAPS } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";
import { useSellerCaps } from "./use-seller-caps";

export interface MyListing {
  cap: SellerCap;
  listing: SkillListing;
}

export function useMyListings() {
  const client = useSuiClient();
  const { data: caps } = useSellerCaps();

  const listingIds = caps?.map((c) => c.skillListingId) ?? [];

  return useQuery<MyListing[]>({
    queryKey: ["my-listings", listingIds],
    enabled: IS_DEPLOYED && listingIds.length > 0,
    queryFn: async () => {
      const results: MyListing[] = [];

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
          const listing = parseSkillListing(obj.objectId, obj.json);
          const cap = caps!.find((c) => c.skillListingId === listing.id);
          if (cap) results.push({ cap, listing });
        }
      }

      return results;
    },
    placeholderData: IS_DEPLOYED
      ? undefined
      : MOCK_SELLER_CAPS.map((cap) => ({
          cap,
          listing: MOCK_SKILLS.find((s) => s.id === cap.skillListingId)!,
        })).filter((entry) => entry.listing),
  });
}
