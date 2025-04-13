import { LoadingOverlay } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
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

    // Client check for non-disconnect, non-welcome pages
    if (!client &&
      location.pathname !== "/welcome" &&
      location.pathname !== "/disconnect") {

      console.log("AppLayout: No client found, redirecting to welcome page");

      // Save the current path to redirect to it after the client is initialized
      setRedirectUrl(location.pathname);

      // Navigate to welcome page
      navigate("/welcome");
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
