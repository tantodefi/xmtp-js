import { Box, Group, LoadingOverlay, Stack, Image } from "@mantine/core";
import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { hexToUint8Array } from "uint8array-extras";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { WalletClient, Hex } from "viem";
import { useAccount, useConnect, useConnectors, useWalletClient } from "wagmi";
import { upProviderSingleton } from '../../contexts/UpProviderContext';
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
        const provider = upProviderSingleton;

        // Listen for account changes
        provider.on('accountsChanged', (accounts: string[]) => {
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

  // Removed auto-initialization of XMTP client on mount. XMTP connection is now only triggered by explicit user action.
  // useEffect(() => {
  //   if (ephemeralAccountEnabled && ephemeralAccountKey) {
  //     handleEphemeralConnect();
  //   }
  // }, []);

  // Removed auto-initialization of wallet/XMTP client on mount or account change. XMTP connection is now only triggered by explicit user action.
  // useEffect(() => {
  //   const initClient = async () => { ... };
  //   void initClient();
  // }, [account.address, data?.account, encryptionKey, environment, initialize, loggingLevel]);

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
