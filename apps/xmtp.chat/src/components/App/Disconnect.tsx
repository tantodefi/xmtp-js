import { Box, Button, LoadingOverlay, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
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

    // Force clean all localStorage items related to connections
    localStorage.removeItem("xmtp.context.key");
    localStorage.removeItem("xmtp.context.address");
    localStorage.removeItem("walletconnect");
    localStorage.removeItem("WALLETCONNECT_DEEPLINK_CHOICE");
    localStorage.removeItem("LUKSO_NONCE");
    localStorage.removeItem("LUKSO_LAST_UP_ADDRESS");
    localStorage.removeItem("xmtp.context.autoConnect");
    localStorage.removeItem("xmtp.auth.status");

    // Clear any potential lukso keys
    Object.keys(localStorage).forEach(key => {
      if (key.toLowerCase().includes('lukso') || key.toLowerCase().includes('xmtp')) {
        localStorage.removeItem(key);
      }
    });

    console.log("Disconnect: Cleared all localStorage and sessionStorage items");

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

      // Try to disconnect from UP Provider if it exists
      try {
        if (window.lukso && typeof window.lukso.request === 'function') {
          const luksoProvider = window.lukso as any;
          if (typeof luksoProvider.disconnect === 'function') {
            luksoProvider.disconnect();
            console.log("Disconnect: Successfully disconnected from UP Provider");
          }
        }
      } catch (providerError) {
        console.error("Disconnect: Error with UP provider disconnect:", providerError);
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
