import { Code, Paper, Text } from "@mantine/core";

export type MessageContentProps = {
  content: any;
};

/**
 * Renders the content of a message. This is a simple component for now,
 * but could be extended to handle different content types.
 */
export const MessageContent: React.FC<MessageContentProps> = ({ content }) => {
  return typeof content === "string" ? (
    <Paper
      bg="var(--mantine-color-blue-filled)"
      c="white"
      py="xs"
      px="sm"
      radius="md">
      <Text style={{ whiteSpace: "pre-wrap" }}>{content}</Text>
    </Paper>
  ) : (
    <Code
      block
      maw={420}
      w="100%"
      style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {JSON.stringify(content, null, 2)}
    </Code>
  );
};
