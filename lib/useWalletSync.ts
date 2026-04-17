"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  connectWalletAccountOnly,
  getConnectedChainId,
  getConnectedWalletAddress,
  getExpectedChainId,
  isExpectedChainId,
  subscribeWalletEvents,
  toUiError,
} from "@/lib/blockchain";

type AlertType = "critical" | "success" | "info";
type PushAlert = (message: string, type: AlertType) => void;

type UseWalletSyncOptions = {
  clearMessage?: string;
};

function shortAddress(address: string) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function useWalletSync(pushAlert: PushAlert, options: UseWalletSyncOptions = {}) {
  const [walletAddress, setWalletAddress] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const lastAddressRef = useRef("");

  const expectedChainId = useMemo(() => getExpectedChainId(), []);
  const walletOnExpectedChain = isExpectedChainId(walletChainId);

  const hydrateWallet = useCallback(async () => {
    try {
      const [address, chainId] = await Promise.all([
        getConnectedWalletAddress(),
        getConnectedChainId(),
      ]);

      const normalizedAddress = address || "";
      lastAddressRef.current = normalizedAddress;
      setWalletAddress(normalizedAddress);
      setWalletChainId(chainId);
    } catch {
      // Ignore wallet discovery errors during initial load.
    }
  }, []);

  const handleConnectWallet = useCallback(async () => {
    setWalletBusy(true);
    try {
      const { address } = await connectWalletAccountOnly();
      const chainId = await getConnectedChainId();

      lastAddressRef.current = address;
      setWalletAddress(address);
      setWalletChainId(chainId);
      pushAlert(`Wallet connected: ${shortAddress(address)}`, "success");
    } catch (error) {
      pushAlert(toUiError(error), "critical");
    } finally {
      setWalletBusy(false);
    }
  }, [pushAlert]);

  const handleClearWallet = useCallback(() => {
    setWalletAddress("");
    lastAddressRef.current = "";

    pushAlert(options.clearMessage || "Wallet status cleared for this session.", "info");
  }, [options.clearMessage, pushAlert]);

  useEffect(() => {
    void hydrateWallet();
  }, [hydrateWallet]);

  useEffect(() => {
    const unsubscribe = subscribeWalletEvents({
      onAccountsChanged: (accounts) => {
        const nextAddress = accounts[0] ? String(accounts[0]) : "";
        const prevAddress = lastAddressRef.current;

        lastAddressRef.current = nextAddress;
        setWalletAddress(nextAddress);

        if (!nextAddress) {
          pushAlert("Wallet disconnected in MetaMask.", "info");
          return;
        }

        if (!prevAddress) {
          pushAlert(`Wallet connected: ${shortAddress(nextAddress)}`, "success");
          return;
        }

        if (prevAddress.toLowerCase() !== nextAddress.toLowerCase()) {
          pushAlert(`Wallet account changed: ${shortAddress(nextAddress)}`, "info");
        }
      },
      onChainChanged: (chainId) => {
        setWalletChainId(chainId);

        if (chainId === null) return;

        if (expectedChainId !== null && chainId !== expectedChainId) {
          pushAlert(`Wrong network detected. Switch wallet to chain id ${expectedChainId}.`, "critical");
          return;
        }

        pushAlert(`Network switched to chain id ${chainId}.`, "info");
      },
      onConnect: (chainId) => {
        if (chainId !== null) {
          setWalletChainId(chainId);
        }
      },
      onDisconnect: (info) => {
        setWalletBusy(false);
        setWalletAddress("");
        setWalletChainId(null);
        lastAddressRef.current = "";

        const code = typeof info.code === "number" ? info.code : null;
        const details = code !== null ? ` (code ${code})` : "";

        if (code === 1013) {
          pushAlert(`Wallet connection was interrupted${details}. Click Connect Wallet to continue.`, "info");
          return;
        }

        pushAlert(`Wallet disconnected${details}.`, "critical");
      },
    });

    return unsubscribe;
  }, [expectedChainId, pushAlert]);

  return {
    walletAddress,
    walletBusy,
    walletChainId,
    expectedChainId,
    walletOnExpectedChain,
    handleConnectWallet,
    handleClearWallet,
  };
}
