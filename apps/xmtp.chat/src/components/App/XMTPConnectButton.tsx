import { Button, Group, Image, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useXMTP } from "@/contexts/XMTPContext";
import { useUpProvider } from "@/contexts/UpProviderContext";
import { useState, useEffect, useRef } from "react";

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
      // Check if we have the LUKSO provider
      if (!window.lukso) {
        console.error("XMTPConnectButton: No UP provider found");
        setError(new Error("No Universal Profile provider found. Please install the UP browser extension."));
        setIsConnecting(false);
        return;
      }

      console.log("XMTPConnectButton: LUKSO UP browser extension detected, attempting to connect...");

      // Ensure WASM bindings are loaded before proceeding
      try {
        console.log("XMTPConnectButton: Ensuring WASM bindings are loaded");

        // Check if WASM is already loaded
        const wasmStatus = (window as any).wasmLoadingStatus || { attempted: false, successful: false };

        if (!wasmStatus.successful) {
          console.log("XMTPConnectButton: WASM not yet loaded, attempting to load");
          try {
            // Try to load WASM bindings
            await import('@xmtp/wasm-bindings');
            console.log("XMTPConnectButton: Successfully loaded WASM bindings");
            (window as any).wasmLoadingStatus = { attempted: true, successful: true, error: null };
          } catch (wasmError) {
            console.error("XMTPConnectButton: Failed to load WASM bindings:", wasmError);
            throw new Error(`WASM bindings could not be loaded: ${(wasmError as Error)?.message || 'Unknown error'}`);
          }
        } else {
          console.log("XMTPConnectButton: WASM bindings already loaded");
        }
      } catch (wasmError) {
        console.error("XMTPConnectButton: WASM preloading error:", wasmError);
        handleXmtpError(wasmError);
        return;
      }

      // First, request accounts from the LUKSO provider
      if (typeof window.lukso.request === 'function') {
        try {
          // This will prompt the user to connect their UP if not already connected
          await window.lukso.request({ method: 'eth_requestAccounts' });
          console.log("XMTPConnectButton: LUKSO accounts requested successfully");

          // Now get the UP address
          const accounts = await window.lukso.request({ method: 'eth_accounts' });

          if (!accounts || accounts.length === 0) {
            console.error("XMTPConnectButton: No accounts returned after connection");
            setError(new Error("No accounts found after connecting. Please try again."));
            setIsConnecting(false);
            return;
          }

          const upAddress = accounts[0].toLowerCase() as `0x${string}`;
          console.log("XMTPConnectButton: Connected with UP address:", upAddress);

          try {
            console.log("XMTPConnectButton: Creating SCW signer for XMTP client");

            // Get the current chain ID from the LUKSO provider
            const chainIdHex = await window.lukso.request({
              method: 'eth_chainId',
              params: []
            }) as string;

            // Convert hex chain ID to number
            const chainId = parseInt(chainIdHex, 16);
            console.log(`XMTPConnectButton: Current chain ID: ${chainId}`);

            // Import and create the SCW signer
            const { createSCWSigner } = await import('@/helpers/createSigner');
            const scwSigner = createSCWSigner(upAddress, chainId);

            console.log("XMTPConnectButton: Created SCW signer, initializing XMTP client");

            // Implement a retry mechanism for client creation
            let newClient;
            let attemptCount = 0;
            const maxAttempts = 3;

            while (attemptCount < maxAttempts && !newClient) {
              attemptCount++;
              try {
                console.log(`XMTPConnectButton: Client creation attempt ${attemptCount} of ${maxAttempts}`);

                // Create authorization message for the user to sign
                const authMessage = `I am connecting to XMTP with my Universal Profile.\n\nThis allows XMTP messages to be sent and received with this profile.\n\nAddress: ${upAddress}\nTimestamp: ${Date.now()}`;

                // Have the user sign the authorization message
                console.log("XMTPConnectButton: Requesting user to sign XMTP authorization message");
                const signature = await window.lukso.request({
                  method: 'personal_sign',
                  params: [authMessage, upAddress]
                });

                console.log("XMTPConnectButton: User signed authorization message");

                // Initialize XMTP client with the SCW signer
                newClient = await initialize({
                  signer: scwSigner,
                  loggingLevel: 'debug',
                  env: 'dev'
                });

                if (newClient) {
                  console.log(`XMTPConnectButton: Client created successfully on attempt ${attemptCount}`);
                  break;
                }
              } catch (error) {
                console.warn(`XMTPConnectButton: Client creation attempt ${attemptCount} failed:`, error);

                if (attemptCount < maxAttempts) {
                  console.log(`XMTPConnectButton: Waiting before retry attempt ${attemptCount + 1}...`);
                  // Wait before retrying (increasing delay with each attempt)
                  await new Promise(resolve => setTimeout(resolve, attemptCount * 1000));
                } else {
                  console.error("XMTPConnectButton: All client creation attempts failed");
                }
              }
            }

            if (newClient) {
              console.log("XMTPConnectButton: Client created successfully with SCW signer", {
                clientAddress: (newClient as any).address || upAddress,
                hasInboxId: !!(newClient as any).inboxId
              });

              // Store a flag indicating successful connection
              try {
                localStorage.setItem('xmtp_client_created', 'true');
                localStorage.setItem('xmtp_up_address', upAddress);
              } catch (storageError) {
                console.warn("XMTPConnectButton: Failed to store connection info in localStorage", storageError);
              }

              // Set the client in state
              setClient(newClient);
              setClientInitialized(true);

              // Navigate to conversations page
              console.log("XMTPConnectButton: Navigating to /conversations");
              navigate('/conversations', { replace: true });
            } else {
              console.error("XMTPConnectButton: Client creation returned null");
              setError(new Error('Failed to create XMTP client'));
            }
          } catch (error) {
            const clientError = error as Error;
            console.error("XMTPConnectButton: Error creating XMTP client:", clientError);
            setError(new Error(`Error creating XMTP client: ${clientError.message || 'Unknown error'}`));
          }
        } catch (error) {
          const requestError = error as Error;
          console.error("XMTPConnectButton: Error requesting LUKSO accounts:", requestError);
          setError(new Error(`Error connecting to Universal Profile: ${requestError.message || 'Unknown error'}`));
        }
      } else {
        console.error("XMTPConnectButton: LUKSO provider does not have request method");
        setError(new Error("Your Universal Profile provider is not compatible. Please update your browser extension."));
      }

      // Handle non-UP wallets if needed
      handleNonUpWallets();

    } catch (err: any) {
      handleXmtpError(err);
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
