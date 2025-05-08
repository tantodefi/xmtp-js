import { Badge, Box, Group, Text, Flex, Button } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationsList } from "@/components/Conversations/ConversationList";
import { ConversationsMenu } from "@/components/Conversations/ConversationsMenu";
import { GridOwnerMessages } from "@/components/Conversations/GridOwnerMessages";
import { useConversations } from "@/hooks/useConversations";
import { ContentLayout } from "@/layouts/ContentLayout";

export const ConversationsNavbar: React.FC = () => {
  const { list, loading, syncing, conversations, stream, syncAll } =
    useConversations();
  const stopStreamRef = useRef<(() => void) | null>(null);
  const [isAddressBookBackedUp, setIsAddressBookBackedUp] = useState(false);

  const startStream = useCallback(async () => {
    stopStreamRef.current = await stream();
  }, [stream]);

  const stopStream = useCallback(() => {
    stopStreamRef.current?.();
    stopStreamRef.current = null;
  }, []);

  const handleSync = useCallback(async () => {
    stopStream();
    await list(undefined, true);
    await startStream();
  }, [list, startStream, stopStream]);

  const handleSyncAll = useCallback(async () => {
    stopStream();
    await syncAll();
    await startStream();
  }, [syncAll, startStream, stopStream]);

  // loading conversations on mount, and start streaming
  useEffect(() => {
    const loadConversations = async () => {
      await list(undefined);
      await startStream();
    };
    void loadConversations();
  }, []);

  // stop streaming on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  return (
    <ContentLayout
      title={
        <Group align="center" gap="xs">
          <Text size="md" fw={700}>
            Conversations
          </Text>
          <Badge color="gray" size="lg">
            {conversations.length}
          </Badge>
        </Group>
      }
      loading={loading}
      headerActions={
        <ConversationsMenu
          onSync={() => void handleSync()}
          onSyncAll={() => void handleSyncAll()}
          disabled={syncing}
        />
      }
      withScrollArea={false}>
      <Flex direction="column" style={{ height: "100%" }}>
        {/* Add the GridOwnerMessages component at the top */}
        <Box mb="xs">
          <GridOwnerMessages key={`grid-owner-messages-${Date.now()}`} />
        </Box>
        
        {conversations.length === 0 ? (
          <Box
            display="flex"
            style={{
              flexGrow: 1,
              alignItems: "center",
              justifyContent: "center",
            }}>
            <Text>No conversations found</Text>
          </Box>
        ) : (
          <Box style={{ flexGrow: 1 }}>
            <ConversationsList conversations={conversations} />
          </Box>
        )}

        {/* Address Book Buttons */}
        <Box p="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Group justify="apart">
            <Button
              variant="light"
              color="gray"
              disabled={isAddressBookBackedUp}
              style={{ flex: 1 }}
            >
              Backup Contacts
            </Button>
            <Button
              variant="subtle"
              color="blue"
              style={{ flex: 1 }}
            >
              Sync Contacts
            </Button>
          </Group>
        </Box>
      </Flex>
    </ContentLayout>
  );
};
