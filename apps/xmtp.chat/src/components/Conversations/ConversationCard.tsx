import { Box, Card, Flex, Stack, Text, Image, Tooltip } from "@mantine/core";
import { Dm, Group, type Conversation } from "@xmtp/browser-sdk";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import makeBlockie from 'ethereum-blockies-base64';
import { useWhiskIdentity } from "@/hooks/useWhiskIdentity";
import { useXMTP } from "@/contexts/XMTPContext";
import styles from "./ConversationCard.module.css";

// This will be enabled when Whisk SDK is installed
// Commented out until user confirms installation
// import { Whisk } from '@paperclip-labs/whisk-sdk';

export type ConversationCardProps = {
  conversation: Conversation;
};

export const ConversationCard: React.FC<ConversationCardProps> = ({
  conversation,
}) => {
  const [memberCount, setMemberCount] = useState(0);
  const [name, setName] = useState("");
  const [peerAddress, setPeerAddress] = useState<string | null>(null);
  const [inboxId, setInboxId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { client } = useXMTP();
  
  // Use our Whisk identity hook to resolve the peer address
  const { identity, isLoading, shortenAddress, whiskAvailable } = useWhiskIdentity(peerAddress);

  // Function to extract Ethereum address from any string
  const extractEthereumAddress = (input: string | null | undefined): string | null => {
    if (!input) return null;
    
    // Standard Ethereum address pattern (0x followed by 40 hex chars)
    const ethAddressMatch = input.match(/0x[a-fA-F0-9]{40}/i);
    if (ethAddressMatch) {
      return ethAddressMatch[0].toLowerCase();
    }
    
    // More lenient pattern for non-standard formats
    if (input.includes('0x')) {
      const lenientMatch = input.match(/0x[a-fA-F0-9]{6,}/i);
      if (lenientMatch) {
        return lenientMatch[0].toLowerCase();
      }
    }
    
    return null;
  };
  
  useEffect(() => {
    void conversation.members().then((members) => {
      setMemberCount(members.length);
    });
  }, [conversation.id]);

  useEffect(() => {
    const processPeerIdentity = async () => {
      if (conversation instanceof Group) {
        setName(conversation.name ?? "Group");
      } else if (conversation instanceof Dm) {
        try {
          // Get the peer's inbox ID
          const rawPeerInboxId = await conversation.peerInboxId();
          console.log('Raw peer inbox ID:', rawPeerInboxId);
          setInboxId(rawPeerInboxId);
          
          // Get all conversation members
          const members = await conversation.members();
          console.log('All conversation members:', members);
          
          // Try to find Ethereum addresses from member data
          let peerWalletAddress = null;
          
          // For DM conversations, we should have exactly two members
          if (members.length === 2) {
            // Loop through all members to find Ethereum addresses
            for (const member of members) {
              console.log('Member info:', member);
              
              // Check if member has accountIdentifiers
              if (member.accountIdentifiers && member.accountIdentifiers.length > 0) {
                for (const identifier of member.accountIdentifiers) {
                  console.log('Account identifier:', identifier);
                  if (identifier.identifierKind === 'Ethereum' && identifier.identifier) {
                    // Found an Ethereum address
                    const ethAddr = identifier.identifier.toLowerCase();
                    console.log('Found Ethereum identifier:', ethAddr);
                    
                    // If this is the first Ethereum address we found, or we're sure it's the peer's,
                    // save it as the peer address
                    if (!peerWalletAddress) {
                      peerWalletAddress = ethAddr;
                    }
                  }
                }
              }
            }
          }
          
          // If we didn't find a wallet address from members, try to extract from inbox ID
          if (!peerWalletAddress) {
            peerWalletAddress = extractEthereumAddress(rawPeerInboxId);
            console.log('Extracted wallet address from inbox ID:', peerWalletAddress);
          }
          
          // If we found a wallet address, use it
          if (peerWalletAddress) {
            console.log('Setting peer address:', peerWalletAddress);
            setPeerAddress(peerWalletAddress);
            setName(shortenAddress(peerWalletAddress));
          } 
          // Last resort - use the inbox ID
          else {
            console.log('Using inbox ID as fallback:', rawPeerInboxId);
            setName(rawPeerInboxId);
            // If inbox ID looks like an Ethereum address, use it anyway
            if (rawPeerInboxId?.startsWith('0x')) {
              setPeerAddress(rawPeerInboxId);
            }
          }
        } catch (error) {
          console.error('Error processing peer identity:', error);
          setName("Unknown");
        }
      }
    };
    
    void processPeerIdentity();
  }, [conversation, shortenAddress, extractEthereumAddress]);

  // Use resolved identity name with fallbacks
  const displayName = identity?.name || name || "Untitled";
  
  // Generate blockie avatar for the address if no avatar exists
  const avatarUrl = identity?.avatar || (peerAddress ? makeBlockie(peerAddress) : null);

  // Prepare tooltip text
  const getTooltipText = () => {
    let text = `Address: ${peerAddress}`;
    if (inboxId && inboxId !== peerAddress) {
      text += `\nInbox: ${inboxId}`;
    }
    if (whiskAvailable) {
      text += '\nWhisk identity resolution enabled';
    }
    return text;
  };

  return (
    <Box px="sm">
      <Card
        shadow="sm"
        padding="sm"
        radius="md"
        withBorder
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            void navigate(`/conversations/${conversation.id}`);
          }
        }}
        onClick={() => void navigate(`/conversations/${conversation.id}`)}
        className={[
          styles.root,
          conversation.id === conversationId && styles.selected,
        ].join(" ")}>
        <Stack gap="0">
          <Flex align="center" gap="xs">
            {peerAddress && conversation instanceof Dm && (
              <Tooltip label={getTooltipText()}>
                <Image
                  src={avatarUrl}
                  width={24}
                  height={24}
                  radius="xl"
                  alt={`${displayName} avatar`}
                  onError={(e: any) => {
                    // Fallback to blockie if image fails to load
                    e.currentTarget.src = makeBlockie(peerAddress);
                  }}
                />
              </Tooltip>
            )}
            <Text fw={700} truncate>
              {isLoading ? "Loading..." : displayName}
            </Text>
          </Flex>
          <Text size="sm">
            {memberCount} member{memberCount !== 1 ? "s" : ""}
          </Text>
        </Stack>
      </Card>
    </Box>
  );
};
