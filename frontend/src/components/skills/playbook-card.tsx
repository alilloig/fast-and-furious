import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "./price-display";
import { truncateAddress } from "@/lib/utils";
import type { PlaybookListing } from "@/lib/types";

export function PlaybookCard({ playbook }: { playbook: PlaybookListing }) {
  return (
    <Link href={`/playbook/${playbook.id}`}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1 text-base">{playbook.title}</CardTitle>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {playbook.category}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {playbook.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {playbook.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {playbook.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{playbook.tags.length - 3}
              </Badge>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between text-sm">
          <PriceDisplay price={playbook.price} className="font-semibold" />
          <span className="text-muted-foreground">
            {truncateAddress(playbook.seller)}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
