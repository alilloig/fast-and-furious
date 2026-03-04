"use client";

import { useQuery } from "@tanstack/react-query";
import { IS_DEPLOYED } from "@/lib/constants";
import { parsePackageListing } from "@/lib/parsers";
import type { PackageListing } from "@/lib/types";
import { MOCK_PACKAGES } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";

export function usePackageDetail(id: string) {
  const client = useSuiClient();

  return useQuery<PackageListing | null>({
    queryKey: ["package-detail", id],
    enabled: IS_DEPLOYED && !!id,
    queryFn: async () => {
      const result = await client.getObject({
        objectId: id,
        include: { json: true },
      });
      if (!result.object.json) return null;
      return parsePackageListing(result.object.objectId, result.object.json);
    },
    placeholderData: IS_DEPLOYED
      ? undefined
      : MOCK_PACKAGES.find((p) => p.id === id) ?? null,
  });
}
