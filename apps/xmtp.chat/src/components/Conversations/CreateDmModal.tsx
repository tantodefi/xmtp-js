import { Box, Button, Group, TextInput, Divider, Stack, Title, Text } from "@mantine/core";
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
import { useWhiskIdentity } from "@/hooks/useWhiskIdentity";
import { useEnsAddress } from "wagmi";
import { useXMTP } from "@/contexts/XMTPContext";

const WHISK_API_URL = 'https://api.whisk.so/graphql';

export const CreateDmModal: React.FC = () => {
  const { client, initializing } = useXMTP();
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
  const [xmtpAddressFromUP, setXmtpAddressFromUP] = useState<string | null>(null);

  // Add Whisk identity resolution
  const isEnsName = memberId.endsWith('.eth');
  const { identity: whiskIdentity } = useWhiskIdentity(
    memberId.startsWith('0x') && memberId.length === 42 ? memberId : null
  );

  // Use wagmi's ENS resolution
  const { data: ensAddress, isLoading: isResolvingEns } = useEnsAddress({
    name: isEnsName ? memberId : undefined,
  });

  const resolveEnsName = async (name: string) => {
    try {
      const response = await fetch(WHISK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_WHISK_API_KEY}`
        },
        body: JSON.stringify({
          query: `
            query {
              identity(name: "${name}") {
                address
                name
                avatar
              }
            }
          `
        })
      });

      const { data } = await response.json();
      if (data?.identity?.address) {
        return data.identity.address;
      }
      return null;
    } catch (error) {
      console.error('Error resolving ENS:', error);
      return null;
    }
  };

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

      if (isEnsName) {
        if (isResolvingEns) {
          setMemberIdError(null);
          return;
        }

        if (!ensAddress) {
          setMemberIdError("Invalid ENS name");
          return;
        }

        // Check XMTP registration for resolved ENS address
        if (utilsRef.current) {
          try {
            const inboxId = await utilsRef.current.getInboxIdForIdentifier(
              {
                identifier: ensAddress.toLowerCase(),
                identifierKind: "Ethereum",
              },
              environment,
            );
            if (!inboxId) {
              setMemberIdError("Address not registered on XMTP");
            } else {
              setMemberIdError(null);
            }
          } catch (error) {
            console.error('Error checking XMTP registration:', error);
            setMemberIdError("Error checking XMTP registration");
          }
        }
        return;
      }

      if (!isValidEthereumAddress(memberId) && !isValidInboxId(memberId)) {
        setMemberIdError("Invalid address or inbox ID");
      } else if (isValidEthereumAddress(memberId) && utilsRef.current) {
        try {
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
        } catch (error) {
          console.error('Error checking XMTP registration:', error);
          setMemberIdError("Error checking XMTP registration");
        }
      } else {
        setMemberIdError(null);
      }
    };

    void checkMemberId();
  }, [memberId, isEnsName, ensAddress, isResolvingEns, environment]);

  const handleClose = useCallback(() => {
    void navigate(-1);
  }, [navigate]);

  const handleCreate = async () => {
    setLoading(true);

    try {
      let conversation: Conversation;

      // If we have an XMTP address from a Universal Profile, use that instead
      if (xmtpAddressFromUP && isValidEthereumAddress(xmtpAddressFromUP)) {
        console.log('Creating DM with XMTP address from UP:', xmtpAddressFromUP);
        conversation = await newDmWithIdentifier({
          identifier: xmtpAddressFromUP,
          identifierKind: "Ethereum",
        });
      } else if (isEnsName && ensAddress) {
        console.log('Creating DM with resolved ENS address:', ensAddress);
        conversation = await newDmWithIdentifier({
          identifier: ensAddress,
          identifierKind: "Ethereum",
        });
      } else if (isValidEthereumAddress(memberId)) {
        conversation = await newDmWithIdentifier({
          identifier: memberId,
          identifierKind: "Ethereum",
        });
      } else {
        conversation = await newDm(memberId);
      }

      void navigate(`/conversations/${conversation.id}`);
    } catch (error) {
      console.error('Error creating DM:', error);
      setMemberIdError("Error creating DM");
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
    // Clear any previous XMTP address from UP
    setXmtpAddressFromUP(null);
  }, []);

  // Callback for when an XMTP address is found in a Universal Profile
  const handleXmtpAddressFound = useCallback((xmtpAddress: string) => {
    console.log("XMTP address found in Universal Profile:", xmtpAddress);
    setXmtpAddressFromUP(xmtpAddress);
    
    // Verify the found address is registered with XMTP
    if (utilsRef.current && isValidEthereumAddress(xmtpAddress)) {
      utilsRef.current.getInboxIdForIdentifier(
        {
          identifier: xmtpAddress.toLowerCase(),
          identifierKind: "Ethereum",
        },
        environment,
      ).then(inboxId => {
        if (inboxId) {
          console.log("XMTP address from UP is registered with XMTP:", xmtpAddress);
          setMemberIdError(null);
        } else {
          console.log("XMTP address from UP is not registered with XMTP:", xmtpAddress);
          setMemberIdError("The XMTP address in this UP is not registered with XMTP");
          setXmtpAddressFromUP(null);
        }
      }).catch(error => {
        console.error("Error checking XMTP registration for UP's XMTP address:", error);
        setMemberIdError("Failed to check XMTP registration for UP's XMTP address");
        setXmtpAddressFromUP(null);
      });
    }
  }, [environment]);

  const footer = useMemo(() => {
    return (
      <Group justify="flex-end" flex={1} p="md">
        <Button variant="default" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="filled"
          disabled={loading || memberIdError !== null || (isEnsName && isResolvingEns)}
          loading={loading}
          onClick={() => void handleCreate()}>
          Create
        </Button>
      </Group>
    );
  }, [handleClose, handleCreate, loading, memberIdError, isEnsName, isResolvingEns]);

  if (initializing || !client) {
    return (
      <Modal
        title="New Message"
        opened={true}
        onClose={() => navigate("/")}
        fullScreen={fullScreen}
      >
        <ContentLayout
          maxHeight={contentHeight}
          withScrollAreaPadding={false}
        >
          <Stack gap="md">
            <Title order={3}>Loading...</Title>
            <TextInput
              placeholder={initializing ? "Initializing XMTP client..." : "Waiting for XMTP client to initialize..."}
              disabled={true}
            />
          </Stack>
        </ContentLayout>
      </Modal>
    );
  }

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
          <Stack gap="md">
            <Box>
              <Title order={5} mb="xs">Search Universal Profiles</Title>
              <ProfileSearch onSelectAddress={handleSelectAddress} />
            </Box>
            
            {selectedProfileAddress && (
              <>
                <LuksoProfile 
                  address={selectedProfileAddress} 
                  onXmtpAddressFound={handleXmtpAddressFound} 
                />
                {xmtpAddressFromUP && (
                  <Box py="xs">
                    <Text size="sm" fw={500}>
                      Found XMTP address in Universal Profile: {xmtpAddressFromUP}
                    </Text>
                    <Text size="xs" c="dimmed">
                      This address will be used to create the conversation.
                    </Text>
                  </Box>
                )}
              </>
            )}
            
            <Divider label="Or enter address manually" labelPosition="center" />
            
            <TextInput
              size="sm"
              label="Address or inbox ID"
              description={whiskIdentity?.name || (isEnsName ? (isResolvingEns ? "Resolving ENS..." : ensAddress ? `Resolved to: ${ensAddress}` : "") : "")}
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
