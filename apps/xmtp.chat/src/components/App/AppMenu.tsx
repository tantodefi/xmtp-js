import { Button, Menu } from "@mantine/core";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRedirect } from "@/hooks/useRedirect";
import { IconDots } from "@/icons/IconDots";
import { useXMTP } from "@/contexts/XMTPContext";
import { useDisconnect } from "wagmi";

export const AppMenu: React.FC = () => {
  const navigate = useNavigate();
  const { setRedirectUrl } = useRedirect();
  const { disconnect: disconnectXMTP } = useXMTP();
  const { disconnect: disconnectWallet } = useDisconnect();

  const handleDisconnect = () => {
    try {
      console.log("AppMenu: Starting disconnect process");
      sessionStorage.setItem("disconnecting", "true");

      // Clear any pending navigation flags first
      sessionStorage.removeItem("pendingNavigation");
      sessionStorage.removeItem("hasNavigatedToConversations");

      // Use direct location change instead of React Router for more reliability
      window.location.href = "/disconnect";
    } catch (error) {
      console.error("AppMenu: Error during disconnect:", error);
      // Fallback to direct navigation if there's an error
      window.location.href = "/disconnect";
    }
  };

  return (
    <Menu shadow="md" position="bottom-end">
      <Menu.Target>
        <Button
          px="var(--mantine-spacing-xxxs)"
          radius="md"
          size="xs"
          variant="default">
          <IconDots />
        </Button>
      </Menu.Target>
      <Menu.Dropdown miw={200}>
        <Menu.Label>Actions</Menu.Label>
        <Menu.Item onClick={() => void navigate("/dm/0xE15AA1ba585AeA8a4639331ce5f9aEc86f8c4541")}>
          Hey Elsa (Base Agent)
        </Menu.Item>
        <Menu.Item onClick={() => void navigate("new-dm")}>
          New direct message
        </Menu.Item>
        <Menu.Item onClick={() => void navigate("new-group")}>
          New group
        </Menu.Item>
        <Menu.Item onClick={handleDisconnect}>Disconnect</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
