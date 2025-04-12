import { Box, Flex, Paper, Stack, Text, Tooltip } from "@mantine/core";
import type { Client, DecodedMessage } from "@xmtp/browser-sdk";
import {
  ContentTypeTransactionReference,
  type TransactionReference,
} from "@xmtp/content-type-transaction-reference";
import {
  ContentTypeWalletSendCalls,
  type WalletSendCallsParams,
} from "@xmtp/content-type-wallet-send-calls";
import { intlFormat } from "date-fns";
import { useNavigate, useOutletContext } from "react-router";
import { nsToDate } from "@/helpers/date";
import { useWhiskIdentity } from "@/hooks/useWhiskIdentity";
import classes from "./Message.module.css";
import { MessageContent } from "./MessageContent";
import { TransactionReferenceContent } from "./TransactionReferenceContent";
import { WalletSendCallsContent } from "./WalletSendCallsContent";

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

  return (
    <Box px="md">
      <Flex justify={align === "left" ? "flex-start" : "flex-end"}>
        <Paper
          p="md"
          withBorder
          shadow="md"
          maw="80%"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void navigate(
                `/conversations/${message.conversationId}/message/${message.id}`,
              );
            }
          }}
          className={classes.root}
          onClick={() =>
            void navigate(
              `/conversations/${message.conversationId}/message/${message.id}`,
            )
          }>
          <Stack gap="xs" align={align === "left" ? "flex-start" : "flex-end"}>
            <Flex
              align="center"
              gap="xs"
              direction={align === "left" ? "row" : "row-reverse"}
              justify={align === "left" ? "flex-start" : "flex-end"}>
              <Tooltip label={tooltipText}>
                <Text size="sm" fw={700} c="text.primary">
                  {isLoading ? "Loading..." : displayName}
                </Text>
              </Tooltip>
              <Text size="sm" c="dimmed">
                {intlFormat(nsToDate(message.sentAtNs), {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </Flex>
            {message.contentType.sameAs(ContentTypeTransactionReference) ? (
              <TransactionReferenceContent
                content={message.content as TransactionReference}
              />
            ) : message.contentType.sameAs(ContentTypeWalletSendCalls) ? (
              <WalletSendCallsContent
                content={message.content as WalletSendCallsParams}
                conversationId={message.conversationId}
              />
            ) : (
              <MessageContent content={message.content as string} />
            )}
          </Stack>
        </Paper>
      </Flex>
    </Box>
  );
};
