import { Badge, Box, Group, Text, Flex, Button, Menu, ActionIcon } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationsList } from "@/components/Conversations/ConversationList";
import { ConversationsMenu } from "@/components/Conversations/ConversationsMenu";
import { useConversations } from "@/hooks/useConversations";
import { useAddressBook } from "@/hooks/useAddressBook";
import { ContentLayout } from "@/layouts/ContentLayout";
import { IconBug } from '@tabler/icons-react';

export const ConversationsNavbar: React.FC = () => {
  const { list, loading, syncing, conversations, stream, syncAll } =
    useConversations();
  const {
    isBackedUp,
    isSyncing,
    isBackingUp,
    handleSync: syncAddressBook,
    handleBackup: backupAddressBook
  } = useAddressBook();
  const stopStreamRef = useRef<(() => void) | null>(null);
  const [showInvalidConversations, setShowInvalidConversations] = useState(false);

  // Count invalid conversations
  const invalidConversationCount = conversations.filter(
    // @ts-ignore - Custom property
    (conv) => conv.isInvalid
  ).length;

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
  }, [list, startStream]);

  // stop streaming on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // Helper to identify and log invalid conversations
  const handleDebugInvalidConversations = () => {
    // Toggle showing invalid conversations
    setShowInvalidConversations(!showInvalidConversations);

    // Log the invalid conversations for debugging
    const invalidOnes = conversations.filter(
      // @ts-ignore - Custom property
      (conv) => conv.isInvalid
    );

    console.log(`Found ${invalidOnes.length} invalid conversations:`, invalidOnes);
  };

  // Filter conversations
  const displayedConversations = showInvalidConversations
    ? conversations.filter(
      // @ts-ignore - Custom property
      (conv) => conv.isInvalid
    )
    : conversations.filter(
      // @ts-ignore - Custom property
      (conv) => !conv.isInvalid
    );

  return (
    <ContentLayout
      title={
        <Group align="center" gap="xs">
          <Text size="md" fw={700}>
            Conversations
          </Text>
          <Badge color="gray" size="lg">
            {showInvalidConversations ? invalidConversationCount : conversations.length - invalidConversationCount}
          </Badge>
          {invalidConversationCount > 0 && (
            <ActionIcon
              variant="subtle"
              color={showInvalidConversations ? "blue" : "gray"}
              onClick={handleDebugInvalidConversations}
              title={showInvalidConversations ? "Show valid conversations" : "Show invalid conversations"}>
              <IconBug size={18} />
            </ActionIcon>
          )}
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
        {displayedConversations.length === 0 ? (
          <Box
            display="flex"
            style={{
              flexGrow: 1,
              alignItems: "center",
              justifyContent: "center",
            }}>
            <Text>
              {showInvalidConversations
                ? "No invalid conversations found"
                : "No conversations found"}
            </Text>
          </Box>
        ) : (
          <Box style={{ flexGrow: 1 }}>
            <ConversationsList conversations={displayedConversations} />
          </Box>
        )}

        {/* Address Book Buttons */}
        <Box p="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Group justify="apart">
            <Button
              variant="light"
              color="gray"
              disabled={isBackedUp}
              onClick={() => backupAddressBook()}
              loading={isBackingUp}
              style={{ flex: 1 }}
            >
              Backup Contacts
            </Button>
            <Button
              variant="subtle"
              color="blue"
              onClick={() => syncAddressBook()}
              loading={isSyncing}
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
