import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MIST_PER_SUI } from "./constants";

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

/** Truncate a Sui address for display: 0x1234...abcd */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 4) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
