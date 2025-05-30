import { Group, Text, Flex, Image, Loader, Tooltip, Stack, Avatar } from "@mantine/core";
import {
  Group as XmtpGroup,
  Dm,
  type Client,
  type Conversation as XmtpConversation,
} from "@xmtp/browser-sdk";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import makeBlockie from 'ethereum-blockies-base64';
import { ConversationMenu } from "@/components/Conversation/ConversationMenu";
import { Messages } from "@/components/Messages/Messages";
import { useConversation } from "@/hooks/useConversation";
import { useWhiskIdentity } from "@/hooks/useWhiskIdentity";
import { ContentLayout } from "@/layouts/ContentLayout";
import { Composer } from "./Composer";
import { EditableAnonBadge } from "@/components/EditableAnonBadge";

export type ConversationProps = {
  conversation: XmtpConversation;
};

export const Conversation: React.FC<ConversationProps> = ({ conversation }) => {
  const { client } = useOutletContext<{ client: Client }>();
  const [title, setTitle] = useState("");
  const [peerAddress, setPeerAddress] = useState<string | null>(null);
  const [inboxId, setInboxId] = useState<string | null>(null);
  const [isLoadingPeer, setIsLoadingPeer] = useState(false);
  const {
    messages,
    getMessages,
    loading: conversationLoading,
    syncing: conversationSyncing,
    streamMessages,
  } = useConversation(conversation);
  const stopStreamRef = useRef<(() => void) | null>(null);

  // Use Whisk identity resolution for the peer address
  const { identity, isLoading: isResolvingIdentity, shortenAddress } = useWhiskIdentity(peerAddress);

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

  const startStream = useCallback(async () => {
    stopStreamRef.current = await streamMessages();
  }, [streamMessages]);

  const stopStream = useCallback(() => {
    stopStreamRef.current?.();
    stopStreamRef.current = null;
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      stopStream();
      await getMessages(undefined, true);
      await startStream();
    };
    void loadMessages();
  }, [conversation.id]);

  const handleSync = useCallback(async () => {
    stopStream();
    await getMessages(undefined, true);
    await startStream();
    if (conversation instanceof XmtpGroup) {
      setTitle(conversation.name || "Untitled");
    }
  }, [getMessages, conversation.id, startStream, stopStream]);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  // Get peer identity information
  useEffect(() => {
    const processPeerIdentity = async () => {
      if (conversation instanceof XmtpGroup) {
        setTitle(conversation.name || "Untitled");
      } else if (conversation instanceof Dm) {
        setIsLoadingPeer(true);
        try {
          // Set an initial placeholder title
          setTitle("Direct message");

          // Get the peer's inbox ID
          const rawPeerInboxId = await conversation.peerInboxId();
          console.log('[Conversation] Raw peer inbox ID:', rawPeerInboxId);
          setInboxId(rawPeerInboxId);

          // Get all conversation members
          const members = await conversation.members();
          console.log('[Conversation] All conversation members:', members);

          // Try to find Ethereum addresses from member data
          let peerWalletAddress = null;
          const myInboxId = client?.inboxId;

          // For DM conversations, we should have exactly two members
          if (members.length === 2) {
            // Loop through all members to find Ethereum addresses
            for (const member of members) {
              // Skip our own account
              if (member.inboxId === myInboxId) {
                console.log('[Conversation] Skipping own account:', member.inboxId);
                continue;
              }

              console.log('[Conversation] Processing peer member:', member);

              // Set the peer's inboxId first as a fallback
              if (!peerWalletAddress && member.inboxId) {
                peerWalletAddress = extractEthereumAddress(member.inboxId);
                console.log('[Conversation] Extracted address from peer inboxId:', peerWalletAddress);
              }

              // Check if member has accountIdentifiers
              if (member.accountIdentifiers && member.accountIdentifiers.length > 0) {
                for (const identifier of member.accountIdentifiers) {
                  console.log('[Conversation] Account identifier:', identifier);
                  if (identifier.identifierKind === 'Ethereum' && identifier.identifier) {
                    // Found an Ethereum address
                    const ethAddr = identifier.identifier.toLowerCase();
                    console.log('[Conversation] Found Ethereum identifier:', ethAddr);

                    // Use this as the peer wallet address
                    peerWalletAddress = ethAddr;
                    break;
                  }
                }
              }
            }
          }

          // If we didn't find a wallet address from members, try to extract from inbox ID
          if (!peerWalletAddress && rawPeerInboxId) {
            peerWalletAddress = extractEthereumAddress(rawPeerInboxId);
            console.log('[Conversation] Extracted wallet address from inbox ID:', peerWalletAddress);
          }

          // If we found a wallet address, use it
          if (peerWalletAddress) {
            console.log('[Conversation] Setting peer address:', peerWalletAddress);
            setPeerAddress(peerWalletAddress);
            // Set initial title to shortened address, will be updated when identity resolves
            const shortened = shortenAddress(peerWalletAddress);
            console.log('[Conversation] Shortened address:', shortened);
            setTitle(shortened);
          }
          // Last resort - use the inbox ID
          else if (rawPeerInboxId) {
            console.log('[Conversation] Using inbox ID as fallback:', rawPeerInboxId);
            setTitle(rawPeerInboxId?.substring(0, 10) + '...');
            // If inbox ID looks like an Ethereum address, use it anyway
            if (rawPeerInboxId?.startsWith('0x')) {
              setPeerAddress(rawPeerInboxId);
            }
          } else {
            setTitle("Unknown recipient");
          }
        } catch (error) {
          console.error('[Conversation] Error processing peer identity:', error);
          setTitle("Unknown recipient");
        } finally {
          setIsLoadingPeer(false);
        }
      }
    };

    void processPeerIdentity();
  }, [conversation, client?.inboxId, shortenAddress]);

  // Update title when identity resolves
  useEffect(() => {
    if (conversation instanceof Dm && identity && identity.name) {
      setTitle(identity.name);
    }
  }, [conversation, identity]);

  // Generate avatar URL
  const avatarUrl = identity?.avatar || (peerAddress ? makeBlockie(peerAddress) : null);

  // Always show editable badge when we have a valid address for better visibility
  const showEditableBadge = !!peerAddress;

  console.log("Conversation badge debug:", {
    peerAddress,
    title,
    identityName: identity?.name,
    shouldShowBadge: showEditableBadge,
    isDm: conversation instanceof Dm
  });

  // Get the title for the conversation based on resolved identity or address
  const titleMemo = useMemo(() => {
    // Debug about title
    console.log("Conversation title rendering", { identity, peerAddress });

    if (isLoadingPeer) return "Loading...";
    if (identity?.name) return identity.name;
    if (peerAddress) return `${shortenAddress(peerAddress)}`;
    return "Unknown";
  }, [isLoadingPeer, identity, peerAddress, shortenAddress]);

  // Custom title component with avatar
  const titleComponent = (
    <>
      {conversation instanceof Dm ? (
        <Flex align="center" gap="xs" wrap="nowrap">
          {isLoadingPeer || isResolvingIdentity ? (
            <Loader size="xs" />
          ) : peerAddress ? (
            <Image
              src={avatarUrl}
              width={24}
              height={24}
              radius="xl"
              alt={`${titleMemo} avatar`}
              onError={(e: any) => {
                // Fallback to blockie if image fails to load
                e.currentTarget.src = makeBlockie(peerAddress);
              }}
            />
          ) : null}
          <Text style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {titleMemo}
          </Text>

          {/* Always show badge if we have a peer address */}
          {peerAddress && (
            <EditableAnonBadge
              address={peerAddress}
              size="sm"
              editable={true}
              conversationId={conversation.id}
              isInConversationHeader={true}
            />
          )}
        </Flex>
      ) : (
        <Text>{titleMemo}</Text>
      )}
    </>
  );

  return (
    <>
      <ContentLayout
        title={titleComponent}
        loading={conversationLoading}
        headerActions={
          <Group gap="xs">
            <ConversationMenu
              type={conversation instanceof XmtpGroup ? "group" : "dm"}
              onSync={() => void handleSync()}
              disabled={conversationSyncing}
            />
          </Group>
        }
        footer={<Composer conversation={conversation} />}
        withScrollArea={false}>
        <Messages messages={messages} />
      </ContentLayout>
      <Outlet context={{ conversation, client }} />
    </>
  );
};
