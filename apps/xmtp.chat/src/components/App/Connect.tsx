import { Box, Group, LoadingOverlay, Stack, Image } from "@mantine/core";
import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { hexToUint8Array } from "uint8array-extras";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { WalletClient, Hex } from "viem";
import { useAccount, useConnect, useConnectors, useWalletClient } from "wagmi";
import { createClientUPProvider, type ClientUPProvider } from "@lukso/up-provider";
import { AccountCard } from "@/components/App/AccountCard";
import { DisableAnalytics } from "@/components/App/DisableAnalytics";
import { LoggingSelect } from "@/components/App/LoggingSelect";
import { NetworkSelect } from "@/components/App/NetworkSelect";
import { useXMTP } from "@/contexts/XMTPContext";
import {
  createDirectLuksoSigner,
  createEOASigner,
  createEphemeralSigner,
  createLuksoSigner,
  createMinimalSigner,
  createProxyEphemeralSigner,
  createSCWSigner,
  createStandardSigner,
  isLuksoUPProvider,
} from "@/helpers/createSigner";
import { useRedirect } from "@/hooks/useRedirect";
import { useSettings } from "@/hooks/useSettings";
import { CoinbaseWallet } from "@/icons/CoinbaseWallet";
import { EphemeralWallet } from "@/icons/EphemeralWallet";
import { InjectedWallet } from "@/icons/InjectedWallet";
import { MetamaskWallet } from "@/icons/MetamaskWallet";
import { WalletConnectWallet } from "@/icons/WalletConnectWallet";
import classes from "./Connect.module.css";

// Declare window ethereum with any type to avoid conflicts
declare global {
  interface Window {
    ethereum?: any;
    lukso?: any; // LUKSO browser extension may expose itself as window.lukso
  }
}

type ConnectorString =
  | "Injected"
  | "Coinbase Wallet"
  | "MetaMask"
  | "WalletConnect"
  | "UP";

export const Connect = () => {
  const { connect, status } = useConnect();
  const { data } = useWalletClient();
  const account = useAccount();
  const connectors = useConnectors();
  const navigate = useNavigate();
  const { redirectUrl, setRedirectUrl } = useRedirect();
  const { initialize, initializing, client } = useXMTP();
  const {
    ephemeralAccountEnabled,
    setEphemeralAccountEnabled,
    ephemeralAccountKey,
    setEphemeralAccountKey,
    encryptionKey,
    environment,
    loggingLevel,
  } = useSettings();

  // Ref to store the LUKSO UP provider
  const luksoProviderRef = useRef<ClientUPProvider | null>(null);

  // Initialize the LUKSO UP provider
  useEffect(() => {
    // Create the UP provider client if it doesn't exist yet
    if (!luksoProviderRef.current) {
      try {
        console.log("Initializing LUKSO UP Provider from @lukso/up-provider");
        const upProvider = createClientUPProvider();

        // Listen for account changes
        upProvider.on('accountsChanged', (accounts: string[]) => {
          console.log('UP Provider accounts changed:', accounts);
        });

        // Listen for chain changes
        upProvider.on('chainChanged', (chainId: string) => {
          console.log('UP Provider chain changed:', chainId);
        });

        // Store the provider in the ref
        luksoProviderRef.current = upProvider;

        console.log("LUKSO UP Provider initialized:", {
          hasProvider: !!upProvider,
          allowedAccounts: upProvider.allowedAccounts,
          contextAccounts: upProvider.contextAccounts
        });
      } catch (error) {
        console.error("Error initializing LUKSO UP Provider:", error);
      }
    }

    // Cleanup function
    return () => {
      if (luksoProviderRef.current) {
        // Remove any listeners if needed
        console.log("Cleaning up LUKSO UP Provider");
      }
    };
  }, []);

  // Log available connectors and window objects on component mount
  useEffect(() => {
    console.log("Connect component mounted");
    console.log("Available connectors:", connectors.map(c => c.name));
    console.log("Window ethereum:", window.ethereum);
    console.log("Window lukso:", window.lukso);

    // Try to detect if LUKSO extension is installed but not exposed
    try {
      type PotentialProvider = {
        isProvider?: boolean;
        [key: string]: any;
      };

      const providers = Object.keys(window).filter(key => {
        const obj = (window as any)[key] as PotentialProvider | null;
        return (
          typeof obj === 'object' &&
          obj !== null &&
          'isProvider' in obj
        );
      });
      console.log("Potential providers:", providers);
    } catch (error) {
      console.error("Error detecting providers:", error);
    }
  }, []);

  const handleEphemeralConnect = useCallback(() => {
    setEphemeralAccountEnabled(true);
    let accountKey = ephemeralAccountKey;
    if (!accountKey) {
      accountKey = generatePrivateKey();
      setEphemeralAccountKey(accountKey);
    }

    const signer = createEphemeralSigner(accountKey);
    void initialize({
      dbEncryptionKey: encryptionKey
        ? hexToUint8Array(encryptionKey)
        : undefined,
      env: environment,
      loggingLevel,
      signer,
    });
  }, [
    ephemeralAccountEnabled,
    ephemeralAccountKey,
    encryptionKey,
    environment,
    loggingLevel,
  ]);

  const handleWalletConnect = useCallback(
    (connectorString: ConnectorString) => () => {
      if (ephemeralAccountEnabled) {
        setEphemeralAccountEnabled(false);
      }
      const connector = connectors.find((c) => c.name === connectorString);
      if (!connector) {
        throw new Error(`Connector ${connectorString} not found`);
      }
      connect({ connector });
    },
    [connectors, connect, ephemeralAccountEnabled],
  );

  const handleUPConnect = async () => {
    try {
      if (!luksoProviderRef.current) {
        console.log("No LUKSO UP provider found, initializing...");
        luksoProviderRef.current = new LuksoProvider();

        // Check if we're in a grid context
        const isGridContext = window.location.search.includes('grid=true') ||
          sessionStorage.getItem('isGridContext') === 'true' ||
          localStorage.getItem('isGridContext') === 'true';

        // In grid context, be more aggressive about reusing existing session
        if (isGridContext) {
          console.log("Grid context detected - attempting to reconnect with stored credentials");
        }
      }

      if (luksoProviderRef.current) {
        console.log("Connecting to LUKSO UP provider...");

        // Check if we have a stored key for reconnection
        const storedUpAddress = localStorage.getItem('upAddress');
        if (storedUpAddress) {
          console.log(`Found stored UP address (${storedUpAddress.substring(0, 10)}...), will attempt to reconnect`);

          // Find the corresponding ephemeral key
          const luksoAddressKey = `lukso_ephemeral_key_${storedUpAddress.toLowerCase()}`;
          const hasStoredKey = localStorage.getItem(luksoAddressKey);

          if (hasStoredKey) {
            console.log("Found stored ephemeral key for reconnection");
          }
        }

        // Attempt to connect
        await handleSetConnector({
          connector: luksoConnector.current,
          account: null,
          provider: luksoProviderRef.current,
        });
      }
    } catch (error) {
      console.error("Error connecting to LUKSO UP provider:", error);
      setNetworkError("Failed to connect to LUKSO UP provider. Please make sure you have a Universal Profile extension installed.");
    }
  };

  // maybe initialize an XMTP client on mount
  useEffect(() => {
    // are we using an ephemeral account?
    if (ephemeralAccountEnabled && ephemeralAccountKey) {
      handleEphemeralConnect();
    }
  }, []);

  // look for wallet connection
  useEffect(() => {
    const initClient = async () => {
      const connector = account.connector;
      console.log("initClient called - checking for account:", {
        hasAccount: !!data?.account,
        hasConnector: !!connector,
        connectorName: connector?.name,
        status: status
      });

      if (data?.account && connector) {
        try {
          console.log("WalletClient structure:", {
            dataKeys: data ? Object.keys(data) : [],
            hasTransport: !!(data as any).transport,
            transportType: typeof (data as any).transport,
            account: data.account
          });

          // Get the provider and log it for debugging
          let provider;
          try {
            console.log("Attempting to get provider from connector:", connector.name);
            // Try multiple ways to get the provider
            if (connector.getProvider) {
              provider = await connector.getProvider();
              console.log("Got provider from connector.getProvider()");
            } else if ((data as any).transport) {
              provider = (data as any).transport;
              console.log("Got provider from data.transport");
            } else if ((data as any).provider) {
              provider = (data as any).provider;
              console.log("Got provider from data.provider");
            } else {
              // Try the UP provider from @lukso/up-provider first
              if (luksoProviderRef.current) {
                provider = luksoProviderRef.current;
                console.log("Got provider from luksoProviderRef.current");
              } else {
                // As a last resort, try window objects
                provider = window.lukso || window.ethereum;
                console.log("Got provider from window object:", provider === window.lukso ? "lukso" : "ethereum");
              }
            }
          } catch (providerError) {
            console.error("Error getting provider:", providerError);
          }

          console.log("Provider info:", {
            provider,
            window_lukso: window.lukso,
            has_lukso: !!window.lukso,
            provider_type: typeof provider,
            provider_methods: provider ? Object.keys(provider).slice(0, 10) : [],
            provider_isLukso: provider?.isLukso,
            provider_isUP: provider?.isUP,
            connector_name: connector.name,
            account_address: data.account.address,
            is_upProvider_package: luksoProviderRef.current === provider,
            has_upProvider_package: !!luksoProviderRef.current
          });

          if (provider) {
            // Use our utility function to detect LUKSO UP providers
            console.log("About to check if provider is LUKSO UP provider");

            // Check if it's a LUKSO provider - either browser extension or package
            const isLuksoProvider = isLuksoUPProvider(provider) || (!!luksoProviderRef.current && provider === luksoProviderRef.current);

            console.log("Provider detection result:", {
              provider: provider,
              isLuksoProvider: isLuksoProvider,
              windowLuksoDetection: window.lukso ? "window.lukso exists" : "no window.lukso",
              usingProxyEphemeralSigner: isLuksoProvider
            });

            const chainId = await connector.getChainId();

            let selectedSigner;
            if (isLuksoProvider) {
              console.log(`Initializing XMTP client for LUKSO UP with chainId ${chainId}`);

              // For LUKSO, we need to ensure the same account gets the same ephemeral key
              // across sessions, otherwise messages won't be persistent
              const luksoAddressKey = `lukso_ephemeral_key_${data.account.address.toLowerCase()}`;
              let tempPrivateKey;

              // Check if we already have a stored key for this LUKSO address
              const storedKey = localStorage.getItem(luksoAddressKey);
              if (storedKey) {
                console.log("Found stored ephemeral key for LUKSO address, ensuring persistence");
                tempPrivateKey = storedKey as Hex;
              } else {
                // Generate a new key and store it for future sessions
                console.log("Generating new ephemeral key for LUKSO address");
                tempPrivateKey = generatePrivateKey();
                localStorage.setItem(luksoAddressKey, tempPrivateKey);
              }

              // Store the UP address for future reconnection
              localStorage.setItem('upAddress', data.account.address);

              // Create a signer that will have persistent identity across sessions
              selectedSigner = createEphemeralSigner(tempPrivateKey);

              console.log("Using persistent ephemeral signer for LUKSO with UP identifier:", {
                luksoAddress: data.account.address,
                ephemeralAddress: privateKeyToAccount(tempPrivateKey).address,
                isPersistent: true
              });
            } else {
              console.log(`Initializing XMTP client with chainId ${chainId}, using EOA signer`);
              // For other wallets, use the standard EOA signer
              selectedSigner = createEOASigner(data.account.address, data);
            }

            // Initialize XMTP with the selected signer
            void initialize({
              dbEncryptionKey: encryptionKey
                ? hexToUint8Array(encryptionKey)
                : undefined,
              env: environment,
              loggingLevel,
              signer: selectedSigner
            });
          }
        } catch (error) {
          console.error("Error initializing client:", error);
        }
      }
    };
    void initClient();
  }, [account.address, data?.account, encryptionKey, environment, initialize, loggingLevel]);

  useEffect(() => {
    if (client) {
      if (redirectUrl) {
        setRedirectUrl("");
        void navigate(redirectUrl);
      } else {
        void navigate("/");
      }
    }
  }, [client]);

  const isBusy = status === "pending" || initializing;

  return (
    <Stack gap="0">
      <Stack gap="0" className={classes.root}>
        {isBusy && <LoadingOverlay visible />}
        <Group
          className={classes.options}
          align="center"
          justify="space-between"
          py="xs"
          px="md"
          wrap="nowrap">
          <NetworkSelect disabled={isBusy} />
          <LoggingSelect disabled={isBusy} />
        </Group>
        <AccountCard
          icon={<EphemeralWallet />}
          label="Ephemeral"
          onClick={handleEphemeralConnect}
        />
        <AccountCard
          icon={<Image src="/up-icon.jpeg" width={28} height={28} radius="sm" alt="Universal Profile" />}
          label="Universal Profile"
          onClick={handleUPConnect}
        />
        <AccountCard
          icon={<InjectedWallet />}
          label="Browser injected"
          onClick={handleWalletConnect("Injected")}
        />
        <AccountCard
          icon={<CoinbaseWallet />}
          label="Coinbase"
          onClick={handleWalletConnect("Coinbase Wallet")}
        />
        <AccountCard
          icon={<MetamaskWallet />}
          label="MetaMask"
          onClick={handleWalletConnect("MetaMask")}
        />
        <AccountCard
          icon={<WalletConnectWallet />}
          label="WalletConnect"
          onClick={handleWalletConnect("WalletConnect")}
        />
        <Box className={classes.options}>
          <DisableAnalytics />
        </Box>
      </Stack>
    </Stack>
  );
};
