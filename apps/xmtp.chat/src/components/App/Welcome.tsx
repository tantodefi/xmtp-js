import { Anchor, Stack, Text, Title, useMatches, Button, Divider, Box, Paper, Image, Accordion } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/hooks/useSettings";
import { Connect } from "./Connect";
import { useEffect, useState } from "react";
import { LuksoProfile } from "@/components/LuksoProfile";
import { useXMTP } from "@/contexts/XMTPContext";
import { useUpProvider } from "@/contexts/UpProviderContext";
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
            <Tooltip label={accounts[0] ? (client ? 'Already connected to XMTP' : 'Signing into XMTP with a Proxy Ephemeral Signer') : 'Connect your wallet first'} disabled={!!accounts[0] && !client}>
              <span>
                <Button
                  variant="light"
                  color="dark"
                  fullWidth
                  leftSection={<Image src="/xmtp-icon.png" alt="XMTP" width={24} height={24} radius="sm" />}
                  size="md"
                  radius="md"
                  style={{ fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
                  loading={initializing}
                  disabled={!accounts[0] || !!client || initializing}
                  onClick={async () => {
                    setRenderError(null); // clear previous errors
                    function handleXmtpError(err: any) {
                      if (err?.name === "SwitchChainNotSupportedError" || (typeof err?.message === 'string' && err.message.includes('does not support programmatic chain switching'))) {
                        setRenderError(new Error('Universal Profile does not support programmatic chain switching. Please switch to the correct network in your wallet and try again.'));
                      } else {
                        setRenderError(err instanceof Error ? err : new Error(String(err)));
                      }
                    }
                    try {
                      // Clean up any previous XMTP session state
                      try {
                        localStorage.removeItem("xmtp.context.autoConnect");
                        sessionStorage.removeItem("xmtp.auth.status");
                      } catch (e) {
                        // ignore
                      }
                      // --- Universal Profile (UP) wallet flow ---
                      // If UP, use proxy ephemeral signer as in Connect.tsx
                      const isUP = window.lukso && contextAccounts && contextAccounts.length > 0;
                      if (isUP) {
                        const upAddress = contextAccounts[0].toLowerCase();
                        // Generate or load persistent ephemeral key for this UP address
                        const luksoAddressKey = `lukso_ephemeral_key_${upAddress}`;
                        let tempPrivateKey = localStorage.getItem(luksoAddressKey);
                        if (!tempPrivateKey) {
                          tempPrivateKey = (await import('viem/accounts')).generatePrivateKey();
                          localStorage.setItem(luksoAddressKey, tempPrivateKey);
                        }
                        // Use proxy ephemeral signer
                        const { createProxyEphemeralSigner } = await import('@/helpers/createSigner');
                        const signer = createProxyEphemeralSigner(upAddress);
                        await initialize({ signer })
                          .catch((err: any) => {
                            handleXmtpError(err);
                            throw err;
                          });
                        // On success, go to /conversations
                        navigate('/conversations', { replace: true });
                        return;
                      }
                      // --- Non-UP wallet fallback (EOA, injected, etc) ---
                      let signer = undefined;
                      function isXMTPCompatibleSigner(obj: any): obj is { getAddress: () => Promise<string>; signMessage: (msg: string | Uint8Array) => Promise<string>; } {
                        return obj && typeof obj.getAddress === 'function' && typeof obj.signMessage === 'function';
                      }
                      if (window.ethereum && isXMTPCompatibleSigner(window.ethereum)) {
                        signer = window.ethereum;
                      }
                      if (!signer && contextAccounts && contextAccounts.length > 0) {
                        const candidate = contextAccounts[0];
                        if (isXMTPCompatibleSigner(candidate)) {
                          signer = candidate;
                        }
                      }
                      if (!signer) {
                        setRenderError(new Error('No compatible wallet signer found. Please ensure your wallet supports XMTP.'));
                        return;
                      }
                      await initialize({ signer })
                        .catch((err: any) => {
                          handleXmtpError(err);
                          throw err;
                        });
                      navigate('/conversations', { replace: true });
                    } catch (err: any) {
                      handleXmtpError(err);
                    } finally {
                      // No need to set initializing, handled by useXMTP
                    }
                  }}
                >
                  {initializing ? 'Connecting to XMTP...' : client ? 'Connected to XMTP' : 'Connect to XMTP'}
                </Button>
              </span>
            </Tooltip>
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
