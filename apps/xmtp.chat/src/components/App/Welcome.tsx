import { Anchor, Stack, Text, Title, useMatches, Button, Divider, Box, Paper, Accordion, Image } from "@mantine/core";
import { Connect } from "@/components/App/Connect";
import { useEffect, useState, useCallback } from "react";
import { LuksoProfile } from "@/components/LuksoProfile";
import { useNavigate } from "react-router";
import { useConnect, useConnectors, useDisconnect } from "wagmi";
import { useXMTP } from "@/contexts/XMTPContext";

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
    hasGridOwner,
    gridOwnerAddress,
    gridOwnerXmtpAddress,
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
            color="blue"
            fullWidth
            onClick={handleUPConnect}
            loading={isLoading}
            disabled={isLoading}
          >
            Connect Universal Profile
          </Button>
        </Stack>
      </Paper>

      {/* Show Grid Owner profile when available but user isn't logged in */}
      {hasGridOwner && gridOwnerAddress && !isLoading && (
        <Stack gap="lg" align="center" mb="lg" maw={600} w="100%">
          <Divider w="60%" />
          <Title order={3}>Grid Owner</Title>
          <Text size="sm" ta="center">
            This dApp is installed on a Universal Profile grid
          </Text>
          <Box w="100%" maw={400}>
            <LuksoProfile
              address={gridOwnerAddress}
              onXmtpAddressFound={handleGridOwnerXmtpAddressFound}
            />
          </Box>
          <Button
            size="sm"
            color="blue"
            onClick={handleMessageGridOwner}
            disabled={isLoading}>
            Message Grid Owner
          </Button>
        </Stack>
      )}

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
          <Text>
            Check out the official{" "}
            <Anchor href="https://docs.xmtp.org/" target="_blank">
              documentation
            </Anchor>{" "}
            for more information on how to build with XMTP.
          </Text>
          <Text>
            If you have other questions about XMTP, visit our{" "}
            <Anchor href="https://community.xmtp.org/" target="_blank">
              community forums
            </Anchor>
            .
          </Text>
        </Stack>
      </Stack>
    </Stack>
  );
};
