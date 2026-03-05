import { Skeleton } from "@/components/ui/skeleton";
import { PlaybookGrid } from "./skills/playbook-grid";

export function LoadingSkeleton({ count = 8 }: { count?: number }) {
  return (
    <PlaybookGrid>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-14" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </PlaybookGrid>
  );
}
