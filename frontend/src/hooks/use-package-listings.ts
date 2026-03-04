"use client";

import { useQuery } from "@tanstack/react-query";
import { IS_DEPLOYED } from "@/lib/constants";
import { parsePackageListing } from "@/lib/parsers";
import type { PackageListing } from "@/lib/types";
import { MOCK_PACKAGES } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";

export function usePackageListings(listingIds: string[]) {
  const client = useSuiClient();

  return useQuery<PackageListing[]>({
    queryKey: ["package-listings", listingIds],
    enabled: IS_DEPLOYED && listingIds.length > 0,
    queryFn: async () => {
      const packages: PackageListing[] = [];

      for (let i = 0; i < listingIds.length; i += 50) {
        const batch = listingIds.slice(i, i + 50);
        const result = await client.getObjects({
          objectIds: batch,
          include: { json: true },
        });

        for (const obj of result.objects) {
          if (obj instanceof Error) continue;
          if (!obj.type.includes("::package_listing::PackageListing")) continue;
          if (!obj.json) continue;
          const pkg = parsePackageListing(obj.objectId, obj.json);
          if (pkg.isActive) packages.push(pkg);
        }
      }

      return packages;
    },
    placeholderData: IS_DEPLOYED ? undefined : MOCK_PACKAGES.filter((p) => p.isActive),
  });
}
