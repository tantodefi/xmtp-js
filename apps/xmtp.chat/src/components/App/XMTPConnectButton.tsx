import { Button, Group, Image, Text } from "@mantine/core";

export function XMTPConnectButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      fullWidth
      size="md"
      leftSection={
        <Group gap={8}>
          <Image src="/xmtp-icon.png" alt="XMTP Logo" width={24} height={24} />
        </Group>
      }
      onClick={onClick}
      disabled={disabled}
      style={{ fontWeight: 600, fontSize: 18 }}
      color="dark"
      radius="md"
      variant="filled"
    >
      Connect to XMTP
    </Button>
  );
}
