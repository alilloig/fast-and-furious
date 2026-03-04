"use client";

import { IS_DEPLOYED } from "@/lib/constants";

export function NotDeployedBanner() {
  if (IS_DEPLOYED) return null;

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-center text-sm text-yellow-700 dark:text-yellow-400">
      Development Preview — contracts not deployed. Showing sample data.
    </div>
  );
}
