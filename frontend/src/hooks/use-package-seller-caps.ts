"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { IS_DEPLOYED, PACKAGE_SELLER_CAP_TYPE } from "@/lib/constants";
import { parsePackageSellerCap } from "@/lib/parsers";
import type { PackageSellerCap } from "@/lib/types";
import { MOCK_PACKAGE_SELLER_CAPS } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";
import type { SuiGrpcClient } from "@mysten/sui/grpc";

async function fetchAllPackageSellerCaps(
  client: SuiGrpcClient,
  owner: string,
): Promise<PackageSellerCap[]> {
  const caps: PackageSellerCap[] = [];
  let nextCursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: { objects: any[]; cursor: string | null; hasNextPage: boolean } =
      await client.listOwnedObjects({
        owner,
        type: PACKAGE_SELLER_CAP_TYPE,
        include: { json: true },
        limit: 50,
        cursor: nextCursor,
      });

    for (const obj of result.objects) {
      if (!obj.json) continue;
      caps.push(parsePackageSellerCap(obj.objectId, obj.json));
    }

    nextCursor = result.cursor;
    hasMore = result.hasNextPage;
  }

  return caps;
}

export function usePackageSellerCaps() {
  const client = useSuiClient();
  const account = useCurrentAccount();

  return useQuery<PackageSellerCap[]>({
    queryKey: ["package-seller-caps", account?.address],
    enabled: IS_DEPLOYED && !!account,
    queryFn: () => fetchAllPackageSellerCaps(client, account!.address),
    placeholderData: IS_DEPLOYED ? undefined : MOCK_PACKAGE_SELLER_CAPS,
  });
}
