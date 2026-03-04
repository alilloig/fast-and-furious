"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { IS_DEPLOYED, PURCHASE_RECEIPT_TYPE } from "@/lib/constants";
import { parsePurchaseReceipt } from "@/lib/parsers";
import type { PurchaseReceipt } from "@/lib/types";
import { MOCK_RECEIPTS } from "@/lib/mock-data";
import { useSuiClient } from "./use-sui-client";
import type { SuiGrpcClient } from "@mysten/sui/grpc";

async function fetchAllReceipts(
  client: SuiGrpcClient,
  owner: string,
): Promise<PurchaseReceipt[]> {
  const receipts: PurchaseReceipt[] = [];
  let nextCursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: { objects: any[]; cursor: string | null; hasNextPage: boolean } =
      await client.listOwnedObjects({
        owner,
        type: PURCHASE_RECEIPT_TYPE,
        include: { json: true },
        limit: 50,
        cursor: nextCursor,
      });

    for (const obj of result.objects) {
      if (!obj.json) continue;
      receipts.push(parsePurchaseReceipt(obj.objectId, obj.json));
    }

    nextCursor = result.cursor;
    hasMore = result.hasNextPage;
  }

  return receipts;
}

export function usePurchaseReceipts() {
  const client = useSuiClient();
  const account = useCurrentAccount();

  return useQuery<PurchaseReceipt[]>({
    queryKey: ["purchase-receipts", account?.address],
    enabled: IS_DEPLOYED && !!account,
    queryFn: () => fetchAllReceipts(client, account!.address),
    placeholderData: IS_DEPLOYED ? undefined : MOCK_RECEIPTS,
  });
}
