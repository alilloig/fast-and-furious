"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { IS_DEPLOYED, SELLER_CAP_TYPE } from "@/lib/constants";
import { parseSellerCap } from "@/lib/parsers";
import type { SellerCap } from "@/lib/types";
import { MOCK_SELLER_CAPS } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";
import type { SuiGrpcClient } from "@mysten/sui/grpc";

async function fetchAllSellerCaps(
  client: SuiGrpcClient,
  owner: string,
): Promise<SellerCap[]> {
  const caps: SellerCap[] = [];
  let nextCursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: { objects: any[]; cursor: string | null; hasNextPage: boolean } =
      await client.listOwnedObjects({
        owner,
        type: SELLER_CAP_TYPE,
        include: { json: true },
        limit: 50,
        cursor: nextCursor,
      });

    for (const obj of result.objects) {
      if (!obj.json) continue;
      caps.push(parseSellerCap(obj.objectId, obj.json));
    }

    nextCursor = result.cursor;
    hasMore = result.hasNextPage;
  }

  return caps;
}

export function useSellerCaps() {
  const client = useSuiClient();
  const account = useCurrentAccount();

  return useQuery<SellerCap[]>({
    queryKey: ["seller-caps", account?.address],
    enabled: IS_DEPLOYED && !!account,
    queryFn: () => fetchAllSellerCaps(client, account!.address),
    placeholderData: IS_DEPLOYED ? undefined : MOCK_SELLER_CAPS,
  });
}
