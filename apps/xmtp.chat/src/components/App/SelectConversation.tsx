import { Button, Stack, Text, Title, Divider, Box } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { LuksoProfile } from "@/components/LuksoProfile";

// Helper function to safely get all context accounts from LUKSO UP Provider
const safeGetContextAccounts = async (): Promise<string[]> => {
  try {
    // Check if window.lukso exists and has the required methods
    if (typeof window !== 'undefined') {
      console.log("SelectConversation: Checking for LUKSO provider - window.lukso exists?", !!window.lukso);

      // Check for the provider implementation exactly as UP Provider delivers it
      if (window.lukso) {
        // Access contextAccounts directly without lowercasing or preprocessing
        if (window.lukso.contextAccounts) {
          console.log("SelectConversation: Raw UP Provider contextAccounts:", window.lukso.contextAccounts);

          // Just return them as-is for most accurate detection
          if (Array.isArray(window.lukso.contextAccounts) && window.lukso.contextAccounts.length > 0) {
            return [...window.lukso.contextAccounts];
          }
        }

        // Use request methods as fallbacks
        if (typeof window.lukso.request === 'function') {
          console.log("SelectConversation: LUKSO provider detected with request method");

          // Try up_contextAccounts RPC method
          try {
            console.log("SelectConversation: Trying up_contextAccounts RPC method");
            const contextAccounts = await window.lukso.request({
              method: 'up_contextAccounts',
              params: []
            });

            console.log("SelectConversation: Raw up_contextAccounts result:", contextAccounts);

            if (Array.isArray(contextAccounts) && contextAccounts.length > 0) {
              return [...contextAccounts];
            }
          } catch (innerError) {
            console.log("SelectConversation: Error calling up_contextAccounts, falling back to eth_accounts:", innerError);
          }

          // Fall back to eth_accounts as last resort
          try {
            console.log("SelectConversation: Trying eth_accounts as fallback");
            const accounts = await window.lukso.request({
              method: 'eth_accounts'
            });

            console.log("SelectConversation: Raw eth_accounts result:", accounts);

            if (Array.isArray(accounts) && accounts.length > 0) {
              return [...accounts];
            }
          } catch (accountError) {
            console.error("SelectConversation: Error getting eth_accounts:", accountError);
          }
        }
      }
    }
    return [];
  } catch (error) {
    console.error("SelectConversation: Error safely accessing LUKSO provider:", error);
    return [];
  }
};

export const SelectConversation = () => {
  const navigate = useNavigate();
  const [contextAccounts, setContextAccounts] = useState<string[]>([]);
  const [gridOwnerXmtpAddress, setGridOwnerXmtpAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle UP Provider account changes
  const handleAccountsChanged = useCallback((accounts: string[]) => {
    console.log("SelectConversation: UP Provider accounts changed:", accounts);

    // If accounts is empty array, redirect to welcome
    if (Array.isArray(accounts) && accounts.length === 0) {
      console.log("SelectConversation: Accounts empty, redirecting to /welcome");
      navigate('/welcome');
    } else {
      setContextAccounts(accounts);
    }
  }, [navigate]);

  // Check for LUKSO context accounts on component mount
  useEffect(() => {
    const checkForContextAccounts = async () => {
      try {
        setIsLoading(true);
        const accounts = await safeGetContextAccounts();
        console.log("SelectConversation: Initial context accounts check:", accounts);
        setContextAccounts(accounts);
      } catch (error) {
        console.error("SelectConversation: Error checking for LUKSO context accounts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkForContextAccounts();

    // Add listeners for account changes
    if (window.lukso && typeof window.lukso.on === 'function') {
      console.log("SelectConversation: Adding UP Provider account change listener");
      window.lukso.on('accountsChanged', handleAccountsChanged);
      window.lukso.on('contextAccountsChanged', handleAccountsChanged);
    }

    // Multiple delayed checks to ensure provider is fully initialized
    const checkIntervals = [500, 1500, 3000];

    const timeoutChecks = checkIntervals.map(delay =>
      setTimeout(async () => {
        try {
          console.log(`SelectConversation: Running delayed check (${delay}ms) for context accounts`);
          const accounts = await safeGetContextAccounts();
          if (accounts.length !== contextAccounts.length) {
            setContextAccounts(accounts);
            console.log(`SelectConversation: Updated context accounts after ${delay}ms delay:`, accounts);
          }
        } catch (error) {
          console.error(`SelectConversation: Error in delayed context account check (${delay}ms):`, error);
        }
      }, delay)
    );

    // Force log the raw contents of window.lukso for debugging
    if (window.lukso) {
      console.log("SelectConversation: Raw window.lukso content:", {
        contextAccounts: window.lukso.contextAccounts,
        hasOn: typeof window.lukso.on === 'function',
        hasRequest: typeof window.lukso.request === 'function',
        hasRemoveListener: typeof window.lukso.removeListener === 'function',
      });
    }

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

  // Function to handle XMTP address found by LuksoProfile component
  const handleXmtpAddressFound = (address: string) => {
    console.log("SelectConversation: Grid owner XMTP address found:", address);
    setGridOwnerXmtpAddress(address);
  };

  // Function to message the grid owner
  const handleMessageGridOwner = () => {
    // For grid owner detection, we need second context account (index 1)
    const gridOwnerAccount = contextAccounts.length > 1 ? contextAccounts[1] : null;

    // If XMTP address is available, use it; otherwise fall back to UP address
    const targetAddress = gridOwnerXmtpAddress || gridOwnerAccount;

    if (targetAddress) {
      console.log("SelectConversation: Navigating to conversation with grid owner:", targetAddress);
      navigate(`/dm/${targetAddress}`);
    }
  };

  // Check if we're in a grid context (second context account exists)
  const hasGridOwner = contextAccounts.length > 1;
  const gridOwnerAddress = hasGridOwner ? contextAccounts[1] : null;

  // Log render state for debugging
  console.log("SelectConversation render state:", {
    contextAccounts,
    hasGridOwner,
    gridOwnerAddress,
    gridOwnerXmtpAddress,
    rawLukso: window.lukso?.contextAccounts
  });

  return (
    <Stack gap={40} p="md" align="center">
      <Stack gap="lg" align="center">
        <Title order={3}>No conversation selected</Title>
        <Text>
          Select a conversation in the left sidebar to display its messages,
          or...
        </Text>
        <Stack gap="xs">
          <Button
            size="xs"
            onClick={() => {
              void navigate("/conversations/new-group");
            }}>
            Create a new group
          </Button>
          <Button
            size="xs"
            onClick={() => {
              void navigate("/conversations/new-dm");
            }}>
            Create a new direct message
          </Button>
        </Stack>
      </Stack>

      {/* Show grid owner section if we're in a grid context */}
      {hasGridOwner && gridOwnerAddress && (
        <Stack gap="sm" align="center" style={{ maxWidth: 300 }}>
          <Divider w="60%" my="xs" />
          <Text size="sm" fw={600} ta="center">Grid Owner</Text>

          {/* Compact profile card */}
          <Box w="100%" style={{ transform: 'scale(0.9)' }}>
            <LuksoProfile
              address={gridOwnerAddress}
              onXmtpAddressFound={handleXmtpAddressFound}
            />
          </Box>

          <Button
            size="xs"
            color="blue"
            onClick={handleMessageGridOwner}
            loading={isLoading}
            disabled={isLoading}>
            Message Grid Owner
          </Button>
        </Stack>
      )}
    </Stack>
  );
};
