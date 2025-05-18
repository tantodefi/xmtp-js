import { Button, Group, Image, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useXMTP } from "@/contexts/XMTPContext";
import { useUpProvider } from "@/contexts/UpProviderContext";
import { useState, useEffect, useRef } from "react";
import { createSCWSigner, createDirectLuksoSigner } from '@/helpers/createSigner';
import { Client } from '@xmtp/browser-sdk';
import type { Signer } from '@xmtp/browser-sdk';

export function XMTPConnectButton({ onClick, disabled, walletConnected }: { onClick?: () => void; disabled?: boolean; walletConnected?: boolean }) {
  const { initialize, initializing, client, setClient } = useXMTP();
  const { contextAccounts } = useUpProvider();
  const navigate = useNavigate();
  const [error, setError] = useState<Error | null>(null);
  const [clientInitialized, setClientInitialized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Log client state on mount and when client changes
  useEffect(() => {
    console.log("XMTPConnectButton: Client state changed:", {
      clientExists: !!client,
      hasInboxId: client ? !!client.inboxId : false,
      currentPath: window.location.pathname
    });

    // If client exists and we're not on the conversations page, navigate there
    if (client && window.location.pathname !== '/conversations') {
      console.log("XMTPConnectButton: Client exists, navigating to /conversations");

      // Try React Router navigation first
      try {
        navigate('/conversations', { replace: true });
      } catch (e) {
        console.error("Navigation error with React Router:", e);
        // Fallback to direct location change
        window.location.href = '/conversations';
      }
    }
  }, [client, navigate]);

  // Clear any previous error when client changes
  useEffect(() => {
    if (client) {
      setError(null);
    }
  }, [client]);

  const handleConnect = async () => {
    if (onClick) {
      onClick();
      return;
    }

    setError(null);
    setClientInitialized(false);
    setIsConnecting(true);

    // Clean up any previous XMTP session state
    try {
      localStorage.removeItem("xmtp.context.autoConnect");
      sessionStorage.removeItem("xmtp.auth.status");
    } catch (e) {
      // ignore
    }

    try {
      console.log("XMTPConnectButton: LUKSO UP browser extension detected, attempting to connect...");

      // Get the LUKSO provider
      const provider = window.lukso;
      if (!provider?.request) {
        throw new Error("LUKSO provider not found or missing request method");
      }

      // Request accounts
      console.log("XMTPConnectButton: Requesting LUKSO accounts");
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      console.log("XMTPConnectButton: LUKSO accounts requested successfully");

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const address = accounts[0] as `0x${string}`;
      console.log("XMTPConnectButton: Connected with UP address:", address);

      // Create direct LUKSO signer for the UP
      console.log("XMTPConnectButton: Creating direct LUKSO signer for XMTP client");
      const signer = createDirectLuksoSigner(address);
      console.log("XMTPConnectButton: Created direct LUKSO signer, initializing XMTP client");

      // Initialize XMTP client with retries
      let client;
      let attempts = 0;
      const maxAttempts = 3;
      const retryDelay = 2000; // 2 seconds

      while (attempts < maxAttempts) {
        attempts++;
        console.log(`XMTPConnectButton: Client creation attempt ${attempts} of ${maxAttempts}`);

        try {
          // Request signature for XMTP authorization
          console.log("XMTPConnectButton: Requesting user to sign XMTP authorization message");
          const authMessage = "XMTP Authorization";
          const signature = await signer.signMessage(authMessage);
          console.log("XMTPConnectButton: User signed authorization message");

          // Create XMTP client with SCW signer
          client = await Client.create(signer, { env: "dev" });

          if (client) {
            console.log("XMTPConnectButton: Successfully created XMTP client");
            break;
          }
        } catch (error) {
          console.error(`XMTPConnectButton: Client creation attempt ${attempts} failed:`, error);
          if (attempts < maxAttempts) {
            console.log(`XMTPConnectButton: Waiting before retry attempt ${attempts + 1}...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          } else {
            throw error;
          }
        }
      }

      if (!client) {
        throw new Error("Failed to create XMTP client after multiple attempts");
      }

      // Store the client
      setClient(client);
      console.log("XMTPConnectButton: XMTP client stored successfully");

    } catch (error) {
      console.error("XMTPConnectButton: Error connecting to XMTP:", error);
      setError(error instanceof Error ? error : new Error("Failed to connect to XMTP"));
    }
  };

  const handleNonUpWallets = async () => {
    // For non-UP wallets, we would need to create appropriate signers
    // This is a placeholder for future implementation
    setError(new Error('Non-UP wallet support is not fully implemented yet. Please use a Universal Profile.'));
  };

  const handleXmtpError = (err: any) => {
    if (err?.name === "SwitchChainNotSupportedError" ||
      (typeof err?.message === 'string' && err.message.includes('does not support programmatic chain switching'))) {
      setError(new Error('Universal Profile does not support programmatic chain switching. Please switch to the correct network in your wallet and try again.'));
    }
    else if (typeof err?.message === 'string' && err.message.includes('WASM')) {
      console.error("WASM loading issue detected:", err);
      setError(new Error('XMTP WASM libraries failed to load. This may be due to browser security settings or network issues. Try refreshing the page or try a different browser.'));
    }
    else if (typeof err?.message === 'string' && err.message.includes('worker error')) {
      console.error("Worker error detected:", err);
      setError(new Error('XMTP worker failed to initialize. This is likely a temporary issue. Please try again in a few moments.'));
    }
    else if (typeof err?.message === 'string' && err.message.includes('Unknown signer')) {
      console.error("Unknown signer error detected:", err);
      setError(new Error('Universal Profile is not recognized as a valid XMTP signer. Please make sure you have the latest UP Browser Extension installed.'));
    }
    else {
      setError(err instanceof Error ? err : new Error(String(err)));
    }

    // Always set connecting to false
    setIsConnecting(false);
  };

  // Determine button state and tooltip
  const isDisabled = disabled || !!client || initializing || !contextAccounts[0];
  const tooltipLabel = contextAccounts[0]
    ? (client
      ? 'Already connected to XMTP'
      : 'Sign in to XMTP with your Universal Profile')
    : 'Connect your wallet first';

  return (
    <Button
      fullWidth
      size="md"
      leftSection={
        <Group gap={8}>
          <Image src="/xmtp-icon.png" alt="XMTP Logo" width={24} height={24} />
        </Group>
      }
      onClick={handleConnect}
      disabled={isDisabled}
      loading={initializing}
      style={{ fontWeight: 600, fontSize: 18 }}
      color="dark"
      radius="md"
      variant="filled"
    >
      {initializing ? 'Connecting to XMTP...' : client ? 'Connected to XMTP' : 'Connect to XMTP'}
    </Button>
  );
}
