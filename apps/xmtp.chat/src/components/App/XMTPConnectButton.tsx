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
          
          // Use the UP signer that will prompt the user to sign with their Universal Profile
          const { createUPSigner } = await import('@/helpers/createSigner');
          const signer = createUPSigner(upAddress);
          
          console.log("XMTPConnectButton: Creating XMTP client with UP signer");
          
          try {
            // Instead of using the UP signer directly, we'll create an ephemeral key
            // and have the user sign a message to authorize it
            console.log("XMTPConnectButton: Creating ephemeral key for XMTP client");
            
            // Check if we have a stored ephemeral key for this UP address
            const storedEphemeralKey = localStorage.getItem('xmtp_ephemeral_key');
            const storedUpAddress = localStorage.getItem('xmtp_up_address');
            
            // Generate a random private key for the ephemeral signer or use stored one
            let ephemeralPrivateKey: `0x${string}`;
            let needsUserSignature = true;
            
            if (storedEphemeralKey && storedUpAddress && storedUpAddress.toLowerCase() === upAddress.toLowerCase()) {
              console.log("XMTPConnectButton: Found stored ephemeral key for this UP address, attempting to reuse");
              ephemeralPrivateKey = storedEphemeralKey as `0x${string}`;
              needsUserSignature = false;
            } else {
              console.log("XMTPConnectButton: No stored ephemeral key found or UP address changed, creating new one");
              ephemeralPrivateKey = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')}` as `0x${string}`;
            }
            
            // If we need a new signature, request it from the user
            if (needsUserSignature) {
              // Create an authorization message for the user to sign
              const authMessage = `I am connecting to XMTP using a one-time key that will be used only for this session. This does not give anyone access to my Universal Profile or any assets.\n\nAddress: ${upAddress}\nTimestamp: ${Date.now()}`;
              
              console.log("XMTPConnectButton: Requesting user to sign authorization message");
              
              // Have the user sign the authorization message with their UP
              const signature = await window.lukso.request({
                method: 'personal_sign',
                params: [authMessage, upAddress]
              });
              
              console.log("XMTPConnectButton: User signed authorization message", { signature });
            }
            
            // Create an ephemeral signer with the generated or stored private key
            const { createEphemeralSigner } = await import('@/helpers/createSigner');
            const ephemeralSigner = createEphemeralSigner(ephemeralPrivateKey);
            
            console.log("XMTPConnectButton: Created ephemeral signer, initializing XMTP client");
            
            console.log("XMTPConnectButton: Attempting XMTP client creation with retries");
            
            // Implement a retry mechanism for client creation
            let newClient;
            let attemptCount = 0;
            const maxAttempts = 3;
            
            while (attemptCount < maxAttempts && !newClient) {
              attemptCount++;
              try {
                console.log(`XMTPConnectButton: Client creation attempt ${attemptCount} of ${maxAttempts}`);
                
                // Initialize XMTP client with the ephemeral signer
                // Use a longer timeout for the client creation
                newClient = await initialize({ 
                  signer: ephemeralSigner, 
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
              console.log("XMTPConnectButton: Client created successfully with ephemeral key", {
                // Use safe property access for TypeScript
                clientAddress: (newClient as any).address || upAddress,
                hasInboxId: !!(newClient as any).inboxId
              });
              
              // Store the ephemeral key in localStorage for future sessions
              try {
                localStorage.setItem('xmtp_ephemeral_key', ephemeralPrivateKey);
                localStorage.setItem('xmtp_up_address', upAddress);
                localStorage.setItem('xmtp_client_created', 'true');
              } catch (storageError) {
                console.warn("XMTPConnectButton: Failed to store ephemeral key in localStorage", storageError);
              }
              
              // Explicitly set the client in state
              setClient(newClient);
              setClientInitialized(true);
              
              // Wait a moment to ensure the client is set in state
              setTimeout(() => {
                // Double-check that the client is set
                console.log("XMTPConnectButton: Verifying client is set in state before navigation", { hasClient: !!client });
                
                // Navigate to conversations page
                console.log("XMTPConnectButton: Navigating to /conversations");
                navigate('/conversations', { replace: true });
                
                // Force navigation after a short delay if React Router doesn't work
                setTimeout(() => {
                  if (window.location.pathname !== '/conversations') {
                    console.log("XMTPConnectButton: Still on welcome page, forcing navigation to /conversations");
                    window.location.href = '/conversations';
                  }
                }, 500);
              }, 100);
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
    } else {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Determine button state and tooltip
  const isDisabled = disabled || !!client || initializing || !contextAccounts[0];
  const tooltipLabel = contextAccounts[0] 
    ? (client 
      ? 'Already connected to XMTP' 
      : 'Sign in to XMTP with a Proxy Ephemeral Signer') 
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
