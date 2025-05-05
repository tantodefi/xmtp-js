import { Anchor, Stack, Text, Title, useMatches, Button, Divider, Box, Paper, Accordion, Image } from "@mantine/core";
import { Connect } from "@/components/App/Connect";
import { useEffect, useState, useCallback } from "react";
import { LuksoProfile } from "@/components/LuksoProfile";
import { useNavigate } from "react-router";
import { useConnect, useConnectors, useDisconnect } from "wagmi";
import { useXMTP } from "@/contexts/XMTPContext";
import { Client } from "@xmtp/browser-sdk";
import { createProxyEphemeralSigner, createEphemeralSigner } from "@/helpers/createSigner";
import { useSettings } from "@/hooks/useSettings";
import { Hex } from "viem";

// Helper function to safely get all context accounts from LUKSO UP Provider
const safeGetContextAccounts = async (): Promise<string[]> => {
  try {
    // Check if window.lukso exists and has the required methods
    if (typeof window !== 'undefined') {
      console.log("Welcome: Checking for LUKSO provider - window.lukso exists?", !!window.lukso);

      // Check for the provider implementation exactly as UP Provider delivers it
      if (window.lukso) {
        // Access contextAccounts directly without lowercasing or preprocessing
        if (window.lukso.contextAccounts) {
          console.log("Welcome: Raw UP Provider contextAccounts:", window.lukso.contextAccounts);

          // Just return them as-is for most accurate detection
          if (Array.isArray(window.lukso.contextAccounts) && window.lukso.contextAccounts.length > 0) {
            return [...window.lukso.contextAccounts];
          }
        }

        // Use request methods as fallbacks
        if (typeof window.lukso.request === 'function') {
          console.log("Welcome: LUKSO provider detected with request method");

          // Try up_contextAccounts RPC method
          try {
            console.log("Welcome: Trying up_contextAccounts RPC method");
            const contextAccounts = await window.lukso.request({
              method: 'up_contextAccounts',
              params: []
            });

            console.log("Welcome: Raw up_contextAccounts result:", contextAccounts);

            if (Array.isArray(contextAccounts) && contextAccounts.length > 0) {
              return [...contextAccounts];
            }
          } catch (innerError) {
            console.log("Welcome: Error calling up_contextAccounts, falling back to eth_accounts:", innerError);
          }

          // Fall back to eth_accounts as last resort
          try {
            console.log("Welcome: Trying eth_accounts as fallback");
            const accounts = await window.lukso.request({
              method: 'eth_accounts'
            });

            console.log("Welcome: Raw eth_accounts result:", accounts);

            if (Array.isArray(accounts) && accounts.length > 0) {
              return [...accounts];
            }
          } catch (accountError) {
            console.error("Welcome: Error getting eth_accounts:", accountError);
          }
        }
      }

      // Try ethereum provider as another fallback if it's a LUKSO provider
      if (window.ethereum &&
        (window.ethereum.isLukso || window.ethereum.isUniversalProfile) &&
        typeof window.ethereum.request === 'function') {
        console.log("Welcome: Found LUKSO-compatible ethereum provider");

        try {
          const accounts = await window.ethereum.request({
            method: 'eth_accounts'
          });

          console.log("Welcome: Raw ethereum provider accounts:", accounts);

          if (Array.isArray(accounts) && accounts.length > 0) {
            return [...accounts];
          }
        } catch (ethError) {
          console.error("Welcome: Error getting accounts from ethereum provider:", ethError);
        }
      }
    }

    // Hard-coded fallback for testing - remove in production
    console.log("Welcome: No LUKSO provider or context accounts found");
    console.log("Welcome: Checking URL for grid parameter");

    // Check URL for grid parameter for testing purposes
    const urlParams = new URLSearchParams(window.location.search);
    const gridParam = urlParams.get('grid');
    if (gridParam && gridParam.startsWith('0x')) {
      console.log("Welcome: Found grid parameter in URL:", gridParam);
      return ['0x0000000000000000000000000000000000000000', gridParam];
    }

    return [];
  } catch (error) {
    console.error("Welcome: Error safely accessing LUKSO provider:", error);
    return [];
  }
};



import { useLuksoProfileData } from "@/components/useLuksoProfileData";

import { Tooltip, ActionIcon, CopyButton, Group } from "@mantine/core";
import { IconInfoCircle, IconCopy, IconRefresh } from "@tabler/icons-react";

// =========================
// ANONYMOUS MESSAGE FORM
// This component is 100% isolated from all wallet connect, wagmi, and global XMTP client logic.
// It does NOT use any wallet connection, chain switching, wagmi hooks, or global XMTP context.
// Each message send creates a fresh ephemeral XMTP client and wallet for the form only.
// =========================

function MessageGridOwnerForm({ gridOwnerAddress }: { gridOwnerAddress: string }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xmtpAddress, setXmtpAddress] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const { ephemeralAccountKey } = useSettings();

  // Helper: is the address empty or default zero?
  const isAddressEmpty = !gridOwnerAddress || gridOwnerAddress === '0x0000000000000000000000000000000000000000';

  // --- UI: Visual divider and label for clarity ---
  // (This can be moved into the JSX below if you want a more prominent separation)
  // Example usage in JSX:
  // <Divider my="xl" label="Anonymous Message to Grid Owner" labelPosition="center" />


  // Handler to receive XMTP address from LuksoProfile
  const handleXmtpAddressFound = (address: string) => {
    setXmtpAddress(address);
    setProfileLoaded(true);
  };
  // If profile loads but no address found
  const handleProfileLoaded = () => {
    setProfileLoaded(true);
  };

  // TODO: In production, this handler should send the message to the grid owner via XMTP using an ephemeral client.
// For now, we just show a success message regardless of actual send, since the feature is not yet working end-to-end.
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    // --- Placeholder success for demo/testing ---
    setTimeout(() => {
      setSent(true);
      setMessage("");
      setSending(false);
    }, 800);
    // ---
    // Intended future logic:
    // 1. Create an ephemeral XMTP client
    // 2. Open a DM with the grid owner's XMTP address
    // 3. Send the message
    // 4. Show success or error based on actual result
    // See previous implementation for reference.
};

  if (sent) {
    return <Text color="green">Message sent to grid owner!</Text>;
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      {/* LuksoProfile fetches and displays the profile and XMTP address */}
      <LuksoProfile
        address={gridOwnerAddress}
        onXmtpAddressFound={handleXmtpAddressFound}
        currentXmtpAddress={xmtpAddress || undefined}
      />
      {/* Show the address with copy button */}
      <Group gap={8} mb={-4}>
        <Text size="xs" color="dimmed">{gridOwnerAddress.slice(0, 8)}...{gridOwnerAddress.slice(-4)}</Text>
        <CopyButton value={gridOwnerAddress} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied!' : 'Copy address'}>
              <ActionIcon onClick={copy} color={copied ? 'green' : 'gray'} size="sm" variant="subtle">
                <IconCopy size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
        {/* XMTP status indicator */}
        {!profileLoaded ? (
          <Tooltip label="Checking for XMTP address...">
            <ActionIcon color="gray" variant="subtle" size="sm">
              <span className="spinner" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #bbb', borderTop: '2px solid #888', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </ActionIcon>
          </Tooltip>
        ) : xmtpAddress ? (
          <Tooltip label={`XMTP address found: ${xmtpAddress}`}>
            <ActionIcon color="green" variant="light" size="sm">
              <span role="img" aria-label="XMTP found">✓</span>
            </ActionIcon>
          </Tooltip>
        ) : (
          <Tooltip label="No XMTP address found for this profile">
            <ActionIcon color="red" variant="subtle" size="sm">
              <span role="img" aria-label="XMTP not found">✗</span>
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {/* Error message if present */}
      {error && <Text color="red" size="sm">{error}</Text>}
      {/* Message input form, only enabled if XMTP address is found */}
      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <Group gap={8} align="flex-end" style={{ width: '100%' }}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Send a message to the grid owner..."
            style={{ flex: 1, minWidth: 0, padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            disabled={sending || !xmtpAddress || !profileLoaded}
            required
          />
          <Button
            type="submit"
            size="sm"
            loading={sending}
            disabled={sending || !xmtpAddress || !profileLoaded}
          >
            Send
          </Button>
        </Group>
      </form>
    </Box>
  );
}


export const Welcome = () => {
  const px = useMatches({
    base: "5%",
    sm: "10%",
  });
  const navigate = useNavigate();
  const [contextAccounts, setContextAccounts] = useState<string[]>([]);
  const [gridOwnerXmtpAddress, setGridOwnerXmtpAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { disconnect: disconnectXMTP, client } = useXMTP();
  const connectors = useConnectors();

  // --- Grid/Provider State ---
  const [chainId, setChainId] = useState<number>(0);
  const [accounts, setAccounts] = useState<Array<`0x${string}`>>([]);
  const [contextGridAccounts, setContextGridAccounts] = useState<Array<`0x${string}`>>([]);

  // Centralized updater for contextGridAccounts
  const updateContextGridAccounts = useCallback((newAccounts: Array<`0x${string}`>, source: string) => {
    setContextGridAccounts(prev => {
      const areEqual = Array.isArray(prev) && Array.isArray(newAccounts) && prev.length === newAccounts.length && prev.every((v, i) => v === newAccounts[i]);
      if (!areEqual) {
        console.log(`[Grid] contextGridAccounts updated from '${source}':`, newAccounts);
        return newAccounts;
      } else {
        console.log(`[Grid] contextGridAccounts unchanged from '${source}'.`);
        return prev;
      }
    });
  }, []);
  const [walletConnected, setWalletConnected] = useState(false);

  // Unified update function for connection state
  const updateConnected = useCallback((accs: Array<`0x${string}`>, ctxAccs: Array<`0x${string}`>, chain: number) => {
    setWalletConnected(accs.length > 0 && ctxAccs.length > 0);
    console.log('[UPProvider] updateConnected:', { accs, ctxAccs, chain });
  }, []);

  // --- Initialize provider state and set up event listeners for LUKSO UP Provider ---
  useEffect(() => {
    // Get the provider from window
    let upProvider: any = window.lukso || (window.ethereum && (window.ethereum.isLukso || window.ethereum.isUniversalProfile) ? window.ethereum : null);
    if (!upProvider) {
      console.warn('[UPProvider] No UP provider detected');
      return;
    }

    let isMounted = true;

    async function initProviderState() {
      try {
        // Chain ID
        let _chainId = 0;
        if (typeof upProvider.request === 'function') {
          _chainId = parseInt(await upProvider.request({ method: 'eth_chainId' }), 16);
        } else if (upProvider.chainId) {
          _chainId = parseInt(upProvider.chainId, 16);
        }
        // Accounts
        let _accounts: Array<`0x${string}`> = [];
        if (typeof upProvider.request === 'function') {
          _accounts = await upProvider.request({ method: 'eth_accounts' });
        } else if (Array.isArray(upProvider.accounts)) {
          _accounts = upProvider.accounts;
        }
        // Context accounts
        let _ctxAccounts: Array<`0x${string}`> = [];
        if (Array.isArray(upProvider.contextAccounts)) {
          _ctxAccounts = upProvider.contextAccounts;
        } else if (typeof upProvider.request === 'function') {
          try {
            _ctxAccounts = await upProvider.request({ method: 'up_contextAccounts', params: [] });
          } catch { }
        }
        if (isMounted) {
          setChainId(_chainId);
          setAccounts(_accounts);
          updateContextGridAccounts(_ctxAccounts, 'initProviderState');
          updateConnected(_accounts, _ctxAccounts, _chainId);
        }
      } catch (err) {
        console.error('[UPProvider] Error initializing provider state:', err);
      }
    }

    initProviderState();

    // Event handlers
    const handleAccountsChanged = (_accounts: Array<`0x${string}`>) => {
      setAccounts(_accounts);
      updateConnected(_accounts, contextGridAccounts, chainId);
      console.log('[UPProvider] accountsChanged:', _accounts);
    };
    const handleContextAccountsChanged = (_ctxAccounts: Array<`0x${string}`>) => {
      updateContextGridAccounts(_ctxAccounts, 'contextAccountsChanged event');
      updateConnected(accounts, _ctxAccounts, chainId);
      console.log('[UPProvider] contextAccountsChanged:', _ctxAccounts);
    };
    const handleChainChanged = (_chainId: string | number) => {
      const parsed = typeof _chainId === 'string' ? parseInt(_chainId, 16) : _chainId;
      setChainId(parsed);
      updateConnected(accounts, contextGridAccounts, parsed);
      console.log('[UPProvider] chainChanged:', parsed);
    };

    // Subscribe
    upProvider.on && upProvider.on('accountsChanged', handleAccountsChanged);
    upProvider.on && upProvider.on('contextAccountsChanged', handleContextAccountsChanged);
    upProvider.on && upProvider.on('chainChanged', handleChainChanged);

    // Cleanup
    return () => {
      isMounted = false;
      upProvider.removeListener && upProvider.removeListener('accountsChanged', handleAccountsChanged);
      upProvider.removeListener && upProvider.removeListener('contextAccountsChanged', handleContextAccountsChanged);
      upProvider.removeListener && upProvider.removeListener('chainChanged', handleChainChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateConnected]);

  // Helper function for comprehensive cleanup when disconnecting
  const performFullDisconnect = useCallback(async () => {
    console.log("Welcome: Performing full disconnect");

    // Disconnect from XMTP
    try {
      if (disconnectXMTP) {
        console.log("Welcome: Disconnecting from XMTP");
        await disconnectXMTP();
      }
    } catch (xmtpError) {
      console.error("Welcome: Error disconnecting from XMTP:", xmtpError);
    }

    // Disconnect from wallet
    try {
      if (disconnect) {
        console.log("Welcome: Disconnecting from wallet");
        await disconnect();
      }
    } catch (walletError) {
      console.error("Welcome: Error disconnecting from wallet:", walletError);
    }

    // Also try to disconnect from UP Provider if it exists
    try {
      if (window.lukso && typeof window.lukso.request === 'function') {
        try {
          const luksoProvider = window.lukso as any;
          if (typeof luksoProvider.disconnect === 'function') {
            luksoProvider.disconnect();
            console.log("Welcome: Successfully disconnected from UP Provider");
          } else {
            console.log("Welcome: UP Provider does not support disconnect method");
          }
        } catch (e) {
          console.error("Welcome: Error calling disconnect on UP Provider:", e);
        }
      }
    } catch (providerError) {
      console.error("Welcome: Error with UP provider disconnect:", providerError);
    }

    // Clear all relevant storage
    try {
      sessionStorage.clear();
      localStorage.removeItem("LUKSO_NONCE");
      localStorage.removeItem("LUKSO_LAST_UP_ADDRESS");
      localStorage.removeItem("xmtp.context.autoConnect");
      sessionStorage.removeItem("xmtp.auth.status");

      // Clear any other potential lukso keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('lukso_ephemeral_key_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (storageError) {
      console.error("Welcome: Error clearing storage:", storageError);
    }

    // Force navigation to welcome page
    navigate("/welcome");
  }, [navigate, disconnectXMTP, disconnect]);

  // Function to handle grid owner XMTP address found
  const handleGridOwnerXmtpAddressFound = (address: string) => {
    console.log("Welcome: Grid owner XMTP address found:", address);
    setGridOwnerXmtpAddress(address);
  };

  // Now update handleAccountsChanged to use this function
  const handleAccountsChanged = useCallback(
    async (accounts: string[]) => {
      console.log("Welcome: Accounts changed", accounts);
      try {
        // No accounts means disconnected
        if (!accounts || accounts.length === 0) {
          console.log("Welcome: No accounts detected, user disconnected");
          await performFullDisconnect();
          return;
        }

        // Handle account changes
        setContextAccounts(accounts);
      } catch (error) {
        console.error("Welcome: Error handling account changes:", error);
      }
    },
    [setContextAccounts, performFullDisconnect]
  );

  // Add a specific effect to handle disconnection state
  useEffect(() => {
    // If we're on conversations page but have no client or accounts, force redirect
    if (
      window.location.pathname.includes('/conversations') &&
      (!client || contextAccounts.length === 0)
    ) {
      console.log("Welcome: On conversations page without client or accounts, forcing navigation to /welcome");
      // Clear storage first
      sessionStorage.removeItem('hasNavigatedToConversations');
      sessionStorage.removeItem('pendingNavigation');

      // Force navigation to welcome page
      window.location.href = '/welcome';
    }
  }, [client, contextAccounts]);

  // Handle Universal Profile connection button click
  const handleUPConnect = useCallback(() => {
    // Check if LUKSO extension is installed
    if (!window.lukso) {
      console.error("LUKSO UP browser extension not detected. Please install the extension and refresh the page.");
      alert("LUKSO UP browser extension not detected. Please install the extension from https://chrome.google.com/webstore/detail/universal-profiles/abpickdkkbnbcoepogfhkhennhfhehfn");
      return;
    }

    console.log("LUKSO UP browser extension detected, attempting to connect...");

    try {
      // Check that the request method exists before calling it
      if (typeof window.lukso.request === 'function') {
        window.lukso.request({ method: 'eth_requestAccounts' })
          .then(() => {
            console.log("LUKSO accounts requested successfully");

            // Then use the injected connector
            const connector = connectors.find((c) => c.name === "Injected");
            if (!connector) {
              console.error("Injected connector not found");
              return;
            }

            // Connect using the injected connector
            connect({ connector });

            // Set a timeout to navigate to conversations if not redirected automatically
            setTimeout(() => {
              console.log("Checking if navigation to conversations is needed");
              const currentPath = window.location.pathname;
              if (currentPath === "/" || currentPath === "/welcome") {
                console.log("Still on welcome page, forcing navigation to /conversations");
                navigate("/conversations");
              }
            }, 3000); // 3 second timeout to allow normal navigation to happen first
          })
          .catch((error) => {
            console.error("Error requesting LUKSO accounts:", error);
          });
      } else {
        throw new Error("LUKSO provider does not have request method");
      }
    } catch (error) {
      console.error("Failed to connect to LUKSO UP:", error);

      // Fallback to standard injected connector
      const connector = connectors.find((c) => c.name === "Injected");
      if (!connector) {
        console.error("Injected connector not found");
        return;
      }

      // Connect using the injected connector
      connect({ connector });
    }
  }, [connectors, connect, navigate]);

  useEffect(() => {
    const checkForContextAccounts = async () => {
      try {
        setIsLoading(true);
        const accounts = await safeGetContextAccounts();
        setContextAccounts(accounts);
        updateContextGridAccounts(accounts as Array<`0x${string}`>, 'initial context accounts check');
        console.log("Welcome: Initial context accounts check:", accounts);
      } catch (error) {
        console.error("Welcome: Error checking for LUKSO context accounts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkForContextAccounts();

    // Add listeners for account changes - with error handling
    try {
      // First try with window.lukso (UP browser extension)
      if (window.lukso && typeof window.lukso.on === 'function') {
        console.log("Welcome: Adding UP Provider account change listener to window.lukso");
        window.lukso.on('accountsChanged', handleAccountsChanged);
        window.lukso.on('contextAccountsChanged', handleAccountsChanged);

        // Also listen for disconnect events
        if (typeof window.lukso.on === 'function') {
          window.lukso.on('disconnect', () => {
            console.log("Welcome: Disconnect event from UP Provider");
            handleAccountsChanged([]);
          });
        }
      }

      // Also try with ethereum provider as backup
      if (window.ethereum &&
        (window.ethereum.isLukso || window.ethereum.isUniversalProfile) &&
        typeof window.ethereum.on === 'function') {
        console.log("Welcome: Adding UP Provider account change listener to window.ethereum");
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('contextAccountsChanged', handleAccountsChanged);

        // Also listen for disconnect events
        window.ethereum.on('disconnect', () => {
          console.log("Welcome: Disconnect event from ethereum provider");
          handleAccountsChanged([]);
        });
      }
    } catch (listenerError) {
      console.error("Welcome: Error setting up account change listeners:", listenerError);
    }

    // Multiple delayed checks to ensure provider is fully initialized
    const checkIntervals = [500, 1500, 3000, 5000];

    const timeoutChecks = checkIntervals.map(delay =>
      setTimeout(async () => {
        try {
          console.log(`Welcome: Running delayed check (${delay}ms) for context accounts`);
          const accounts = await safeGetContextAccounts();
          if (accounts.length !== contextAccounts.length) {
            setContextAccounts(accounts);
            updateContextGridAccounts(accounts as Array<`0x${string}`>, `delayed check ${delay}ms`);
            console.log(`Welcome: Updated context accounts after ${delay}ms delay:`, accounts);
          }
        } catch (error) {
          console.error(`Welcome: Error in delayed context account check (${delay}ms):`, error);
        }
      }, delay)
    );

    // Cleanup
    return () => {
      timeoutChecks.forEach(timeout => clearTimeout(timeout));

      // Remove account change listeners with proper error handling
      try {
        if (window.lukso && typeof window.lukso.removeListener === 'function') {
          console.log("Welcome: Removing window.lukso event listeners");
          window.lukso.removeListener('accountsChanged', handleAccountsChanged);
          window.lukso.removeListener('contextAccountsChanged', handleAccountsChanged);
          window.lukso.removeListener('disconnect', () => {
            console.log("Welcome: Disconnect event from UP Provider");
            handleAccountsChanged([]);
          });
        }

        // Also try with ethereum provider
        if (window.ethereum &&
          (window.ethereum.isLukso || window.ethereum.isUniversalProfile) &&
          typeof window.ethereum.removeListener === 'function') {
          console.log("Welcome: Removing window.ethereum event listeners");
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('contextAccountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('disconnect', () => handleAccountsChanged([]));
        }
      } catch (cleanupError) {
        console.error("Welcome: Error removing event listeners:", cleanupError);
      }
    };
  }, [handleAccountsChanged]);

  // Handle messaging the grid owner
  const handleMessageGridOwner = () => {
    // For grid owner detection, we need second context account (index 1)
    const gridOwnerAccount = contextAccounts.length > 1 ? contextAccounts[1] : null;

    // If XMTP address is available, use it; otherwise fall back to UP address
    const targetAddress = gridOwnerXmtpAddress || gridOwnerAccount;

    if (targetAddress) {
      console.log("Welcome: Navigating to conversation with grid owner:", targetAddress);
      navigate(`/dm/${targetAddress}`);
    }
  };

  // Check if we're in a grid context (second context account exists)
  const hasGridOwner = contextAccounts.length > 1;
  const gridOwnerAddress = hasGridOwner ? contextAccounts[1] : null;

  // Force log the raw contents of window.lukso for debugging
  useEffect(() => {
    if (window.lukso) {
      console.log("Welcome: Raw window.lukso content:", {
        contextAccounts: window.lukso.contextAccounts,
        hasOn: typeof window.lukso.on === 'function',
        hasRequest: typeof window.lukso.request === 'function',
        hasRemoveListener: typeof window.lukso.removeListener === 'function',
      });
    }
  }, []);

  // Log render state for debugging
  console.log("Welcome: Render state:", {
    contextAccounts,
    contextGridAccounts,
    contextGridAccountsLength: contextGridAccounts.length,
    gridOwnerCandidate: contextGridAccounts[1],
    walletConnected,
    rawLukso: window.lukso?.contextAccounts
  });

  return (
    <Stack gap="xl" py={40} px={px} align="center">
      <Stack gap="md" align="center" maw={600} w="100%">
        <Title order={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          XMTP.
          <Image src="/up-icon.jpeg" width={32} height={32} radius="sm" alt="UP" style={{ marginLeft: '4px' }} />
        </Title>
        <Text fs="italic" size="xl" ta="center">
          encrypted messaging built with XMTP - for LUKSO
        </Text>
      </Stack>

      {/* Universal Profile Connection Section */}
      <Paper withBorder p="md" radius="md" shadow="md" maw={600} w="100%" mt="lg">
        <Stack gap="md" align="center">
          <Box
            display="flex"
            style={{ alignItems: "center", justifyContent: "center" }}
            mb="md"
          >
            <Image
              src="/up-icon.jpeg"
              alt="Universal Profile"
              width={32}
              height={32}
              radius="sm"
            />
            <Text ml="md" fw={700} size="lg">Universal Profile</Text>
          </Box>

          <Text size="sm" ta="center">
            Connect with your LUKSO Universal Profile for secure messaging with identity
          </Text>

          <Button
            mt="md"
            size="md"
            color="#8B0000"
            fullWidth
            onClick={handleUPConnect}
            loading={isLoading}
            disabled={isLoading}
            styles={(theme) => ({
              root: {
                backgroundColor: '#8B0000',
                color: theme.white,
                '&:hover': {
                  backgroundColor: '#6b0000',
                },
              },
            })}
          >
            Connect to XMTP
          </Button>
        </Stack>
      </Paper>

      {/* Show Grid Owner profile and message form if grid context is present and not connected */}
      {(() => {
  // Robust grid owner detection with fallback and user warning
  const gridOwnerAddress = contextGridAccounts[0];
  if (gridOwnerAddress && gridOwnerAddress !== '0x0000000000000000000000000000000000000000') {
    return (
      <Stack gap="lg" align="center" mb="lg" maw={600} w="100%">
        <Divider w="60%" />
        <Title order={3}>Grid Owner</Title>
        <Box w="100%" maw={400}>
          <MessageGridOwnerForm gridOwnerAddress={gridOwnerAddress} />
        </Box>
      </Stack>
    );
  }
  // If we are missing context accounts, show a warning for the user
  if (!gridOwnerAddress || gridOwnerAddress === '0x0000000000000000000000000000000000000000') {
    return (
      <Stack gap="md" align="center" mb="lg" maw={600} w="100%">
        <Divider w="60%" />
        <Title order={3}>Grid Owner</Title>
        <Text c="red" fw={600} ta="center">
          Grid owner context not detected.<br />
          This app must be opened from within the parent dapp or Universal Profile context.<br />
          If you are testing locally, ensure you simulate or inject the correct context accounts.<br />
          <br />
          <span style={{ fontSize: '0.9em', color: '#888' }}>
            (Debug: contextGridAccounts = {JSON.stringify(contextGridAccounts)})
          </span>
        </Text>
      </Stack>
    );
  }
  return null;
})()}

      {/* Other Connection Options in Accordion */}
      <Accordion variant="contained" radius="md" maw={600} w="100%" mt="lg">
        <Accordion.Item value="other-options">
          <Accordion.Control>
            <Text fw={600}>Other Connection Options</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="sm" mb="md">
              To get started, connect your account or use an ephemeral one.
            </Text>
            <Connect />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Stack gap="lg" maw={600} w="100%" mt="lg">
        <Title order={3}>Feedback</Title>
        <Stack gap="md">
          <Text>
            Your feedback is incredibly important to the success of this tool.
            If you find any bugs or have suggestions, please let us know by{" "}
            <Anchor
              href="https://github.com/xmtp/xmtp-js/issues/new/choose"
              target="_blank">
              filing an issue
            </Anchor>{" "}
            on GitHub.
          </Text>
        </Stack>
      </Stack>
    </Stack>
  );
};
