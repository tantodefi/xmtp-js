import { Box, Button, Group, Text, Title, Paper, Badge, Stack, Divider } from "@mantine/core";
import { useEffect, useState } from "react";
import { useXMTP } from "@/contexts/XMTPContext";
import { useNavigate } from "react-router-dom";
import type { Conversation } from "@xmtp/browser-sdk";

// Define a type for XMTP messages in our format
type XmtpMessage = {
  id: string;
  content: string;
  timestamp: number;
  sender: string;
  recipient: string;
  conversationId: string;
};

// Helper function to format message content for better display
const formatMessageContent = (content: string): string => {
  if (!content) return '';
  
  // Trim excessive whitespace
  let formatted = content.trim();
  
  // Replace multiple consecutive newlines with at most two
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  // If the message is too long, truncate it
  const maxLength = 1000;
  if (formatted.length > maxLength) {
    formatted = formatted.substring(0, maxLength) + '...';
  }
  
  return formatted;
};

export const GridOwnerMessages: React.FC = () => {
  const { client } = useXMTP();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [gridOwnerConversation, setGridOwnerConversation] = useState<Conversation | null>(null);
  const [xmtpMessages, setXmtpMessages] = useState<XmtpMessage[]>([]);
  const [hasMessages, setHasMessages] = useState(false);
  
  // Set up an interval to check for new XMTP messages
  useEffect(() => {
    if (client) {
      // Initial check for messages
      checkForGridOwnerMessages();
      
      // Set up an interval to check for new messages
      const intervalId = setInterval(checkForGridOwnerMessages, 5000);
      return () => clearInterval(intervalId);
    }
  }, [client]);

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
      const conversationsApi = client.conversations as any;
      const allConversations = await conversationsApi.list();
      console.log("GridOwnerMessages: Found conversations:", allConversations.length);
      
      // Look for grid owner conversations using multiple criteria
      const gridOwnerConvos = allConversations.filter((convo: any) => {
        // Check conversation metadata
        const convoAny = convo as any;
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
        
        // Also check the peer address to see if it matches any grid owner address pattern
        const isPeerGridOwner = convoAny.peerAddress && 
                              typeof convoAny.peerAddress === 'string' &&
                              convoAny.peerAddress.startsWith('0x');
        
        return hasTopic || hasType || hasGridOwnerFlag || matchesIdPattern || isPeerGridOwner;
      });
      
      console.log("Found grid owner conversations:", gridOwnerConvos.length, gridOwnerConvos);
      
      if (gridOwnerConvos.length > 0) {
        // Set the first conversation as the active one
        const activeConvo = gridOwnerConvos[0];
        setGridOwnerConversation(activeConvo);
        console.log("Set active grid owner conversation:", activeConvo);
        
        // Try to load messages from this conversation
        try {
          if (typeof activeConvo.messages === 'function') {
            console.log('Loading messages from conversation');
            const messages = await activeConvo.messages();
            console.log('Loaded messages:', messages);
            
            if (messages && messages.length > 0) {
              // Convert XMTP messages to our format
              const formattedMessages = messages.map((msg: any) => ({
                id: msg.id,
                conversationId: activeConvo.id || 'unknown',
                sender: msg.senderAddress || 'unknown',
                recipient: activeConvo.peerAddress || 'unknown',
                content: msg.content,
                timestamp: msg.sent?.getTime() || Date.now(),
                sentViaXmtp: true
              }));
              
              setXmtpMessages(formattedMessages);
              console.log('Set XMTP messages:', formattedMessages);
              setHasMessages(true);
            }
          }
        } catch (messagesError) {
          console.error('Error loading messages from conversation:', messagesError);
        }
      }
    } catch (error) {
      console.error("Error checking for grid owner messages:", error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh function to manually check for messages
  const refreshMessages = () => {
    if (client) {
      checkForGridOwnerMessages();
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
      
      {/* Display XMTP messages */}
      {xmtpMessages.length > 0 && (
        <Box mb="md">
          <Badge color="green" mb="xs">Messages ({xmtpMessages.length})</Badge>
          <Stack gap="xs">
            {xmtpMessages.map((msg, index) => (
              <Paper key={msg.id || index} p="md" withBorder shadow="sm">
                {/* Format the message content with proper wrapping */}
                <Box style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}>
                  <Text size="sm" fw={500} style={{ lineHeight: 1.5 }}>
                    {formatMessageContent(msg.content)}
                  </Text>
                </Box>
                <Divider my="xs" />
                <Group justify="space-between" mt="xs">
                  <Text size="xs" color="dimmed">From: {typeof msg.sender === 'string' ? msg.sender.substring(0, 8) + '...' : 'Unknown'}</Text>
                  <Text size="xs" color="dimmed">
                    {new Date(typeof msg.timestamp === 'number' ? msg.timestamp : Date.now()).toLocaleString()}
                  </Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}
      
      {/* Show message if no messages found */}
      {xmtpMessages.length === 0 && !loading && (
        <Box>
          <Text>No grid owner messages found yet.</Text>
          <Text size="sm" color="dimmed" mt="xs">
            Messages sent through the grid owner contact form will appear here.
          </Text>
        </Box>
      )}
    </Paper>
  );
};
