import { Anchor, Box, Flex, Group, Image, Text } from "@mantine/core";
import xmtpLogo from "@/assets/xmtp-icon.png";

export const AppFooter: React.FC = () => {
  return (
    <Group justify="space-between" align="center" wrap="nowrap">
      <Box>
        <Anchor
          href="https://xmtp.org"
          underline="never"
          c="var(--mantine-color-text)"
          target="_blank"
          flex={0}>
          <Flex align="center" py="md" display="inline-flex">
            <Image src={xmtpLogo} alt="XMTP" w="24px" h="24px" fit="contain" />
            <Text size="xl" fw={700} ml="xs">
              XMTP
            </Text>
          </Flex>
        </Anchor>
      </Box>
      <Box>
        <Anchor
          href="https://lukso.network"
          underline="never"
          c="var(--mantine-color-text)"
          target="_blank"
          flex={0}>
          <Flex align="center" py="md" display="inline-flex">
            <Image 
              src="https://cdn.prod.website-files.com/672bdc274def2fecc6bbcf43/672bdc274def2fecc6bbcf9c_Group%201000001677.svg" 
              alt="LUKSO" 
              fit="contain" 
            />
         
          </Flex>
        </Anchor>
      </Box>
    </Group>
  );
};
