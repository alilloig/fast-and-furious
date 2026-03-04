import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "./price-display";
import { truncateAddress } from "@/lib/utils";
import type { PackageListing } from "@/lib/types";

export function PackageCard({ pkg }: { pkg: PackageListing }) {
  const discountPercent = (pkg.discountBps / 100).toFixed(0);

  return (
    <Link href={`/package/${pkg.id}`}>
      <Card className="h-full border-primary/20 transition-colors hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1 text-base">{pkg.title}</CardTitle>
            <Badge className="shrink-0 text-xs">Bundle</Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {pkg.description}
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{pkg.skillIds.length} skills</span>
            {pkg.discountBps > 0 && (
              <Badge variant="secondary" className="text-xs">
                {discountPercent}% off
              </Badge>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between text-sm">
          <PriceDisplay price={pkg.price} className="font-semibold" />
          <span className="text-muted-foreground">
            {truncateAddress(pkg.seller)}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
