"use client";

import { useCallback, useRef } from "react";
import { SessionKey } from "@mysten/seal";
import type { ExportedSessionKey } from "@mysten/seal";
import { get, set, del } from "idb-keyval";
import { useDAppKit, useCurrentAccount } from "@mysten/dapp-kit-react";
import { useCurrentClient } from "@mysten/dapp-kit-react";
import { MARKETPLACE_PACKAGE_ID } from "@/lib/constants";

const SESSION_KEY_STORE_KEY = "wooper-seal-session-key";
const SESSION_TTL_MIN = 10;

export function useSessionKey() {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const suiClient = useCurrentClient();
  const sessionKeyRef = useRef<SessionKey | null>(null);

  const getOrCreateSessionKey = useCallback(async (): Promise<SessionKey> => {
    // Try in-memory cache first
    if (sessionKeyRef.current && !sessionKeyRef.current.isExpired()) {
      return sessionKeyRef.current;
    }

    // Try restoring from IndexedDB (import throws if expired or invalid)
    const stored = await get<ExportedSessionKey>(SESSION_KEY_STORE_KEY);
    if (stored) {
      try {
        const restored = SessionKey.import(stored, suiClient);
        if (!restored.isExpired()) {
          sessionKeyRef.current = restored;
          return restored;
        }
      } catch {
        // Expired or incompatible (e.g. different package after redeployment) — discard
        await del(SESSION_KEY_STORE_KEY);
      }
    }

    // Create a new session key
    if (!account) throw new Error("Wallet not connected");

    const sessionKey = await SessionKey.create({
      address: account.address,
      packageId: MARKETPLACE_PACKAGE_ID,
      ttlMin: SESSION_TTL_MIN,
      suiClient,
    });

    // Sign the personal message (triggers wallet popup)
    const message = sessionKey.getPersonalMessage();
    const { signature } = await dAppKit.signPersonalMessage({ message });
    await sessionKey.setPersonalMessageSignature(signature);

    // Persist to IndexedDB
    await set(SESSION_KEY_STORE_KEY, sessionKey.export());
    sessionKeyRef.current = sessionKey;

    return sessionKey;
  }, [account, suiClient, dAppKit]);

  return { getOrCreateSessionKey };
}
