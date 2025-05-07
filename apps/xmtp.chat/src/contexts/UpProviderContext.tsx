/**
 * Centralized UpProviderContext for managing Universal Profile (UP) provider state.
 * Similar to miniapp-nextjs-template, but adapted for xmtp.chat needs.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClientUPProvider, type UPClientProvider } from "@lukso/up-provider";
import { createWalletClient, custom } from "viem";
import { lukso, luksoTestnet } from "viem/chains";

interface UpProviderContextType {
  provider: UPClientProvider | null;
  client: ReturnType<typeof createWalletClient> | null;
  chainId: number;
  accounts: Array<`0x${string}`>;
  contextAccounts: Array<`0x${string}`>;
  walletConnected: boolean;
  selectedAddress: `0x${string}` | null;
  setSelectedAddress: (address: `0x${string}` | null) => void;
  isSearching: boolean;
  setIsSearching: (isSearching: boolean) => void;
}

const UpProviderContext = createContext<UpProviderContextType | undefined>(undefined);

// Export UP provider singleton for use everywhere
export const upProviderSingleton: UPClientProvider | null = typeof window !== "undefined" ? createClientUPProvider() : null;

export function useUpProvider() {
  const context = useContext(UpProviderContext);
  if (!context) {
    throw new Error("useUpProvider must be used within an UpProviderContext");
  }
  return context;
}

interface UpProviderProps {
  children: ReactNode;
}

export function UpProvider({ children }: UpProviderProps) {
  const [chainId, setChainId] = useState<number>(0);
  const [accounts, setAccounts] = useState<Array<`0x${string}`>>([]);
  const accountsRef = React.useRef<Array<`0x${string}`>>([]);
  const [contextAccounts, setContextAccounts] = useState<Array<`0x${string}`>>([]);
  const [walletConnected, setWalletConnected] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<`0x${string}` | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Use the singleton in the component
  const provider = upProviderSingleton;

  // Memoized wallet client
  const client = useMemo(() => {
    if (provider && chainId) {
      return createWalletClient({
        chain: chainId === 42 ? lukso : luksoTestnet,
        transport: custom(provider),
      });
    }
    return null;
  }, [provider, chainId]);

  // Polling for contextAccounts updates
  useEffect(() => {
    if (!provider) return;
    let prev = JSON.stringify(provider.contextAccounts || []);
    const interval = setInterval(() => {
      const curr = JSON.stringify(provider.contextAccounts || []);
      if (curr !== prev) {
        console.log('[UpProviderContext] Poll detected contextAccounts change:', provider.contextAccounts);
        setContextAccounts([...provider.contextAccounts]);
        prev = curr;
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [provider]);

  useEffect(() => {
    console.log('[UpProviderContext] useEffect for event registration running. Provider:', provider);

    let mounted = true;
    async function init() {
      try {
        if (!provider) return;
        const _accounts = (await provider.request("eth_accounts", [])) as Array<`0x${string}`>;
        if (!mounted) return;
        setAccounts(_accounts);
        const _chainId = parseInt(await provider.request("eth_chainId"), 16);
        if (!mounted) return;
        setChainId(_chainId);
        const _contextAccounts = provider.contextAccounts;
        if (!mounted) return;
        setContextAccounts(_contextAccounts);
        setWalletConnected(_accounts[0] != null);
      } catch (error) {
        console.error("[UpProviderContext] Error initializing provider:", error);
      }
    }
    init();
    if (provider) {
      const accountsChanged = (_accounts: Array<`0x${string}`>) => {
        console.log('[UpProviderContext] accountsChanged event received:', _accounts);

        setAccounts((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(_accounts)) {
            accountsRef.current = _accounts;
            return [..._accounts];
          }
          accountsRef.current = _accounts;
          return prev;
        });
        setWalletConnected(_accounts[0] != null);
      };
      const contextAccountsChanged = (_accounts: Array<`0x${string}`>) => {
        console.log('[UpProviderContext] contextAccountsChanged event received:', _accounts);
        if (provider) {
          console.log('[UpProviderContext] provider.contextAccounts:', provider.contextAccounts);
        }
        setContextAccounts([..._accounts]); // force new array reference for reactivity
        // Do NOT setWalletConnected here; only accountsChanged should control it
      };

      const chainChanged = (_chainId: number) => {
        setChainId(_chainId);
      };
      provider.on("accountsChanged", accountsChanged);
      provider.on("chainChanged", chainChanged);
      provider.on("contextAccountsChanged", contextAccountsChanged);
      return () => {
        mounted = false;
        provider.removeListener("accountsChanged", accountsChanged);
        provider.removeListener("contextAccountsChanged", contextAccountsChanged);
        provider.removeListener("chainChanged", chainChanged);
      };
    }
  }, [provider]);

  return (
    <UpProviderContext.Provider
      value={{
        provider,
        client,
        chainId,
        accounts,
        contextAccounts,
        walletConnected,
        selectedAddress,
        setSelectedAddress,
        isSearching,
        setIsSearching,
      }}
    >
      {children}
    </UpProviderContext.Provider>
  );
}
