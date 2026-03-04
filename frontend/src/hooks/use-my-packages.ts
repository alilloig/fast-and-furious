"use client";

import { useQuery } from "@tanstack/react-query";
import { IS_DEPLOYED } from "@/lib/constants";
import { parsePackageListing } from "@/lib/parsers";
import type { PackageListing, PackageSellerCap } from "@/lib/types";
import { MOCK_PACKAGES, MOCK_PACKAGE_SELLER_CAPS } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";
import { usePackageSellerCaps } from "./use-package-seller-caps";

export interface MyPackage {
  cap: PackageSellerCap;
  listing: PackageListing;
}

export function useMyPackages() {
  const client = useSuiClient();
  const { data: caps } = usePackageSellerCaps();

  const listingIds = caps?.map((c) => c.packageListingId) ?? [];

  return useQuery<MyPackage[]>({
    queryKey: ["my-packages", listingIds],
    enabled: IS_DEPLOYED && listingIds.length > 0,
    queryFn: async () => {
      const results: MyPackage[] = [];

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
          const listing = parsePackageListing(obj.objectId, obj.json);
          const cap = caps!.find((c) => c.packageListingId === listing.id);
          if (cap) results.push({ cap, listing });
        }
      }

      return results;
    },
    placeholderData: IS_DEPLOYED
      ? undefined
      : MOCK_PACKAGE_SELLER_CAPS.map((cap) => ({
          cap,
          listing: MOCK_PACKAGES.find((p) => p.id === cap.packageListingId)!,
        })).filter((entry) => entry.listing),
  });
}
