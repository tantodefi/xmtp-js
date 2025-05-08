import { Box, Button, Group, Text, Title, Paper } from "@mantine/core";
import { useEffect, useState } from "react";
import { useXMTP } from "@/contexts/XMTPContext";
import { useNavigate } from "react-router-dom";
import type { Conversation } from "@xmtp/browser-sdk";

export const GridOwnerMessages: React.FC = () => {
  const { client } = useXMTP();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [gridOwnerConversation, setGridOwnerConversation] = useState<Conversation | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  // Standard conversation ID that matches what we use in the grid owner form
  // Get the client's address from the signer identifier
  const clientAddress = client ? (client as any).address || (client as any).getIdentifier?.()?.identifier : null;
  const standardConversationId = clientAddress 
    ? `gridowner-messages-${clientAddress}`
    : null;

  // Function to check for grid owner messages
  const checkForGridOwnerMessages = async () => {
    if (!client || !standardConversationId) {
      console.log("GridOwnerMessages: No client or standardConversationId", { client: !!client, standardConversationId });
      return;
    }
    
    setLoading(true);
    try {
      console.log("GridOwnerMessages: Checking for grid owner messages with ID:", standardConversationId);
      console.log("GridOwnerMessages: Client address:", clientAddress);
      
      // First try to sync all conversations to make sure we have the latest data
      console.log("GridOwnerMessages: Syncing all conversations...");
      await client.conversations.syncAll();
      console.log("GridOwnerMessages: Sync completed");
      
      // Get all conversations
      console.log("GridOwnerMessages: Listing all conversations...");
      const allConversations = await client.conversations.list();
      console.log("GridOwnerMessages: Found conversations:", allConversations.length);
      
      // Log all conversation metadata for debugging
      allConversations.forEach((convo, index) => {
        console.log(`GridOwnerMessages: Conversation ${index}:`, {
          id: convo.id,
          topic: (convo as any).topic,
          peerAddress: (convo as any).peerAddress,
          metadata: convo.metadata,
          context: (convo as any).context
        });
      });
      
      // Look for conversations with our special topic or ID
      const gridOwnerConvos = allConversations.filter(convo => {
        // Check if this conversation has our special ID or topic
        const metadata = convo.metadata as any;
        const context = (convo as any).context;
        return (
          (metadata && metadata.conversationId === standardConversationId) ||
          (metadata && metadata.topic === 'gridowner-contact-form') ||
          (context && context.conversationId === standardConversationId)
        );
      });
      
      console.log("Found grid owner conversations:", gridOwnerConvos.length);
      
      if (gridOwnerConvos.length > 0) {
        setGridOwnerConversation(gridOwnerConvos[0]);
      }
    } catch (error) {
      console.error("Error checking for grid owner messages:", error);
    } finally {
      setLoading(false);
      setHasChecked(true);
    }
  };

  // Check for grid owner messages when the component mounts
  useEffect(() => {
    if (client && !hasChecked) {
      checkForGridOwnerMessages();
    }
  }, [client, hasChecked]);
  
  // Also check when clientAddress changes
  useEffect(() => {
    if (client && clientAddress && hasChecked) {
      console.log("GridOwnerMessages: Client address changed, rechecking messages");
      checkForGridOwnerMessages();
    }
  }, [clientAddress]);

  // Always show the component for debugging
  if (!client || !standardConversationId) {
    return (
      <Paper p="md" mb="md" withBorder>
        <Title order={5}>Grid Owner Messages (Debug)</Title>
        <Text color="red">No client or conversation ID available</Text>
        <Text size="sm">Client: {client ? 'Available' : 'Not available'}</Text>
        <Text size="sm">Conversation ID: {standardConversationId || 'Not available'}</Text>
        <Text size="sm">Client Address: {clientAddress || 'Not available'}</Text>
        <Button size="xs" onClick={() => console.log('Current client:', client)}>Log Client</Button>
      </Paper>
    );
  }
  
  // If we haven't checked for messages yet, show a loading state
  if (!hasChecked) {
    return (
      <Paper p="md" mb="md" withBorder>
        <Title order={5}>Grid Owner Messages</Title>
        <Text>Checking for grid owner messages...</Text>
        <Text size="sm">Conversation ID: {standardConversationId}</Text>
        <Text size="sm">Client Address: {clientAddress}</Text>
      </Paper>
    );
  }

  // If we have a grid owner conversation, show it
  if (gridOwnerConversation) {
    return (
      <Paper p="md" mb="md" withBorder>
        <Group justify="space-between" mb="xs">
          <Title order={5}>Grid Owner Contact Form Messages</Title>
          <Button 
            size="xs" 
            variant="light"
            onClick={() => navigate(`/conversations/${gridOwnerConversation.id}`)}
          >
            View Messages
          </Button>
        </Group>
        <Text size="sm" color="dimmed">
          Messages sent through the grid owner contact form will appear here.
        </Text>
      </Paper>
    );
  }

  // If we don't have a grid owner conversation, show a message
  return (
    <Paper p="md" mb="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Title order={5}>Grid Owner Contact Form Messages</Title>
        <Button 
          size="xs" 
          variant="light"
          onClick={checkForGridOwnerMessages}
        >
          Refresh
        </Button>
      </Group>
      <Text>No grid owner messages found yet.</Text>
      <Text size="sm" color="dimmed" mt="xs">
        Messages sent through the grid owner contact form will appear here.
      </Text>
    </Paper>
  );
};
