import { Box, Button, LoadingOverlay, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useXMTP } from "@/contexts/XMTPContext";

export const Disconnect: React.FC = () => {
  const { disconnect, client } = useXMTP();
  const navigate = useNavigate();
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    // Clear any navigation flags
    sessionStorage.removeItem("disconnecting");
    sessionStorage.removeItem("hasNavigatedToConversations");
    sessionStorage.removeItem("pendingNavigation");

    // Create a backup of all LUKSO ephemeral keys for persistence
    const luksoKeysBackup: Record<string, string> = {};
    const luksoUpAddress = localStorage.getItem('lukso_up_address');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('lukso_ephemeral_key_')) {
        luksoKeysBackup[key] = localStorage.getItem(key) || '';
        console.log(`Preserving key for session persistence: ${key}`);
      }
    });

    // Save the LUKSO UP address if it exists
    const upAddressBackup = localStorage.getItem('upAddress');

    // Force clean specific localStorage items related to connections but preserve LUKSO keys
    const itemsToPreserve = [
      'xmtp_custom_address_names_v2', // Preserve custom address names
      'XMTP_NETWORK', // Preserve network selection
      'XMTP_LOGGING_LEVEL', // Preserve logging preferences
    ];

    // Clear XMTP authentication items
    localStorage.removeItem("xmtp.context.key");
    localStorage.removeItem("xmtp.context.address");
    localStorage.removeItem("xmtp.context.autoConnect");
    localStorage.removeItem("xmtp.auth.status");

    // Clear wallet connection items
    localStorage.removeItem("walletconnect");
    localStorage.removeItem("WALLETCONNECT_DEEPLINK_CHOICE");
    localStorage.removeItem("LUKSO_NONCE");
    localStorage.removeItem("LUKSO_LAST_UP_ADDRESS");

    // Clear cache items for XMTP clients
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('xmtp:last_client_')) {
        localStorage.removeItem(key);
      }
    });

    // Restore LUKSO ephemeral keys for persistence
    Object.entries(luksoKeysBackup).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });

    // Restore UP address if it existed
    if (upAddressBackup) {
      localStorage.setItem('upAddress', upAddressBackup);
    }

    console.log("Disconnect: Cleared auth items while preserving LUKSO keys for session persistence");

    // Force navigation to welcome after a very short time
    const forceNavigationTimer = setTimeout(() => {
      console.log("Disconnect: Force navigation to welcome page");
      window.location.href = "/welcome";
    }, 800);

    // Set a slightly longer timeout for the UI to show the manual button
    const uiTimeout = setTimeout(() => {
      setIsTimedOut(true);
    }, 500);

    // Immediately try to perform disconnection
    performDisconnect();

    return () => {
      clearTimeout(forceNavigationTimer);
      clearTimeout(uiTimeout);
    };
  }, []);

  const performDisconnect = async () => {
    console.log("Disconnect: Starting disconnect process");

    try {
      // Attempt to disconnect XMTP client
      try {
        if (client) {
          await disconnect();
          console.log("Disconnect: XMTP client disconnected");
        }
      } catch (xmtpError) {
        console.error("Disconnect: Error disconnecting XMTP client:", xmtpError);
      }

      // Try to disconnect from UP Provider if it exists, but don't call disconnect() 
      // as it would require reconnection - just log out from current session
      try {
        if (window.lukso && typeof window.lukso.request === 'function') {
          console.log("Disconnect: UP Provider exists but not disconnecting to maintain persistence");

          // We could potentially clear some session data here without losing persistence
          try {
            // Just a request to clear any pending requests
            await window.lukso.request({ method: 'eth_accounts' });
          } catch (clearError) {
            // Ignore errors from this request
          }
        }
      } catch (providerError) {
        console.error("Disconnect: Error with UP provider:", providerError);
      }

      // Use direct location change to ensure we leave this page
      window.location.href = "/welcome";
    } catch (error) {
      console.error("Disconnect: General error during disconnect:", error);
      // If any error occurs, still try to navigate
      window.location.href = "/welcome";
    }
  };

  const goToWelcomePage = () => {
    window.location.href = "/welcome";
  };

  // Show a loading overlay with a fallback button if it takes too long
  return (
    <Box style={{ position: "relative", minHeight: "100vh" }}>
      <LoadingOverlay visible={!isTimedOut} />

      {isTimedOut && (
        <Box style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          padding: "20px"
        }}>
          <Text size="lg" fw={500} mb="md">Disconnecting is taking longer than expected</Text>
          <Text size="sm" color="dimmed" mb="xl">You may have been disconnected already.</Text>
          <Button onClick={goToWelcomePage}>
            Go to Welcome Page
          </Button>
        </Box>
      )}
    </Box>
  );
};
