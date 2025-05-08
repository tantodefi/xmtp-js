import { Box, Button, Group, Text, Title, Paper, Badge, Stack } from "@mantine/core";
import { useEffect, useState } from "react";
import { useXMTP } from "@/contexts/XMTPContext";
import { useNavigate } from "react-router-dom";
import type { Conversation } from "@xmtp/browser-sdk";

// Define a type for the stored messages
type StoredMessage = {
  id: string;
  content: string;
  timestamp: string;
  sender: string;
  recipient: string;
  conversationId: string;
};

export const GridOwnerMessages: React.FC = () => {
  const { client } = useXMTP();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [gridOwnerConversation, setGridOwnerConversation] = useState<Conversation | null>(null);
  const [storedMessages, setStoredMessages] = useState<StoredMessage[]>([]);
  const [hasMessages, setHasMessages] = useState(false);
  
  // Check for stored messages in localStorage
  useEffect(() => {
    const checkStoredMessages = () => {
      try {
        const messagesJson = localStorage.getItem('gridOwnerMessages');
        if (messagesJson) {
          const messages = JSON.parse(messagesJson);
          console.log('GridOwnerMessages: Found stored messages:', messages);
          setStoredMessages(messages);
          setHasMessages(messages.length > 0);
        }
      } catch (error) {
        console.error('GridOwnerMessages: Error reading stored messages:', error);
      }
    };
    
    checkStoredMessages();
    
    // Set up an interval to check for new messages
    const intervalId = setInterval(checkStoredMessages, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Function to check for grid owner messages directly in the XMTP network
  const checkForGridOwnerMessages = async () => {
    if (!client) {
      console.log("GridOwnerMessages: No client available");
      return;
    }
    
    setLoading(true);
    try {
      console.log("GridOwnerMessages: Syncing conversations...");
      
      // Try different sync methods based on SDK version
      try {
        // Use type assertion to handle different versions of the SDK
        const conversationsApi = client.conversations as any;
        if (typeof conversationsApi.syncAllMessages === 'function') {
          await conversationsApi.syncAllMessages();
        } else if (typeof conversationsApi.syncAll === 'function') {
          await conversationsApi.syncAll();
        } else if (typeof conversationsApi.sync === 'function') {
          await conversationsApi.sync();
        }
        console.log("GridOwnerMessages: Sync completed successfully");
      } catch (syncError) {
        console.warn("GridOwnerMessages: Error during sync, but continuing:", syncError);
      }
      
      // Get all conversations
      const allConversations = await client.conversations.list();
      console.log("GridOwnerMessages: Found conversations:", allConversations.length);
      
      // Look for grid owner conversations using multiple criteria
      const gridOwnerConvos = allConversations.filter(convo => {
        // Use type assertion to safely access properties that might not exist in the type definition
        const convoAny = convo as any;
        // Check conversation metadata
        const metadata = (convoAny.metadata || {}) as Record<string, any>;
        const context = (convoAny.context || {}) as Record<string, any>;
        
        // Check for our special topic or conversation ID pattern
        const hasTopic = metadata.topic === 'gridowner-contact-form';
        const hasType = metadata.conversationType === 'gridowner-contact';
        const hasGridOwnerFlag = metadata.isGridOwnerMessage === 'true';
        
        // Check for our standard conversation ID format
        const convoIdPattern = /^gridowner-messages-0x[a-fA-F0-9]{40}$/;
        const matchesIdPattern = typeof context.conversationId === 'string' && 
                               convoIdPattern.test(context.conversationId);
        
        return hasTopic || hasType || hasGridOwnerFlag || matchesIdPattern;
      });
      
      console.log("Found grid owner conversations:", gridOwnerConvos.length, gridOwnerConvos);
      
      if (gridOwnerConvos.length > 0) {
        setGridOwnerConversation(gridOwnerConvos[0]);
        console.log("Set active grid owner conversation:", gridOwnerConvos[0]);
      }
    } catch (error) {
      console.error("Error checking for grid owner messages:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check for grid owner messages when the component mounts
  useEffect(() => {
    if (client) {
      checkForGridOwnerMessages();
    }
  }, [client]);
  
  // Refresh function to manually check for messages
  const refreshMessages = () => {
    if (client) {
      checkForGridOwnerMessages();
    }
    
    // Also refresh stored messages
    try {
      const messagesJson = localStorage.getItem('gridOwnerMessages');
      if (messagesJson) {
        const messages = JSON.parse(messagesJson);
        setStoredMessages(messages);
        setHasMessages(messages.length > 0);
      }
    } catch (error) {
      console.error('Error refreshing stored messages:', error);
    }
  };

  // Render the component with both XMTP conversation messages and localStorage messages
  return (
    <Paper p="md" mb="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Title order={5}>Grid Owner Contact Form Messages</Title>
        <Button 
          size="xs" 
          variant="light"
          onClick={refreshMessages}
        >
          Refresh
        </Button>
      </Group>
      
      {loading && (
        <Text size="sm" color="dimmed" mb="sm">Checking for messages...</Text>
      )}
      
      {/* Display XMTP conversation if found */}
      {gridOwnerConversation && (
        <Box mb="md">
          <Group>
            <Badge color="green" mb="xs">XMTP Conversation</Badge>
            <Button 
              size="xs" 
              variant="light"
              onClick={() => navigate(`/conversations/${gridOwnerConversation.id}`)}
            >
              View Messages
            </Button>
          </Group>
          <Text size="sm">
            Found a conversation with grid owner messages. Click above to view the full conversation.
          </Text>
        </Box>
      )}
      
      {/* Display localStorage messages if any */}
      {storedMessages.length > 0 ? (
        <Box>
          <Badge color="blue" mb="xs">Stored Messages ({storedMessages.length})</Badge>
          <Stack gap="xs">
            {storedMessages.map((msg, index) => (
              <Paper key={msg.id || index} p="xs" withBorder>
                <Text size="sm" fw={500}>{msg.content}</Text>
                <Group justify="space-between" mt="xs">
                  <Text size="xs" color="dimmed">From: {msg.sender.substring(0, 8)}...</Text>
                  <Text size="xs" color="dimmed">
                    {new Date(parseInt(msg.timestamp)).toLocaleString()}
                  </Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Box>
      ) : (
        <Box>
          {!gridOwnerConversation && !loading && (
            <Text>No grid owner messages found yet.</Text>
          )}
          <Text size="sm" color="dimmed" mt="xs">
            Messages sent through the grid owner contact form will appear here.
          </Text>
        </Box>
      )}
    </Paper>
  );
};
