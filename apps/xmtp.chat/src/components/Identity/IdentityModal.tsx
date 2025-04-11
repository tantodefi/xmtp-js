import {
  Button,
  CloseButton,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { Client } from "@xmtp/browser-sdk";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { BadgeWithCopy } from "@/components/BadgeWithCopy";
import { InstallationTable } from "@/components/Identity/InstallationTable";
import { Modal } from "@/components/Modal";
import { LuksoProfile } from "@/components/LuksoProfile";
import { useCollapsedMediaQuery } from "@/hooks/useCollapsedMediaQuery";
import { useIdentity } from "@/hooks/useIdentity";
import { ContentLayout } from "@/layouts/ContentLayout";

// Find the original UP address from localStorage
const findOriginalUpAddress = (): string | null => {
  try {
    // The pattern used in Connect.tsx is 'lukso_ephemeral_key_{address}'
    const KEY_PREFIX = 'lukso_ephemeral_key_';
    
    // Scan all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) {
        // Extract the address part from the key
        const upAddress = key.substring(KEY_PREFIX.length);
        console.log("Found original UP address in localStorage:", upAddress);
        return upAddress;
      }
    }
    
    // Check if there's a specific key for the UP address
    const upAddress = localStorage.getItem('lukso_up_address');
    if (upAddress) {
      console.log("Found UP address in dedicated localStorage key:", upAddress);
      return upAddress;
    }
    
    return null;
  } catch (error) {
    console.error("Error accessing localStorage:", error);
    return null;
  }
};

// Safe function to get context accounts from LUKSO UP Provider
const safeGetContextAccounts = async (): Promise<string | null> => {
  try {
    // Check if window.lukso exists and has the required methods
    if (typeof window !== 'undefined' && 
        window.lukso && 
        typeof window.lukso.request === 'function') {
      
      // Try to get contextAccounts first
      if (window.lukso.contextAccounts && 
          Array.isArray(window.lukso.contextAccounts) && 
          window.lukso.contextAccounts.length > 0) {
        return window.lukso.contextAccounts[0].toLowerCase();
      }
      
      // Otherwise try the up_contextAccounts RPC method
      try {
        const contextAccounts = await window.lukso.request({
          method: 'up_contextAccounts',
          params: []
        });
        
        if (Array.isArray(contextAccounts) && contextAccounts.length > 0) {
          return contextAccounts[0].toLowerCase();
        }
      } catch (innerError) {
        console.log("Error calling up_contextAccounts, falling back to eth_accounts");
      }
      
      // Fall back to eth_accounts as last resort
      const accounts = await window.lukso.request({ 
        method: 'eth_accounts' 
      });
      
      if (Array.isArray(accounts) && accounts.length > 0) {
        return accounts[0].toLowerCase();
      }
    }
    return null;
  } catch (error) {
    console.error("Error safely accessing LUKSO provider:", error);
    return null;
  }
};

export const IdentityModal: React.FC = () => {
  const navigate = useNavigate();
  const { client } = useOutletContext<{ client: Client }>();
  const {
    installations,
    revokeAllOtherInstallations,
    revoking,
    sync,
    syncing,
  } = useIdentity(true);
  const [accountIdentifier, setAccountIdentifier] = useState<string | null>(null);
  const [upAddress, setUpAddress] = useState<string | null>(null);

  const fullScreen = useCollapsedMediaQuery();
  const contentHeight = fullScreen ? "auto" : "70dvh";

  // Set the XMTP account identifier
  useEffect(() => {
    setAccountIdentifier(
      client.accountIdentifier?.identifier.toLowerCase() ?? null,
    );
  }, [client.accountIdentifier]);
  
  // Try to get the original UP address from localStorage first, then fall back to provider methods
  useEffect(() => {
    const getUpAddress = async () => {
      // First try to get the address from localStorage (most reliable for getting original UP)
      const storedUpAddress = findOriginalUpAddress();
      if (storedUpAddress) {
        setUpAddress(storedUpAddress);
        return;
      }
      
      // If not found in localStorage, try provider methods
      const providerAddress = await safeGetContextAccounts();
      if (providerAddress) {
        console.log("Found UP context address from provider:", providerAddress);
        setUpAddress(providerAddress);
      }
    };
    
    // Initial fetch
    getUpAddress().catch(console.error);
    
    // Set up event listener for context accounts changes
    const setupEventListener = async () => {
      if (typeof window !== 'undefined' && window.lukso) {
        try {
          const contextAccountsChangedHandler = (accounts: string[]) => {
            console.log("Context accounts changed:", accounts);
            if (accounts && accounts.length > 0) {
              setUpAddress(accounts[0].toLowerCase());
            }
          };
          
          // Add event listener
          if (typeof window.lukso.on === 'function') {
            window.lukso.on('contextAccountsChanged', contextAccountsChangedHandler);
            
            // Log successful event registration
            console.log("Successfully registered contextAccountsChanged event");
            
            // Return cleanup function
            return () => {
              if (typeof window.lukso.removeListener === 'function') {
                window.lukso.removeListener('contextAccountsChanged', contextAccountsChangedHandler);
              }
            };
          }
        } catch (error) {
          console.error("Error setting up event listener:", error);
        }
      }
    };
    
    const cleanup = setupEventListener();
    return () => {
      if (cleanup) cleanup.then(fn => fn && fn());
    };
  }, []);

  const handleRevokeAllOtherInstallations = useCallback(async () => {
    await revokeAllOtherInstallations();
    await sync();
  }, [revokeAllOtherInstallations, sync]);

  const handleClose = useCallback(() => {
    void navigate(-1);
  }, [navigate]);

  return (
    <>
      <Modal
        opened
        centered
        withCloseButton={false}
        fullScreen={fullScreen}
        onClose={handleClose}
        size="auto"
        padding={0}>
        <ContentLayout
          maxHeight={contentHeight}
          loading={revoking || syncing}
          withScrollAreaPadding={false}
          title={
            <Group justify="space-between" align="center" flex={1}>
              <Text size="lg" fw={700} c="text.primary">
                Identity
              </Text>
              <CloseButton size="md" onClick={handleClose} />
            </Group>
          }>
          <Stack gap="md" p="md">
            {/* Always prioritize UP address for the profile display */}
            {upAddress ? (
              <LuksoProfile address={upAddress} />
            ) : (
              accountIdentifier && <LuksoProfile address={accountIdentifier} />
            )}
            
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                {/* Consistent styling for all address fields */}
                <Group gap="md" wrap="nowrap">
                  <Text flex="0 0 25%" style={{ whiteSpace: "nowrap" }}>
                    XMTP Address
                  </Text>
                  <BadgeWithCopy value={accountIdentifier || ""} />
                </Group>
                {upAddress && upAddress !== accountIdentifier && (
                  <Group gap="md" wrap="nowrap">
                    <Text flex="0 0 25%" style={{ whiteSpace: "nowrap" }}>
                      UP Address
                    </Text>
                    <BadgeWithCopy value={upAddress} />
                  </Group>
                )}
                <Group gap="md" wrap="nowrap">
                  <Text flex="0 0 25%" style={{ whiteSpace: "nowrap" }}>
                    Inbox ID
                  </Text>
                  {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
                  <BadgeWithCopy value={client.inboxId!} />
                </Group>
                <Group gap="md" wrap="nowrap">
                  <Text flex="0 0 25%" style={{ whiteSpace: "nowrap" }}>
                    Installation ID
                  </Text>
                  {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
                  <BadgeWithCopy value={client.installationId!} />
                </Group>
              </Stack>
            </Paper>
            <Title order={4} ml="md">
              Installations
            </Title>
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                {installations.length === 0 && (
                  <Text>No other installations found</Text>
                )}
                {installations.length > 0 && (
                  <>
                    <InstallationTable
                      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                      clientInstallationId={client.installationId!}
                      installations={installations}
                      refreshInstallations={sync}
                    />
                    <Group justify="flex-end">
                      <Button
                        variant="outline"
                        color="red"
                        onClick={() =>
                          void handleRevokeAllOtherInstallations()
                        }>
                        Revoke all other installations
                      </Button>
                    </Group>
                  </>
                )}
              </Stack>
            </Paper>
          </Stack>
        </ContentLayout>
      </Modal>
    </>
  );
};
