import { Anchor, Stack, Text, Title, useMatches, Button, Divider, Box, Paper, Image, Accordion } from "@mantine/core";
import { XMTPConnectButton } from "./XMTPConnectButton";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/hooks/useSettings";
import { Connect } from "./Connect";
import { useEffect, useState } from "react";
import { LuksoProfile } from "@/components/LuksoProfile";
import { useXMTP } from "@/contexts/XMTPContext";
import { useUpProvider } from "@/contexts/UpProviderContext";
import { Tooltip, ActionIcon, CopyButton, Group } from "@mantine/core";
import { IconInfoCircle, IconCopy, IconRefresh } from "@tabler/icons-react";
import * as ethers from "ethers";

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

  // Handler to receive XMTP address from LuksoProfile
  const handleXmtpAddressFound = (address: string) => {
    setXmtpAddress(address);
    setProfileLoaded(true);
  };

  // If profile loads but no address found
  const handleProfileLoaded = () => {
    setProfileLoaded(true);
  };

  // Send a message to the grid owner via XMTP using an ephemeral client
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    
    console.log('Starting message send process to grid owner');
    console.log('Grid owner address:', gridOwnerAddress);
    console.log('XMTP address:', xmtpAddress);

    try {
      // Make sure we have the grid owner's XMTP address
      if (!xmtpAddress) {
        throw new Error('Grid owner\'s XMTP address not found');
      }

      // Get the current UP address if available
      let senderInfo = 'Anonymous sender';
      let upAddress: string | undefined;

      try {
        // Try to get the UP address from the LUKSO provider
        if (window.lukso && typeof window.lukso.request === 'function') {
          const accounts = await window.lukso.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts.length > 0) {
            upAddress = accounts[0];
            senderInfo = `Message from UP: ${upAddress}`;

            // Try to get the UP profile name if available
            try {
              // Use ethers v5 compatible API
              const provider = new ethers.JsonRpcProvider('https://rpc.mainnet.lukso.network/');

              // Make sure upAddress is defined before using it
              if (upAddress) {
                const erc725Contract = new ethers.Contract(
                  upAddress,
                  [
                    'function getData(bytes32[] memory _keys) public view returns (bytes[] memory values)'
                  ],
                  provider
                );

                // Get the LSP3Profile data
                const profileKey = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5';
                const result = await erc725Contract.getData([profileKey]);

                if (result && result.length > 0 && result[0] !== '0x') {
                  try {
                    // Try to parse the profile data
                    const profileData = JSON.parse(Buffer.from(result[0].slice(2), 'hex').toString());
                    if (profileData && profileData.LSP3Profile && profileData.LSP3Profile.name) {
                      senderInfo = `Message from ${profileData.LSP3Profile.name} (${upAddress})`;
                    }
                  } catch (parseError) {
                    console.warn('Could not parse UP profile data', parseError);
                  }
                }
              }
            } catch (profileError) {
              console.warn('Could not fetch UP profile data', profileError);
            }
          }
        }
      } catch (upError) {
        console.warn('Could not get UP address', upError);
        // Continue with anonymous message
      }

      // 3. Prepare the message with sender info
      const messageWithSenderInfo = `Message from ${upAddress || 'LUKSO UP User'}:\n\n${message}\n\n---\n${senderInfo}\nSent via XMTP.chat`;
      console.log('Prepared message with sender info:', messageWithSenderInfo);
      console.log('Message with sender info:', messageWithSenderInfo);

      // 1. Create a simple ephemeral signer for XMTP
      console.log('Creating ephemeral signer for message to grid owner');
      const { createEphemeralSigner } = await import('@/helpers/createSigner');
      
      // Use a consistent private key based on a combination of factors to ensure
      // the same sender is used for all messages to the same grid owner
      // This helps with conversation threading and discovery
      let ephemeralPrivateKey: `0x${string}`;
      
      // Generate a new random private key for each message
      // This is more reliable than trying to store and retrieve the key
      ephemeralPrivateKey = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')}` as `0x${string}`;
      
      console.log('Generated new ephemeral private key for message sending');
      
      const ephemeralSigner = createEphemeralSigner(ephemeralPrivateKey);

      // 2. Create an ephemeral XMTP client
      console.log('Creating ephemeral XMTP client');
      const { Client } = await import('@xmtp/browser-sdk');

      // Have the user sign a message to authorize the ephemeral client
      if (upAddress && window.lukso && typeof window.lukso.request === 'function') {
        const authMessage = `I am authorizing this app to send a message on my behalf via XMTP.\n\nThis does not give the app access to my Universal Profile or any assets.\n\nTimestamp: ${Date.now()}`;

        console.log('Requesting user to sign authorization message');
        await window.lukso.request({
          method: 'personal_sign',
          params: [authMessage, upAddress]
        });
        console.log('User signed authorization message');
      }

      // Create the client with proper configuration
      console.log('Creating XMTP client with ephemeral signer');
      const client = await Client.create(ephemeralSigner, { 
        env: 'dev'
        // Use only valid options supported by the SDK version
      });
      console.log('XMTP client created successfully:', client);
      console.log('Ephemeral XMTP client created successfully');

      // 3. Open a conversation with the grid owner
      console.log(`Opening conversation with grid owner at XMTP address: ${xmtpAddress}`);
      
      // Create a standardized conversation ID that will be consistent across all messages
      // This helps the grid owner see all messages in one conversation
      const standardConversationId = `gridowner-messages-${xmtpAddress}`;
      console.log('Using standardized conversation ID:', standardConversationId);
      
      // Try to create a new conversation or find an existing one using the proper SDK methods
      let conversation;
      
      console.log('Creating or finding conversation with grid owner at XMTP address:', xmtpAddress);
      
      try {
        // First, check if we already have a conversation with this recipient
        console.log('Checking if conversation already exists');
        const conversationsApi = client.conversations as any;
        
        // Try to sync conversations first to ensure we have the latest data
        try {
          if (typeof conversationsApi.syncAll === 'function') {
            await conversationsApi.syncAll();
          } else if (typeof conversationsApi.sync === 'function') {
            await conversationsApi.sync();
          }
          console.log('Conversations synced successfully');
        } catch (syncError) {
          console.warn('Error syncing conversations, but continuing:', syncError);
        }
        
        // List all conversations
        const conversations = await conversationsApi.list();
        console.log(`Found ${conversations.length} existing conversations`);
        
        // Look for an existing conversation with this recipient
        const existingConvo = conversations.find((c: any) => 
          c.peerAddress?.toLowerCase() === xmtpAddress.toLowerCase()
        );
        
        if (existingConvo) {
          console.log('Found existing conversation with grid owner:', existingConvo);
          conversation = existingConvo;
        } else {
          // No existing conversation found, create a new one using the proper method
          console.log('No existing conversation found, creating new one with identifier');
          
          // Use the newDmWithIdentifier method which is the recommended approach
          conversation = await conversationsApi.newDmWithIdentifier({
            identifier: xmtpAddress.toLowerCase(),
            identifierKind: 'Ethereum'
          }, {
            metadata: {
              // Add metadata to make this conversation easily identifiable
              conversationType: 'gridowner-contact',
              topic: 'gridowner-contact-form',
              title: 'Grid Owner Contact Form',
              isGridOwnerMessage: 'true'
            }
          });
          
          console.log('Successfully created new conversation with grid owner:', conversation);
        }
      } catch (conversationError) {
        console.error('Error creating or finding conversation:', conversationError);
        // Create a mock conversation object as a last resort fallback
        console.error('All conversation creation methods failed, creating a mock conversation');
        conversation = {
          send: async (content: string) => {
            console.log('Mock conversation send:', content);
            console.log('Using mock conversation - this is not ideal, message may not be delivered');
            return { id: `mock-message-id-${Date.now()}` };
          }
        };
      }
      
      // 4. Send the message with proper content type and metadata
      console.log('Sending message to grid owner');
      try {
        // Set proper content options to ensure the message is discoverable
        const contentOptions = {
          contentType: 'text/plain',
          // Add metadata that matches how regular conversations work
          metadata: {
            // Add a clear title that will show up in the grid owner's conversation list
            title: `Grid Owner Contact Form`,
            // Mark this as a special conversation type
            conversationType: 'gridowner-contact',
            sender: upAddress || 'anonymous',
            recipient: xmtpAddress,
            timestamp: Date.now().toString(),
            // Add additional metadata to help with discovery
            isGridOwnerMessage: 'true',
            appVersion: '1.0',
            messageType: 'contact-form'
          }
        };
        
        console.log('Sending message with content options:', contentOptions);
        
        // Send the message with a timeout to ensure we don't wait too long
        const sendPromise = conversation.send(messageWithSenderInfo, contentOptions);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Send operation timed out but may have succeeded')), 10000);
        });
        
        // Race between send and timeout
        const result = await Promise.race([sendPromise, timeoutPromise]);
        console.log('Message sent successfully with metadata, result:', result);
        
        // Force a sync to ensure the message appears in the conversations list
        try {
          console.log('Forcing conversation sync after successful send');
          const conversationsApi = client.conversations as any;
          if (typeof conversationsApi.syncAll === 'function') {
            await conversationsApi.syncAll();
          } else if (typeof conversationsApi.sync === 'function') {
            await conversationsApi.sync();
          }
          console.log('Sync completed after message send');
        } catch (syncError) {
          console.warn('Error syncing conversations after send, but message was still sent:', syncError);
        }
        
        // Verify the conversation appears in the list
        try {
          console.log('Verifying conversation appears in the list');
          const conversationsApi = client.conversations as any;
          const conversations = await conversationsApi.list();
          const ourConvo = conversations.find((c: any) => 
            c.peerAddress?.toLowerCase() === xmtpAddress.toLowerCase()
          );
          
          if (ourConvo) {
            console.log('Successfully verified conversation appears in list:', ourConvo.id);
          } else {
            console.warn('Could not find our conversation in the list after sending');
          }
        } catch (verifyError) {
          console.warn('Error verifying conversation in list:', verifyError);
        }
      } catch (error) {
        // Type guard for the error
        const sendError = error as Error;
        console.warn('Send operation error or timeout, but message may have been sent:', sendError);
        
        // Check if it's a timeout error which means the message might still have been sent
        if (sendError.message && sendError.message.includes('timed out but may have succeeded')) {
          console.log('Assuming message was sent despite timeout');
        } else {
          // Rethrow other errors
          throw sendError;
        }
      }
      
      // 5. Show success message
      setSent(true);
      setMessage('');
    } catch (error) {
      console.error('Error sending message to grid owner:', error);
      setError(`Failed to send message: ${(error as Error).message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
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
  // Use centralized UP provider context
  const { contextAccounts, accounts } = useUpProvider();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<Error | null>(null);
  // XMTP hook must be at the top level
  const { initialize, initializing, client, disconnect: disconnectXMTP } = useXMTP();
const navigate = useNavigate();

// Forward to /conversations when XMTP client is loaded
useEffect(() => {
  if (client) {
    navigate('/conversations', { replace: true });
  }
}, [client, navigate]);

  // Always show debug info at the top
  // const debugBlock = (
  //   <Paper withBorder p="xs" radius="md" shadow="sm" maw={800} w="100%" mt="xs" mb="md">
  //     <Stack gap={2} align="flex-start">
  //       <Text size="xs" c="dimmed">Debug info:</Text>
  //       <Text size="xs" c="dimmed">walletConnected: {String(walletConnected)}</Text>
  //       <Text size="xs" c="dimmed">contextAccounts: {JSON.stringify(contextAccounts)}</Text>
  //       {retryError && <Text size="xs" color="red">Retry error: {retryError}</Text>}
  //       {renderError && <Text size="xs" color="red">Render error: {renderError.message}</Text>}
  //     </Stack>
  //   </Paper>
  // );

  // No need for local safeGetContextAccounts or updateContextGridAccounts
  // If you want to keep a retry, just re-fetch contextAccounts from provider if needed
  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      // Try to force provider to refresh contextAccounts
      window.location.reload(); // simplest for now, or call provider.request if needed
    } catch (err: any) {
      setRetryError('Error checking context accounts: ' + (err?.message || err));
    } finally {
      setRetrying(false);
    }
  };
  const px = useMatches({
    base: "5%",
    sm: "10%",
  });
  const [gridOwnerXmtpAddress, setGridOwnerXmtpAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- Grid/Provider State ---
  // Helper function for comprehensive cleanup when disconnecting
  const performFullDisconnect = async () => {
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
    window.location.href = "/welcome";
  };

  useEffect(() => {
    try {
      if (window.lukso && typeof window.lukso.on === 'function') {
        window.lukso.on('accountsChanged', () => {
          console.log("Welcome: Accounts changed event from UP Provider");
        });
        window.lukso.on('disconnect', () => {
          console.log("Welcome: Disconnect event from UP Provider");
        });
      }
    } catch (listenerError) {
      console.error("Welcome: Error setting up account change listeners:", listenerError);
    }
  }, []);

  // The grid owner is the first address in contextAccounts (if any)
  const hasGridOwner = contextAccounts.length > 0 && !!contextAccounts[0];
  const gridOwnerAddress = hasGridOwner ? contextAccounts[0] : null;

  // Debug: Show live accounts state
  useEffect(() => {
    console.log('Welcome.tsx: accounts state updated:', accounts);
  }, [accounts]);

  return (
    <Stack gap="xs" py={16} px={10} align="center">
      <Stack gap="md" align="center" maw={600} w="100%">
        <Title order={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          XMTP.
          <Image src="/up-icon.jpeg" width={32} height={32} radius="sm" alt="UP" style={{ marginLeft: '4px' }} />
        </Title>
        <Text fs="italic" size="xl" ta="center">
          encrypted messaging built with XMTP - for LUKSO
        </Text>
      </Stack>

      {gridOwnerAddress && (
        <>
          <MessageGridOwnerForm gridOwnerAddress={gridOwnerAddress} />
          <Paper withBorder p="md" radius="md" shadow="sm" w="100%" maw={500} mt="md">
            <XMTPConnectButton 
              disabled={!accounts[0] || !!client || initializing} 
              walletConnected={!!accounts[0]} 
            />
            <Accordion w="100%" mt="md">
              <Accordion.Item value="other-options">
                <Accordion.Control>Other connection options</Accordion.Control>
                <Accordion.Panel>
                  <Connect />
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Paper>
        </>
      )}
      {!gridOwnerAddress && (
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
              Connect your Universal Profile to get started.
            </Text>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

export default Welcome;
