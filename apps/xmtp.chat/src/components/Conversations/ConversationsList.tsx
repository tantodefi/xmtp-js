import type { Conversation } from "@xmtp/browser-sdk";
import { useMemo, type ComponentProps } from "react";
import { useParams } from "react-router";
import { Virtuoso } from "react-virtuoso";
import { ConversationCard } from "./ConversationCard";
import classes from "./ConversationList.module.css";

const List = (props: ComponentProps<"div">) => {
  return <div className={classes.root} {...props} />;
};

export type ConversationsListProps = {
  conversations: Conversation[];
};

export const ConversationsList: React.FC<ConversationsListProps> = ({
  conversations,
}) => {
  const { conversationId } = useParams();

  // Filter out invalid conversations
  const validConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      // Filter out conversations marked as invalid by the ConversationCard
      // @ts-ignore - Using the custom property we added
      return !conversation.isInvalid;
    });
  }, [conversations]);

  const selectedConversationIndex = useMemo(
    () =>
      validConversations.findIndex(
        (conversation) => conversation.id === conversationId,
      ),
    [validConversations, conversationId],
  );

  return (
    <Virtuoso
      components={{
        List,
      }}
      initialTopMostItemIndex={Math.max(selectedConversationIndex, 0)}
      style={{ flexGrow: 1 }}
      data={validConversations}
      itemContent={(_, conversation) => (
        <ConversationCard conversation={conversation} />
      )}
    />
  );
}; 
