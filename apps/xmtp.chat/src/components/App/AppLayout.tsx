import { LoadingOverlay } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppFooter } from "@/components/App/AppFooter";
import { AppHeader } from "@/components/App/AppHeader";
import { ConversationsNavbar } from "@/components/Conversations/ConversationsNavbar";
import { useXMTP } from "@/contexts/XMTPContext";
import { useRedirect } from "@/hooks/useRedirect";
import { CenteredLayout } from "@/layouts/CenteredLayout";
import {
  MainLayout,
  MainLayoutContent,
  MainLayoutFooter,
  MainLayoutHeader,
  MainLayoutNav,
} from "@/layouts/MainLayout";

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { client } = useXMTP();
  const { setRedirectUrl } = useRedirect();
  const [opened, { toggle }] = useDisclosure();

  useEffect(() => {
    // For disconnect page, don't do anything - let the Disconnect component handle navigation
    if (location.pathname === "/disconnect") {
      return;
    }

    console.log("AppLayout: Current state:", {
      hasClient: !!client,
      path: location.pathname,
      clientDetails: client ? {
        hasInboxId: !!client.inboxId,
      } : 'No client'
    });

    // Client check for non-disconnect, non-welcome pages
    if (!client &&
      location.pathname !== "/welcome" &&
      location.pathname !== "/disconnect") {

      console.log("AppLayout: No client found, redirecting to welcome page");

      // Save the current path to redirect to it after the client is initialized
      setRedirectUrl(location.pathname);

      // Navigate to welcome page
      navigate("/welcome");
    } else if (client && location.pathname === "/welcome") {
      // If we have a client but we're on the welcome page, redirect to conversations
      console.log("AppLayout: Client found on welcome page, redirecting to conversations");
      navigate("/conversations");
    }
  }, [client, location.pathname, navigate, setRedirectUrl]);

  // Special handling for disconnect page - simple loading only
  if (location.pathname === "/disconnect") {
    return (
      <CenteredLayout>
        <Outlet />
      </CenteredLayout>
    );
  }

  // Check if we have a client creation flag in localStorage
  const hasClientCreationFlag = () => {
    try {
      return localStorage.getItem('xmtp_client_created') === 'true';
    } catch (e) {
      return false;
    }
  };

  // Check if we have a client creation attempt flag in localStorage
  const hasClientAttemptFlag = () => {
    try {
      return localStorage.getItem('xmtp_client_attempted') === 'true';
    } catch (e) {
      return false;
    }
  };

  // Get the address used for client creation attempt
  const getClientAttemptAddress = () => {
    try {
      return localStorage.getItem('xmtp_client_address') || '';
    } catch (e) {
      return '';
    }
  };

  // If we don't have a client but have the creation flag, show a loading state
  const clientCreationInProgress = !client && hasClientCreationFlag();
  
  // If we don't have a client but have attempted to create one, redirect to welcome
  const clientAttempted = !client && !hasClientCreationFlag() && hasClientAttemptFlag();
  const clientAttemptAddress = getClientAttemptAddress();
  
  // If client creation is in progress, show loading state
  if (clientCreationInProgress) {
    console.log("AppLayout: Client creation in progress, showing loading overlay");
    return (
      <CenteredLayout>
        <LoadingOverlay visible />
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <p>XMTP client is being created...</p>
        </div>
      </CenteredLayout>
    );
  }
  
  // If client creation was attempted but failed, redirect to welcome
  if (clientAttempted) {
    console.log("AppLayout: Client creation was attempted but failed for address:", clientAttemptAddress);
    
    // Redirect to welcome page to try again
    if (location.pathname !== "/welcome") {
      console.log("AppLayout: Redirecting to welcome page to try again");
      navigate("/welcome");
    }
    
    return (
      <CenteredLayout>
        <LoadingOverlay visible />
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <p>XMTP connection issue. Redirecting...</p>
        </div>
      </CenteredLayout>
    );
  }
  
  return !client ? (
    <CenteredLayout>
      <LoadingOverlay visible />
    </CenteredLayout>
  ) : (
    <MainLayout>
      <MainLayoutHeader>
        <AppHeader client={client} opened={opened} toggle={toggle} />
      </MainLayoutHeader>
      <MainLayoutNav opened={opened} toggle={toggle}>
        <ConversationsNavbar />
      </MainLayoutNav>
      <MainLayoutContent>
        <Outlet context={{ client }} />
      </MainLayoutContent>
      <MainLayoutFooter>
        <AppFooter />
      </MainLayoutFooter>
    </MainLayout>
  );
};
