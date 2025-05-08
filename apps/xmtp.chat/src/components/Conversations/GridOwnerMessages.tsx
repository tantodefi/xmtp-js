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
    if (!client || !standardConversationId) return;
    
    setLoading(true);
    try {
      console.log("Checking for grid owner messages with ID:", standardConversationId);
      
      // First try to sync all conversations to make sure we have the latest data
      await client.conversations.syncAll();
      
      // Get all conversations
      const allConversations = await client.conversations.list();
      console.log("Found conversations:", allConversations.length);
      
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

  // If we haven't checked yet or we're loading, show a loading state
  if (!hasChecked || loading) {
    return null; // Don't show anything while loading
  }

  // If we don't have a grid owner conversation, don't show anything
  if (!gridOwnerConversation) {
    return null;
  }

  // If we have a grid owner conversation, show it
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
};
