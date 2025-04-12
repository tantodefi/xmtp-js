import {
  Button,
  CloseButton,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  Modal as MantineModal,
  LoadingOverlay,
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
import { ERC725 } from "@erc725/erc725.js";
import { notifications } from "@mantine/notifications";

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
  const [isUploadingMetadata, setIsUploadingMetadata] = useState(false);

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
          const luksoProvider = window.lukso;
          if (luksoProvider && typeof luksoProvider.on === 'function') {
            luksoProvider.on('contextAccountsChanged', contextAccountsChangedHandler);
            
            // Log successful event registration
            console.log("Successfully registered contextAccountsChanged event");
            
            // Return cleanup function
            return () => {
              if (luksoProvider && typeof luksoProvider.removeListener === 'function') {
                luksoProvider.removeListener('contextAccountsChanged', contextAccountsChangedHandler);
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

  // Function to update UP metadata with XMTP address tag
  const handleUploadMetadata = async () => {
    if (!upAddress || !accountIdentifier) {
      notifications.show({
        title: "Error",
        message: "Missing UP address or XMTP address",
        color: "red",
      });
      return;
    }

    try {
      setIsUploadingMetadata(true);
      
      // Create tag data - use a standard format
      const xmtpTag = `xmtp:${accountIdentifier}`;
      console.log(`Updating metadata with tag: ${xmtpTag}`);
      
      // Using a custom key for XMTP metadata
      const xmtpKeyName = 'XMTPAddress';
      // Key hash is generated from the name using keccak256
      const xmtpKey = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5';
      
      try {
        // Get the provider
        let provider: { request: (args: any) => Promise<any> } | null = null;
        
        if (window.lukso && typeof window.lukso.request === 'function') {
          provider = window.lukso as { request: (args: any) => Promise<any> };
          console.log("Using LUKSO provider");
        } else if (window.ethereum && typeof window.ethereum.request === 'function') {
          provider = window.ethereum as { request: (args: any) => Promise<any> };
          console.log("Using Ethereum provider");
        } else {
          throw new Error("No compatible provider found. Please make sure you have the LUKSO browser extension installed.");
        }
        
        // Double check provider is active by requesting accounts
        console.log("Requesting accounts to ensure wallet connection...");
        const accounts = await provider.request({
          method: 'eth_requestAccounts',
          params: []
        });
        
        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts found. Please make sure your wallet is connected.");
        }
        
        console.log("Connected accounts:", accounts);
        
        const currentAccount = accounts[0].toLowerCase();
        console.log("Active wallet account:", currentAccount);
        
        // IMPORTANT: In LUKSO, the connected account is typically an EOA (externally owned account)
        // and NOT the Universal Profile address. The EOA controls the UP via the KeyManager.
        // So, we use the stored UP address as the target, and the connected EOA as the controller.
        
        // The UP we want to modify is the one stored in upAddress
        const targetUpAddress = upAddress;
        console.log("Target UP address for update:", targetUpAddress);
        
        // The current account (EOA) will be the controller that signs the transaction
        const controllerAddress = currentAccount;
        console.log("Controller address (EOA):", controllerAddress);
        
        // Create the RPC provider for data lookups
        const RPC_URL = 'https://rpc.lukso.gateway.fm';
        
        // Function to get the KeyManager address for a UP
        const getKeyManagerAddress = async (address: string): Promise<string | null> => {
          try {
            console.log("Fetching KeyManager for UP address:", address);
            
            // Make a direct call to read the storage slot 0x4
            // This contains the KeyManager address in LUKSO UPs
            const response = await fetch(RPC_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_getStorageAt',
                params: [
                  address,
                  '0x0000000000000000000000000000000000000000000000000000000000000004',
                  'latest'
                ]
              })
            });
            
            const data = await response.json();
            console.log("Storage slot data:", data);
            
            if (data.error) {
              console.error("Error getting storage:", data.error);
              return null;
            }
            
            // The storage value is 32 bytes, and the address is in the last 20 bytes
            if (data.result && data.result !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              // Extract the last 20 bytes (40 hex chars)
              const keyManagerAddress = '0x' + data.result.substring(26).toLowerCase();
              console.log("Extracted KeyManager address:", keyManagerAddress);
              
              // Sanity check - make sure it's a valid address format
              if (/^0x[0-9a-f]{40}$/.test(keyManagerAddress)) {
                return keyManagerAddress;
              } else {
                console.log("Invalid KeyManager address format:", keyManagerAddress);
              }
            } else {
              console.log("No KeyManager found in storage slot");
            }
            
            return null;
          } catch (error) {
            console.error("Error fetching KeyManager:", error);
            return null;
          }
        };
        
        // Create the data value
        const dataValue = [{ 
          keyName: xmtpKeyName, 
          key: xmtpKey, 
          value: xmtpTag 
        }];
        
        // Generate the setData call that we want to execute
        const functionSelector = '0x14a6e293'; // setData
        const keyHex = xmtpKey.startsWith('0x') ? xmtpKey.substring(2) : xmtpKey;
        const encoder = new TextEncoder();
        const valueBytes = encoder.encode(xmtpTag);
        const valueHex = Array.from(valueBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        const dataOffset = '0000000000000000000000000000000000000000000000000000000000000020';
        const dataLength = valueBytes.length.toString(16).padStart(64, '0');
        
        // Construct the setData call - make sure it has the 0x prefix
        const setDataCall = '0x' + functionSelector.replace('0x', '') + keyHex + dataOffset + dataLength + valueHex;
        console.log("setData call:", setDataCall);

        // Try to determine if we need to use KeyManager or direct call
        const keyManagerAddress = await getKeyManagerAddress(targetUpAddress);
        console.log("KeyManager detection result:", keyManagerAddress);
        
        let txParams;
        
        // ALWAYS use KeyManager if available
        if (keyManagerAddress && keyManagerAddress !== '0x0000000000000000000000000000000000000000') {
          console.log("Using KeyManager at:", keyManagerAddress);
          
          // We need to use the executeFor function on the KeyManager
          // executeFor signature: 0xb61d27f6
          const executeForSelector = '0xb61d27f6';
          
          // Parameters for executeFor:
          // 1. Target address (the UP) - 32 bytes
          // 2. Value (0 for setData) - 32 bytes
          // 3. Offset to data (32 bytes)
          // 4. Data length (32 bytes)
          // 5. Data (the setData call)
          
          // 1. Target address padded to 32 bytes
          // First make sure we have the full address with 0x prefix
          const fullTargetAddress = targetUpAddress.startsWith('0x') ? targetUpAddress : '0x' + targetUpAddress;
          // Remove 0x prefix and then pad LEFT to 32 bytes (64 hex chars)
          const paddedTarget = '000000000000000000000000' + fullTargetAddress.substring(2);
          console.log("Padded target UP address:", paddedTarget);
          
          // 2. Value (0) - 32 bytes
          const valueParam = '0000000000000000000000000000000000000000000000000000000000000000';
          
          // 3. Offset to data (32 * 3 = 96 bytes)
          const dataParamOffset = '0000000000000000000000000000000000000000000000000000000000000060';
          
          // 4. Data length 
          const setDataCallWithoutPrefix = setDataCall.startsWith('0x') ? setDataCall.substring(2) : setDataCall;
          const setDataCallLength = setDataCallWithoutPrefix.length / 2; // /2 because hex
          const setDataCallLengthHex = setDataCallLength.toString(16).padStart(64, '0');
          console.log("setData call length (bytes):", setDataCallLength);
          console.log("setData call length (hex):", setDataCallLengthHex);
          
          // 5. Data (the setData call without '0x')
          
          // Construct the executeFor call
          const executeForCall = '0x' + executeForSelector + 
                               paddedTarget + 
                               valueParam + 
                               dataParamOffset + 
                               setDataCallLengthHex + 
                               setDataCallWithoutPrefix;
          
          console.log("executeFor call:", executeForCall);
          
          txParams = {
            from: controllerAddress, // This is the EOA that controls the UP
            to: keyManagerAddress,   // This is the KeyManager contract
            data: executeForCall     // This is the executeFor call
          };
          
          console.log("Using KeyManager transaction parameters:", txParams);
        } else {
          console.log("‼️ No KeyManager found - this will likely fail");
          notifications.show({
            title: "Warning",
            message: "No KeyManager found. The transaction will likely fail.",
            color: "red",
          });
          
          // For safety, look up in known mappings - common for LSP0 UP implementations
          // Try to manually find the KeyManager using a standard pattern
          // Most UPs follow this structure where KeyManager is at address + 1
          console.log("Trying to guess KeyManager using standard pattern...");
          
          // Parse the UP address to a BigInt, add 1, and convert back to hex
          try {
            const upAddressBigInt = BigInt(targetUpAddress);
            const possibleKeyManager = '0x' + (upAddressBigInt + 1n).toString(16);
            console.log("Possible KeyManager address:", possibleKeyManager);
            
            // Use the executeFor pattern with this address
            // 1. Target address padded to 32 bytes
            const fullTargetAddress = targetUpAddress.startsWith('0x') ? targetUpAddress : '0x' + targetUpAddress;
            const paddedTarget = '000000000000000000000000' + fullTargetAddress.substring(2);
            
            // 2. Value (0) - 32 bytes
            const valueParam = '0000000000000000000000000000000000000000000000000000000000000000';
            
            // 3. Offset to data (32 * 3 = 96 bytes)
            const dataParamOffset = '0000000000000000000000000000000000000000000000000000000000000060';
            
            // 4. Data length 
            const setDataCallWithoutPrefix = setDataCall.startsWith('0x') ? setDataCall.substring(2) : setDataCall;
            const setDataCallLength = setDataCallWithoutPrefix.length / 2;
            const setDataCallLengthHex = setDataCallLength.toString(16).padStart(64, '0');
            
            // 5. Construct the executeFor call
            const executeForSelector = '0xb61d27f6';
            const executeForCall = '0x' + executeForSelector + 
                                paddedTarget + 
                                valueParam + 
                                dataParamOffset + 
                                setDataCallLengthHex + 
                                setDataCallWithoutPrefix;
            
            txParams = {
              from: controllerAddress,
              to: possibleKeyManager,
              data: executeForCall
            };
            
            console.log("Using guessed KeyManager transaction parameters:", txParams);
            
            notifications.show({
              title: "Info",
              message: "Using guessed KeyManager address. Transaction may still fail.",
              color: "blue",
            });
          } catch (err) {
            console.error("Failed to guess KeyManager:", err);
            
            // Fall back to direct call as last resort
            txParams = {
              from: controllerAddress,  // Controller address (EOA)
              to: targetUpAddress,      // UP address
              data: setDataCall
            };
          }
        }
        
        console.log("Transaction parameters:", txParams);
        
        // Send the transaction
        console.log("About to send transaction:", txParams);
        try {
          // Add a notification to show we're waiting for wallet confirmation
          notifications.show({
            title: "Waiting for wallet",
            message: "Please confirm the transaction in your wallet",
            color: "blue",
            loading: true,
            autoClose: false,
            id: "wallet-confirm"
          });
          
          // Make sure we have the 0x prefix on data
          if (txParams.data && !txParams.data.startsWith('0x')) {
            txParams.data = '0x' + txParams.data;
          }
          
          // Check if we need special UP permissions
          if (window.lukso && 'permissions' in window.lukso) {
            try {
              console.log("Checking for UP permissions...");
              
              // Request UP specific permissions if available
              if (typeof window.lukso.request === 'function') {
                // Look for UP specific methods
                await window.lukso.request({
                  method: 'eth_requestAccounts',
                  params: []
                });
                
                console.log("UP wallet permissions confirmed");
              }
            } catch (permError) {
              console.error("Error requesting UP permissions:", permError);
              // Continue anyway as we'll try the transaction
            }
          }
          
          // Send using universal provider detection
          console.log("Sending transaction via eth_sendTransaction...");
          const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [txParams]
          });
          
          // Close the waiting notification
          notifications.hide("wallet-confirm");
          
          console.log("Transaction submitted:", txHash);
          
          notifications.show({
            title: "Metadata Updated",
            message: "Your UP metadata has been updated with your XMTP address. Transaction: " + txHash,
            color: "green",
          });
        } catch (txError) {
          // Close the waiting notification
          notifications.hide("wallet-confirm");
          
          console.error("Transaction error:", txError);
          const errorMessage = txError instanceof Error 
            ? txError.message 
            : (typeof txError === 'object' && txError !== null && 'message' in txError)
              ? (txError as {message: string}).message
              : "Unknown transaction error";
              
          notifications.show({
            title: "Transaction Failed",
            message: errorMessage,
            color: "red",
          });
          
          throw txError;
        }
      } catch (err) {
        console.error("Transaction preparation error:", err);
        throw err;
      }
    } catch (error) {
      console.error("Error updating metadata:", error);
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to update metadata",
        color: "red",
      });
    } finally {
      setIsUploadingMetadata(false);
    }
  };

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
            
            <Paper p="md" radius="md" withBorder pos="relative">
              <LoadingOverlay visible={isUploadingMetadata} zIndex={1000} overlayProps={{ blur: 2 }} />
              <Stack gap="md">
                {/* Consistent styling for all address fields */}
                <Group gap="md" wrap="nowrap">
                  <Text flex="0 0 25%" style={{ whiteSpace: "nowrap" }}>
                    XMTP Address
                  </Text>
                  <BadgeWithCopy value={accountIdentifier || ""} />
                </Group>
                {/* Add the Upload Metadata button here */}
                {upAddress && accountIdentifier && (
                  <Group justify="flex-end">
                    <Button
                      variant="outline"
                      color="blue"
                      onClick={handleUploadMetadata}
                      loading={isUploadingMetadata}
                      disabled={isUploadingMetadata}>
                      {isUploadingMetadata ? "Uploading..." : "Upload Metadata"}
                    </Button>
                  </Group>
                )}
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
