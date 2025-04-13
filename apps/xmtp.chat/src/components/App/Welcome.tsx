import { Anchor, Stack, Text, Title, useMatches, Button, Divider, Box } from "@mantine/core";
import { Connect } from "@/components/App/Connect";
import { useEffect, useState, useCallback } from "react";
import { LuksoProfile } from "@/components/LuksoProfile";
import { useNavigate } from "react-router";

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

  // Function to handle grid owner XMTP address found
  const handleGridOwnerXmtpAddressFound = (address: string) => {
    console.log("Welcome: Grid owner XMTP address found:", address);
    setGridOwnerXmtpAddress(address);
  };

  // Handle UP Provider account changes
  const handleAccountsChanged = useCallback((accounts: string[]) => {
    console.log("Welcome: UP Provider accounts changed:", accounts);

    // If accounts is empty array, redirect to welcome
    if (Array.isArray(accounts) && accounts.length === 0) {
      console.log("Welcome: Accounts empty, redirecting to /welcome");
      navigate('/welcome');
    } else {
      setContextAccounts(accounts);
    }
  }, [navigate]);

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

    // Add listeners for account changes
    if (window.lukso && typeof window.lukso.on === 'function') {
      console.log("Welcome: Adding UP Provider account change listener");
      window.lukso.on('accountsChanged', handleAccountsChanged);
      window.lukso.on('contextAccountsChanged', handleAccountsChanged);
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

      // Remove account change listeners
      if (window.lukso && typeof window.lukso.removeListener === 'function') {
        window.lukso.removeListener('accountsChanged', handleAccountsChanged);
        window.lukso.removeListener('contextAccountsChanged', handleAccountsChanged);
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
      <Stack gap="md" align="center">
        <Title order={1}>XMTP.chat is built for developers</Title>
        <Text fs="italic" size="xl">
          Learn to build with XMTP — using an app built with XMTP
        </Text>
      </Stack>

      {/* Show Grid Owner profile when available but user isn't logged in */}
      {hasGridOwner && gridOwnerAddress && (
        <Stack gap="lg" align="center" mb="lg">
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
            onClick={handleMessageGridOwner}>
            Message Grid Owner
          </Button>
        </Stack>
      )}

      <Stack gap="lg">
        <Title order={3}>Connect</Title>
        <Text>
          To get started, connect your account or use an ephemeral one.
        </Text>
        <Connect />
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
