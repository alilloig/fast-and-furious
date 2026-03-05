"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "./use-sui-client";
import { getWalrusClient } from "@/lib/walrus-client";
import { IS_DEPLOYED } from "@/lib/constants";

export interface WalrusEpochInfo {
  epoch: number;
  epochDurationMs: number;
  firstEpochStartMs: number;
}

/**
 * Query the current Walrus epoch and timing data via walrusClient.stakingState().
 *
 * Returns { epoch, epochDurationMs, firstEpochStartMs } so consumers can
 * compare against storage_end_epoch and convert epochs to real dates.
 */
export function useWalrusEpoch() {
  const suiClient = useSuiClient();

  return useQuery<WalrusEpochInfo>({
    queryKey: ["walrus-epoch"],
    queryFn: async () => {
      const walrusClient = getWalrusClient(suiClient);
      const state = await walrusClient.stakingState();
      return {
        epoch: state.epoch,
        epochDurationMs: Number(state.epoch_duration),
        firstEpochStartMs: Number(state.first_epoch_start),
      };
    },
    enabled: IS_DEPLOYED,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export interface SuiEpochInfo {
  epoch: number;
  epochStartMs: number;
  epochDurationMs: number;
}

/**
 * Query the current Sui epoch, its start timestamp, and duration.
 * Useful for converting historical Sui epoch numbers to approximate dates.
 */
export function useSuiEpoch() {
  const suiClient = useSuiClient();

  return useQuery<SuiEpochInfo>({
    queryKey: ["sui-epoch"],
    queryFn: async () => {
      const { response } = await suiClient.ledgerService.getEpoch({
        readMask: { paths: ["epoch", "start", "system_state.parameters"] },
      });
      const epoch = response.epoch;
      if (!epoch?.epoch || !epoch.start) {
        throw new Error("Missing epoch data");
      }
      const epochStartMs =
        Number(epoch.start.seconds) * 1000 +
        Math.floor((epoch.start.nanos ?? 0) / 1_000_000);
      return {
        epoch: Number(epoch.epoch),
        epochStartMs,
        epochDurationMs: Number(epoch.systemState?.parameters?.epochDurationMs ?? 86_400_000n),
      };
    },
    enabled: IS_DEPLOYED,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
