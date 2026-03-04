"use client";

import { useCurrentClient } from "@mysten/dapp-kit-react";
import type { SuiGrpcClient } from "@mysten/sui/grpc";

/**
 * Returns the current SuiGrpcClient with proper typing.
 * useCurrentClient returns ClientWithCoreApi which lacks transport methods.
 * Since we always create SuiGrpcClient instances, this cast is safe.
 */
export function useSuiClient(): SuiGrpcClient {
  return useCurrentClient() as unknown as SuiGrpcClient;
}
