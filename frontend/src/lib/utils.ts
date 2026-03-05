import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MIST_PER_SUI, FROST_PER_WAL } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert MIST amount to a human-readable SUI string (e.g., "1.5 SUI"). */
export function formatSui(mist: bigint): string {
  const whole = mist / MIST_PER_SUI;
  const remainder = mist % MIST_PER_SUI;
  if (remainder === 0n) return `${whole} SUI`;
  // Show up to 4 decimal places
  const decimal = remainder.toString().padStart(9, "0").slice(0, 4).replace(/0+$/, "");
  return `${whole}.${decimal} SUI`;
}

/** Convert FROST amount to a human-readable WAL string (e.g., "0.0001 WAL"). */
export function formatWal(frost: bigint): string {
  const whole = frost / FROST_PER_WAL;
  const remainder = frost % FROST_PER_WAL;
  if (remainder === 0n) return `${whole} WAL`;
  const decimal = remainder.toString().padStart(9, "0").slice(0, 6).replace(/0+$/, "");
  return `${whole}.${decimal} WAL`;
}

/** Truncate a Sui address for display: 0x1234...abcd */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 4) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
