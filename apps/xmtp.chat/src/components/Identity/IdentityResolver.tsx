import { useCallback, useState } from 'react';
import { Box, Text, Group, Image, Button } from '@mantine/core';
import { useName, useAvatar, useProfile } from '@paperclip-labs/whisk-sdk/identity';
import { IdentityResolver as WhiskIdentityResolver } from '@paperclip-labs/whisk-sdk/identity';
import makeBlockie from 'ethereum-blockies-base64';

type IdentityResolverProps = {
  address: string;
  onSelectAddress: (address: string) => void;
};

export function IdentityResolver({ address, onSelectAddress }: IdentityResolverProps) {
  const [selectedResolver, setSelectedResolver] = useState<WhiskIdentityResolver | null>(null);
  
  // Try ENS first
  const { data: ensName, isLoading: ensLoading } = useName({ 
    address, 
    resolverOrder: [WhiskIdentityResolver.Ens] 
  });
  
  // Try Lens next
  const { data: lensName, isLoading: lensLoading } = useName({ 
    address, 
    resolverOrder: [WhiskIdentityResolver.Lens] 
  });
  
  // Try Farcaster
  const { data: farcasterName, isLoading: farcasterLoading } = useName({ 
    address, 
    resolverOrder: [WhiskIdentityResolver.Farcaster] 
  });
  
  // Try Base
  const { data: baseName, isLoading: baseLoading } = useName({ 
    address, 
    resolverOrder: [WhiskIdentityResolver.Base] 
  });
  
  // Try NNS
  const { data: nnsName, isLoading: nnsLoading } = useName({ 
    address, 
    resolverOrder: [WhiskIdentityResolver.Nns] 
  });
  
  // Try Uni
  const { data: uniName, isLoading: uniLoading } = useName({ 
    address, 
    resolverOrder: [WhiskIdentityResolver.Uni] 
  });
  
  // Try World
  const { data: worldName, isLoading: worldLoading } = useName({ 
    address, 
    resolverOrder: [WhiskIdentityResolver.World] 
  });

  // Get avatar for selected resolver
  const { data: avatarUrl } = useAvatar({ 
    address, 
    resolverOrder: selectedResolver ? [selectedResolver] : undefined 
  });

  const handleSelectResolver = useCallback((resolver: WhiskIdentityResolver) => {
    setSelectedResolver(resolver);
    onSelectAddress(address);
  }, [address, onSelectAddress]);

  const isLoading = ensLoading || lensLoading || farcasterLoading || 
    baseLoading || nnsLoading || uniLoading || worldLoading;

  if (isLoading) {
    return (
      <Box p="md">
        <Text>Loading identities...</Text>
      </Box>
    );
  }

  const hasAnyIdentity = ensName || lensName || farcasterName || 
    baseName || nnsName || uniName || worldName;

  if (!hasAnyIdentity) {
    return null;
  }

  return (
    <Box p="md">
      <Group gap="xs" mb="md">
        {ensName && (
          <Button
            size="xs"
            variant={selectedResolver === WhiskIdentityResolver.Ens ? "filled" : "light"}
            onClick={() => handleSelectResolver(WhiskIdentityResolver.Ens)}
          >
            ENS: {ensName}
          </Button>
        )}
        {lensName && (
          <Button
            size="xs"
            variant={selectedResolver === WhiskIdentityResolver.Lens ? "filled" : "light"}
            onClick={() => handleSelectResolver(WhiskIdentityResolver.Lens)}
          >
            Lens: {lensName}
          </Button>
        )}
        {farcasterName && (
          <Button
            size="xs"
            variant={selectedResolver === WhiskIdentityResolver.Farcaster ? "filled" : "light"}
            onClick={() => handleSelectResolver(WhiskIdentityResolver.Farcaster)}
          >
            Farcaster: {farcasterName}
          </Button>
        )}
        {baseName && (
          <Button
            size="xs"
            variant={selectedResolver === WhiskIdentityResolver.Base ? "filled" : "light"}
            onClick={() => handleSelectResolver(WhiskIdentityResolver.Base)}
          >
            Base: {baseName}
          </Button>
        )}
        {nnsName && (
          <Button
            size="xs"
            variant={selectedResolver === WhiskIdentityResolver.Nns ? "filled" : "light"}
            onClick={() => handleSelectResolver(WhiskIdentityResolver.Nns)}
          >
            NNS: {nnsName}
          </Button>
        )}
        {uniName && (
          <Button
            size="xs"
            variant={selectedResolver === WhiskIdentityResolver.Uni ? "filled" : "light"}
            onClick={() => handleSelectResolver(WhiskIdentityResolver.Uni)}
          >
            Uni: {uniName}
          </Button>
        )}
        {worldName && (
          <Button
            size="xs"
            variant={selectedResolver === WhiskIdentityResolver.World ? "filled" : "light"}
            onClick={() => handleSelectResolver(WhiskIdentityResolver.World)}
          >
            World: {worldName}
          </Button>
        )}
      </Group>
      
      {selectedResolver && avatarUrl && (
        <Group>
          <Image
            src={avatarUrl}
            alt={`${selectedResolver} avatar`}
            width={40}
            height={40}
            radius="xl"
            onError={(e: any) => {
              e.currentTarget.src = makeBlockie(address);
            }}
          />
          <Text>
            {selectedResolver} identity found for {address}
          </Text>
        </Group>
      )}
    </Box>
  );
} 