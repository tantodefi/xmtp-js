/**
 * LuksoProfile Component
 * 
 * A component to display a Lukso profile with image and details.
 * This is a simplified version adapted for the XMTP chat application.
 */
import { useEffect, useState } from 'react';
import { Box, Text, Card, Image } from '@mantine/core';
import makeBlockie from 'ethereum-blockies-base64';

const DEFAULT_ADDRESS = '0x0000000000000000000000000000000000000000';
const RPC_ENDPOINT = 'https://rpc.lukso.gateway.fm/';

type ProfileProps = {
  address?: string;
};

type ProfileData = {
  fullName: string;
  imgUrl: string;
  background: string;
  profileAddress: string;
  isLoading: boolean;
};

export function LuksoProfile({ address = DEFAULT_ADDRESS }: ProfileProps) {
  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: 'Loading...',
    imgUrl: '',
    background: '',
    profileAddress: address || DEFAULT_ADDRESS,
    isLoading: true,
  });

  useEffect(() => {
    async function fetchProfileImage() {
      try {
        setProfileData(prev => ({
          ...prev,
          profileAddress: address || DEFAULT_ADDRESS,
          imgUrl: makeBlockie(address || DEFAULT_ADDRESS),
          isLoading: false,
        }));
        
        // In a full implementation, you would fetch profile data from the Lukso network here
        
      } catch (error: any) {
        console.error('Error fetching profile:', error);
        setProfileData(prev => ({
          ...prev,
          fullName: 'Error loading profile',
          profileAddress: address || DEFAULT_ADDRESS,
          isLoading: false,
        }));
      }
    }

    fetchProfileImage();
  }, [address]);

  return (
    <Card shadow="sm" padding="md" radius="md" mb="md">
      <Card.Section>
        <Box 
          style={{ 
            height: 80, 
            backgroundColor: '#4B5563',
            backgroundImage: profileData.background ? `url(${profileData.background})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }} 
        />
      </Card.Section>
      
      <Box style={{ display: 'flex', marginTop: -30, padding: '0 16px' }}>
        <Image
          src={profileData.imgUrl}
          alt="Profile"
          width={60}
          height={60}
          radius="xl"
          style={{ border: '3px solid white' }}
        />
        <Box ml="md" mt={30}>
          <Text fw={600} size="md">{profileData.fullName}</Text>
          <Text size="xs" color="dimmed" style={{ wordBreak: 'break-all' }}>
            {profileData.profileAddress}
          </Text>
        </Box>
      </Box>
    </Card>
  );
} 