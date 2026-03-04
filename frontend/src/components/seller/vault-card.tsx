"use client";

import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/error-alert";
import { useSellerVault } from "@/hooks/use-seller-vault";
import { useSellerVaultDetail } from "@/hooks/use-seller-vault-detail";
import { useCreateVault } from "@/hooks/use-create-vault";
import { useWithdraw } from "@/hooks/use-withdraw";
import { formatSui } from "@/lib/utils";
import { MIST_PER_SUI } from "@/lib/constants";

export function VaultCard() {
  const account = useCurrentAccount();
  const { data: vaultId, isLoading: vaultLoading } = useSellerVault(account?.address);
  const { data: vaultDetail, isLoading: detailLoading } = useSellerVaultDetail(vaultId);
  const createVaultMutation = useCreateVault();
  const withdrawMutation = useWithdraw();
  const [withdrawAmount, setWithdrawAmount] = useState("");

  if (vaultLoading || detailLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!vaultId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Create a vault to receive payments from your sales.
          </p>
          <ErrorAlert error={createVaultMutation.error instanceof Error ? createVaultMutation.error : null} />
          <Button
            disabled={createVaultMutation.isPending}
            onClick={() => createVaultMutation.mutate()}
          >
            {createVaultMutation.isPending ? "Creating..." : "Create Vault"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const balance = vaultDetail?.balance ?? 0n;

  const handleWithdraw = () => {
    const sui = parseFloat(withdrawAmount);
    if (isNaN(sui) || sui <= 0) return;
    const mist = BigInt(Math.floor(sui * Number(MIST_PER_SUI)));
    withdrawMutation.mutate(
      { vaultId, amount: mist },
      { onSuccess: () => setWithdrawAmount("") },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm text-muted-foreground">Vault Balance</div>
          <div className="text-2xl font-bold">{formatSui(balance)}</div>
        </div>
        {balance > 0n && (
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="0.1"
              placeholder="Amount in SUI"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
            <Button
              disabled={withdrawMutation.isPending || !withdrawAmount}
              onClick={handleWithdraw}
            >
              {withdrawMutation.isPending ? "Withdrawing..." : "Withdraw"}
            </Button>
          </div>
        )}
        <ErrorAlert error={withdrawMutation.error instanceof Error ? withdrawMutation.error : null} />
      </CardContent>
    </Card>
  );
}
