import { Box, Button, Group, TextInput, Divider, Stack, Title } from "@mantine/core";
import { Utils, type Conversation } from "@xmtp/browser-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Modal } from "@/components/Modal";
import { isValidEthereumAddress, isValidInboxId } from "@/helpers/strings";
import { useCollapsedMediaQuery } from "@/hooks/useCollapsedMediaQuery";
import { useConversations } from "@/hooks/useConversations";
import { useSettings } from "@/hooks/useSettings";
import { ContentLayout } from "@/layouts/ContentLayout";
import { ProfileSearch } from "@/components/ProfileSearch";
import { LuksoProfile } from "@/components/LuksoProfile";

export const CreateDmModal: React.FC = () => {
  const { newDm, newDmWithIdentifier } = useConversations();
  const [loading, setLoading] = useState(false);
  const [memberId, setMemberId] = useState<string>("");
  const [memberIdError, setMemberIdError] = useState<string | null>(null);
  const { environment } = useSettings();
  const utilsRef = useRef<Utils | null>(null);
  const navigate = useNavigate();
  const fullScreen = useCollapsedMediaQuery();
  const contentHeight = fullScreen ? "auto" : 500;
  const [selectedProfileAddress, setSelectedProfileAddress] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    void navigate(-1);
  }, [navigate]);

  const handleCreate = async () => {
    setLoading(true);

    try {
      let conversation: Conversation;

      if (isValidEthereumAddress(memberId)) {
        conversation = await newDmWithIdentifier({
          identifier: memberId,
          identifierKind: "Ethereum",
        });
      } else {
        conversation = await newDm(memberId);
      }

      void navigate(`/conversations/${conversation.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleElsaClick = useCallback(() => {
    navigate("/dm/0xE15AA1ba585AeA8a4639331ce5f9aEc86f8c4541");
  }, [navigate]);

  const handleSelectAddress = useCallback((address: `0x${string}`) => {
    setMemberId(address);
    setSelectedProfileAddress(address);
  }, []);

  useEffect(() => {
    const utils = new Utils();
    utilsRef.current = utils;
    return () => {
      utils.close();
    };
  }, []);

  useEffect(() => {
    const checkMemberId = async () => {
      if (!memberId) {
        setMemberIdError(null);
        return;
      }

      if (!isValidEthereumAddress(memberId) && !isValidInboxId(memberId)) {
        setMemberIdError("Invalid address or inbox ID");
      } else if (isValidEthereumAddress(memberId) && utilsRef.current) {
        const inboxId = await utilsRef.current.getInboxIdForIdentifier(
          {
            identifier: memberId.toLowerCase(),
            identifierKind: "Ethereum",
          },
          environment,
        );
        if (!inboxId) {
          setMemberIdError("Address not registered on XMTP");
        } else {
          setMemberIdError(null);
        }
      } else {
        setMemberIdError(null);
      }
    };

    void checkMemberId();
  }, [memberId]);

  const footer = useMemo(() => {
    return (
      <Group justify="flex-end" flex={1} p="md">
        <Button variant="default" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="filled"
          disabled={loading || memberIdError !== null}
          loading={loading}
          onClick={() => void handleCreate()}>
          Create
        </Button>
      </Group>
    );
  }, [handleClose, handleCreate, loading, memberIdError]);

  return (
    <Modal
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      opened
      centered
      fullScreen={fullScreen}
      onClose={handleClose}
      size="600"
      padding={0}>
      <ContentLayout
        title="Create direct message"
        maxHeight={contentHeight}
        footer={footer}
        withScrollAreaPadding={false}>
        <Box p="md">
          <Stack spacing="md">
            <Box>
              <Title order={5} mb="xs">Search Universal Profiles</Title>
              <ProfileSearch onSelectAddress={handleSelectAddress} />
            </Box>
            
            {selectedProfileAddress && <LuksoProfile address={selectedProfileAddress} />}
            
            <Divider label="Or enter address manually" labelPosition="center" />
            
            <TextInput
              size="sm"
              label="Address or inbox ID"
              styles={{
                label: {
                  marginBottom: "var(--mantine-spacing-xxs)",
                },
              }}
              error={memberIdError}
              value={memberId}
              onChange={(event) => {
                setMemberId(event.target.value);
                if (selectedProfileAddress) setSelectedProfileAddress(null);
              }}
            />
            <Divider my="xs" />
            
            <Box>
              <Title order={5} mb="xs">XMTP Agents</Title>
              <Button 
                color="blue" 
                fullWidth
                onClick={handleElsaClick}
                mt="xs">
                👋 Hey Elsa
              </Button>
              <Button 
                component="a" 
                href="https://xmtp.chat/agents"
                variant="outline"
                fullWidth
                mt="xs">
                Add new agent
              </Button>
            </Box>
          </Stack>
        </Box>
      </ContentLayout>
    </Modal>
  );
};
