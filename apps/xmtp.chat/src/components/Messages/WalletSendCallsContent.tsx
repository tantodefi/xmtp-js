import { Box, Button, List, Space, Text } from "@mantine/core";
import type { Client } from "@xmtp/browser-sdk";
import {
  ContentTypeTransactionReference,
  type TransactionReference,
} from "@xmtp/content-type-transaction-reference";
import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import { useCallback, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useChainId, useSendTransaction, useSwitchChain } from "wagmi";
import { isLuksoUPProvider } from "@/helpers/createSigner";

export type WalletSendCallsContentProps = {
  content: WalletSendCallsParams;
  conversationId: string;
};

export const WalletSendCallsContent: React.FC<WalletSendCallsContentProps> = ({
  content,
  conversationId,
}) => {
  const { client } = useOutletContext<{ client: Client }>();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const wagmiChainId = useChainId();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    try {
      setError(null);
      const chainId = parseInt(content.chainId, 16);

      if (chainId !== wagmiChainId) {
        console.log(
          `Current Chain Id (${wagmiChainId}) doesn't match; checking if chain switching is supported...`,
        );

        // Check if we're using a LUKSO UP provider (which doesn't support chain switching)
        const provider = window.lukso || window.ethereum;
        const isLuksoProvider = provider && isLuksoUPProvider(provider);

        if (isLuksoProvider) {
          // For LUKSO UP, show error message instead of trying to switch
          console.warn("Universal Profile does not support programmatic chain switching");
          setError(`Please manually switch to ${content.chainId === '0x2a' ? 'LUKSO Mainnet' : 'the correct network'} in your wallet and try again.`);
          return;
        }

        // For other wallets, try to switch chain
        await switchChainAsync({ chainId });
        await new Promise((r) => setTimeout(r, 300)); // Metamask requires some delay
      }

      for (const call of content.calls) {
        const wagmiTxData = {
          ...call,
          value: BigInt(parseInt(call.value || "0x0", 16)),
          chainId,
          gas: call.gas ? BigInt(parseInt(call.gas, 16)) : undefined,
        };
        const txHash = await sendTransactionAsync(wagmiTxData, {
          onError(error) {
            console.error(error);
            setError(`Transaction failed: ${error.message}`);
          },
        });
        const transactionReference: TransactionReference = {
          networkId: content.chainId,
          reference: txHash,
        };
        const conversation =
          await client.conversations.getConversationById(conversationId);
        if (!conversation) {
          console.error("Couldn't find conversation by Id");
          return;
        }
        await conversation.send(
          transactionReference,
          ContentTypeTransactionReference,
        );
      }
    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      setError(err.message || "Transaction failed");
    }
  }, [content, sendTransactionAsync, switchChainAsync, client, conversationId, wagmiChainId]);

  return (
    <Box flex="flex">
      <Text size="sm">Review the following transactions:</Text>
      <List size="sm">
        {content.calls.map((call, index) => (
          <List.Item key={index}>{call.metadata?.description}</List.Item>
        ))}
      </List>
      {error && (
        <>
          <Space h="sm" />
          <Text size="sm" color="red">
            {error}
          </Text>
        </>
      )}
      <Space h="md" />
      <Button
        fullWidth
        onClick={(event) => {
          event.stopPropagation();
          void handleSubmit();
        }}>
        Submit
      </Button>
    </Box>
  );
};
