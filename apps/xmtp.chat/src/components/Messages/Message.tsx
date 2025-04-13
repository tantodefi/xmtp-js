import { Paper, Text, Group, Tooltip, Flex, Box } from "@mantine/core";
import type { Client, DecodedMessage } from "@xmtp/browser-sdk";
import {
  ContentTypeTransactionReference,
  type TransactionReference,
} from "@xmtp/content-type-transaction-reference";
import {
  ContentTypeWalletSendCalls,
  type WalletSendCallsParams,
} from "@xmtp/content-type-wallet-send-calls";
import { intlFormat, formatRelative } from "date-fns";
import { useNavigate, useOutletContext } from "react-router";
import { nsToDate } from "@/helpers/date";
import { useWhiskIdentity } from "@/hooks/useWhiskIdentity";
import classes from "./Message.module.css";
import { MessageContent } from "./MessageContent";
import { TransactionReferenceContent } from "./TransactionReferenceContent";
import { WalletSendCallsContent } from "./WalletSendCallsContent";
import { EditableAnonBadge } from "@/components/EditableAnonBadge";

export type MessageProps = {
  message: DecodedMessage;
};

export const Message: React.FC<MessageProps> = ({ message }) => {
  const { client } = useOutletContext<{ client: Client }>();
  const isSender = client.inboxId === message.senderInboxId;
  const align = isSender ? "right" : "left";
  const navigate = useNavigate();

  // Get wallet address from message sender's inboxId for identity resolution
  // Extract Ethereum address from inboxId if possible
  const extractEthereumAddress = (inboxId: string): string | null => {
    if (!inboxId) return null;

    // Try to extract Ethereum address from inboxId
    const ethAddressMatch = inboxId.match(/0x[a-fA-F0-9]{40}/i);
    if (ethAddressMatch) {
      return ethAddressMatch[0].toLowerCase();
    }

    // If inboxId starts with 0x, it might be an address
    if (inboxId.startsWith('0x')) {
      return inboxId;
    }

    return null;
  };

  // Get the wallet address from the sender's inboxId
  const senderAddress = extractEthereumAddress(message.senderInboxId);

  // Use identity resolution hook
  const { identity, isLoading, shortenAddress } = useWhiskIdentity(senderAddress);

  // Display name with fallbacks
  const displayName = isSender
    ? "You"
    : identity?.name || shortenAddress(message.senderInboxId);

  // Tooltip text for sender info
  const tooltipText = isSender
    ? "You"
    : `Address: ${senderAddress || message.senderInboxId}`;

  // Always show editable badge for messages from others
  const showEditableBadge = !isSender && !!senderAddress;

  return (
    <Group
      align="flex-start"
      justify={align === "right" ? "flex-end" : "flex-start"}
      p="xs">
      <Paper
        p="xs"
        withBorder
        maw="450px"
        pos="relative"
        style={{
          borderTopRightRadius: align === "right" ? 0 : undefined,
          borderTopLeftRadius: align === "left" ? 0 : undefined,
        }}>
        <Flex gap="xs" align="center" wrap="nowrap" mb={6}>
          <Tooltip label={tooltipText} withArrow position="top">
            <Text size="xs" fw={500}>
              {displayName}
            </Text>
          </Tooltip>

          {/* Add the editable badge for messages not from self */}
          {showEditableBadge && senderAddress && (
            <EditableAnonBadge
              address={senderAddress}
              size="xs"
              editable={false} // Only editable in conversation view
              conversationId={message.conversationId}
            />
          )}
        </Flex>

        <MessageContent content={message.content} />

        <Text size="xs" py="xs" c="dimmed" ta={align}>
          {formatRelative(nsToDate(message.sentAtNs), new Date())}
        </Text>
      </Paper>
    </Group>
  );
};
