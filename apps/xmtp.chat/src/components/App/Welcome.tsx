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

  // Send a message to the grid owner via XMTP using an SCW client
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

      if (upAddress && window.lukso && typeof window.lukso.request === 'function') {
        // Use SCW signer with the Universal Profile
        console.log('Creating SCW signer for message to grid owner');

        // Get the chain ID
        const chainIdHex = await window.lukso.request({
          method: 'eth_chainId',
          params: []
        }) as string;

        // Convert hex chain ID to number
        const chainId = parseInt(chainIdHex, 16);
        console.log(`Current chain ID: ${chainId}`);

        // Import and create the SCW signer
        const { createSCWSigner } = await import('@/helpers/createSigner');

        // Create SCW signer for the UP
        const scwSigner = createSCWSigner(upAddress as `0x${string}`, chainId);

        console.log('SCW signer created:', {
          type: scwSigner.type,
          address: upAddress,
          chainId: chainId
        });

        // Create an XMTP client with the SCW signer
        console.log('Creating XMTP client with SCW signer');
        const { Client } = await import('@xmtp/browser-sdk');

        // Log additional diagnostic info about the underlying implementation
        console.log('XMTP Client info:', {
          sdkVersion: (Client as any).VERSION || 'unknown',
          supportedChains: (Client as any).SUPPORTED_CHAIN_IDS || 'unknown',
          signer: {
            type: scwSigner.type,
            hasGetChainId: typeof (scwSigner as any).getChainId === 'function',
            hasGetBlockNumber: typeof (scwSigner as any).getBlockNumber === 'function'
          }
        });

        let client;
        try {
          // Create client with SCW signer
          console.log('Attempting to create client with SCW signer');
          client = await Client.create(scwSigner, {
            env: 'dev',
            loggingLevel: 'debug'
          });
          console.log('XMTP client created successfully with SCW signer:', client);
        } catch (error) {
          console.error('Error creating client with SCW signer:', error);
          throw new Error('Failed to create XMTP client with SCW signer');
        }

        // Open a conversation with the grid owner
        console.log(`Opening conversation with grid owner at XMTP address: ${xmtpAddress}`);

        // Create a new conversation using the proper API
        const conversation = await client.conversations.newDm(xmtpAddress);
        console.log('Conversation created:', conversation);

        // Send the message
        console.log('Sending message to grid owner');
        await conversation.send(messageWithSenderInfo);
        console.log('Message sent successfully');

        setSent(true);
        setMessage('');
      } else {
        // Fallback to ephemeral signer if no UP is available
        console.log('No UP connected, using ephemeral signer for message to grid owner');

        // Generate a new random private key
        const ephemeralPrivateKey = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')}` as `0x${string}`;

        // Create an ephemeral signer
        const { createEphemeralSigner } = await import('@/helpers/createSigner');
        const ephemeralSigner = createEphemeralSigner(ephemeralPrivateKey);

        // Create an XMTP client
        console.log('Creating ephemeral XMTP client');
        const { Client } = await import('@xmtp/browser-sdk');
        const client = await Client.create(ephemeralSigner, {
          env: 'dev'
        });

        // Create a new conversation
        const conversation = await client.conversations.newDm(xmtpAddress);
        console.log('Conversation created with ephemeral signer:', conversation);

        // Send the message
        await conversation.send(messageWithSenderInfo);
        console.log('Message sent successfully with ephemeral signer');

        setSent(true);
        setMessage('');
      }
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
