"use client";

import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { MyListingCard } from "@/components/seller/my-listing-card";
import { MyPackageCard } from "@/components/seller/my-package-card";
import { VaultCard } from "@/components/seller/vault-card";
import { useMyListings } from "@/hooks/use-my-listings";
import { useMyPackages } from "@/hooks/use-my-packages";
import { usePurchaseReceipts } from "@/hooks/use-purchase-receipts";

export default function SellerDashboardPage() {
  const account = useCurrentAccount();
  const { data: myListings, isLoading: listingsLoading } = useMyListings();
  const { data: myPackages, isLoading: packagesLoading } = useMyPackages();
  const { data: receipts } = usePurchaseReceipts();

  if (!account) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Seller Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-muted-foreground">
              Connect your wallet to manage your listings.
            </p>
            <ConnectButton />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Seller Dashboard</h1>
      </div>

      <Tabs defaultValue="skills">
        <TabsList>
          <TabsTrigger value="skills">My Skills</TabsTrigger>
          <TabsTrigger value="packages">My Packages</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button asChild>
              <Link href="/seller/create">Create Skill</Link>
            </Button>
          </div>
          {listingsLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : !myListings || myListings.length === 0 ? (
            <EmptyState
              title="No skills listed"
              description="Create your first skill listing to start selling on the marketplace."
            />
          ) : (
            <div className="space-y-4">
              {myListings.map((ml) => (
                <MyListingCard
                  key={ml.listing.id}
                  myListing={ml}
                  receipt={receipts?.find((r) => r.skillIds.includes(ml.listing.id))}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="packages" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button asChild>
              <Link href="/seller/create-package">Create Package</Link>
            </Button>
          </div>
          {packagesLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : !myPackages || myPackages.length === 0 ? (
            <EmptyState
              title="No packages listed"
              description="Bundle your skills into packages to offer discounts to buyers."
            />
          ) : (
            <div className="space-y-4">
              {myPackages.map((mp) => (
                <MyPackageCard key={mp.listing.id} myPackage={mp} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="revenue" className="mt-6">
          <VaultCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
