/**
 * LuksoProfile Component
 * 
 * A component to display a Lukso profile with image and details.
 * This is a simplified version adapted for the XMTP chat application.
 */
import { useCallback, useEffect, useState } from 'react';
import { Box, Text, Card, Image, Loader, Badge } from '@mantine/core';
import makeBlockie from 'ethereum-blockies-base64';
import { ethers } from 'ethers';
import { UniversalProfileArtifact } from '@/artifacts/UniversalProfile';
import { ERC725 } from '@erc725/erc725.js';

const DEFAULT_ADDRESS = '0x0000000000000000000000000000000000000000';
// Update RPC endpoints with more reliable ones
const RPC_ENDPOINT = 'https://rpc.mainnet.lukso.network/';
// Key hash for XMTP metadata in UP
const XMTP_KEY = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5';

// Updated backup endpoints with more reliable LUKSO RPC endpoints
const BACKUP_RPC_ENDPOINTS = [
  'https://rpc.mainnet.lukso.network/',
  'https://lukso-mainnet.rpc.thirdweb.com/',
  'https://lukso.drpc.org',
  'https://lukso-mainnet.public.blastapi.io',
  'https://public-rpc.lukso.network/'
];

// Timeout for RPC requests
const RPC_TIMEOUT = 5000; // 5 seconds

// Helper function to timeout a promise
const withTimeout = function <T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>(function (_, reject) {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]);
};

type ProfileProps = {
  address?: string;
  onXmtpAddressFound?: (xmtpAddress: string) => void;
  currentXmtpAddress?: string;  // Add prop for current XMTP address to compare
};

type ProfileData = {
  fullName: string;
  imgUrl: string;
  background: string;
  profileAddress: string;
  isLoading: boolean;
  xmtpAddress?: string | null;
};

export function LuksoProfile({ address = DEFAULT_ADDRESS, onXmtpAddressFound, currentXmtpAddress }: ProfileProps) {
  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: 'Loading...',
    imgUrl: '',
    background: '',
    profileAddress: address || DEFAULT_ADDRESS,
    isLoading: true,
    xmtpAddress: null
  });

  useEffect(() => {
    // Flag to prevent multiple retries when network is unreachable
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    // Move checkXmtpAddress inside useEffect to avoid dependency cycles
    async function checkXmtpAddress(upAddress: string) {
      if (!isMounted) return null;
      try {
        console.log('Checking for XMTP address in UP:', upAddress);

        // Try to find a working RPC endpoint
        let provider;
        let connected = false;

        // Try endpoints until one works
        for (const endpoint of [RPC_ENDPOINT, ...BACKUP_RPC_ENDPOINTS]) {
          if (!isMounted) return null;
          try {
            provider = new ethers.JsonRpcProvider(endpoint);
            // Add timeout to prevent hanging on DNS resolution
            await withTimeout(provider.getNetwork(), RPC_TIMEOUT);
            connected = true;
            console.log('Connected to RPC endpoint:', endpoint);
            break;
          } catch (endpointError: unknown) {
            const error = endpointError as Error;
            console.warn(`RPC endpoint ${endpoint} failed:`, error.message);
          }
        }

        if (!connected || !provider) {
          console.error('All RPC endpoints failed, cannot check XMTP address');
          throw new Error('Network unavailable');
        }

        const universalProfile = new ethers.Contract(
          upAddress,
          UniversalProfileArtifact.abi,
          provider
        );

        // Try to read the XMTP metadata with timeout
        const existingData = await withTimeout(universalProfile.getData(XMTP_KEY), RPC_TIMEOUT);
        console.log('UP XMTP data:', existingData);

        if (existingData && existingData !== '0x') {
          try {
            // First, try to handle as JSON string (standard format)
            try {
              const decodedData = ethers.toUtf8String(existingData);
              const metadata = JSON.parse(decodedData);

              // Check for direct address field first (current format)
              if (metadata.address) {
                console.log('Found XMTP address in UP metadata:', metadata.address);

                // Update the profile data with the XMTP address
                if (isMounted) {
                  setProfileData(prev => ({
                    ...prev,
                    xmtpAddress: metadata.address
                  }));

                  // Notify parent component
                  if (onXmtpAddressFound) {
                    onXmtpAddressFound(metadata.address);
                  }
                }

                return metadata.address;
              }
              // Fallback to the nested xmtp.address format (in case that format is used)
              else if (metadata.xmtp?.address) {
                console.log('Found XMTP address in UP metadata (nested format):', metadata.xmtp.address);

                // Update the profile data with the XMTP address
                if (isMounted) {
                  setProfileData(prev => ({
                    ...prev,
                    xmtpAddress: metadata.xmtp.address
                  }));

                  // Notify parent component
                  if (onXmtpAddressFound) {
                    onXmtpAddressFound(metadata.xmtp.address);
                  }
                }

                return metadata.xmtp.address;
              }
            } catch (jsonError) {
              console.log('LSP data is not in JSON format, trying alternative extraction methods');
            }

            // LSP data might be directly an Ethereum address encoded in bytes
            // Check if LSP data matches pattern of LUKSO LSP0 metadata format
            // LUKSO Universal Profile often stores data in ERC725Y format:
            // - First 2 bytes might be a version/type flag (0x0000)
            // - Next 10 bytes can be a key metadata
            // - Then 20 bytes might be an address or other data
            if (existingData && existingData.length >= 42) {
              console.log('Parsing raw LSP metadata:', existingData);

              // First, try looking for direct address pattern
              // Check if this looks like an ETH address after removing leading zeros after 0x
              const possibleAddress = existingData.replace(/^0x0+/, '0x');
              if (/^0x[0-9a-fA-F]{40}$/.test(possibleAddress)) {
                console.log('Found XMTP address in UP metadata as direct hex:', possibleAddress);

                // Process the address
                const normalizedAddress = possibleAddress.toLowerCase();
                if (isMounted) {
                  setProfileData(prev => ({
                    ...prev,
                    xmtpAddress: normalizedAddress
                  }));

                  if (onXmtpAddressFound) {
                    onXmtpAddressFound(normalizedAddress);
                  }
                }
                return normalizedAddress;
              }

              // Next, try to extract from a more complex format
              // Look for ETH address pattern in the raw data (20 bytes = 40 hex chars)
              const hexData = existingData.slice(2); // Remove 0x prefix

              // If we follow the format of LSP0 data:
              // Try to extract potential address parts with offsets
              // Skip variant byte offsets to try to locate an ETH address
              const potentialOffsets = [0, 2, 4, 8, 12, 16, 24, 32];

              for (const offset of potentialOffsets) {
                if (offset + 40 <= hexData.length) {
                  const candidateAddrHex = hexData.substring(offset, offset + 40);
                  const candidateAddr = '0x' + candidateAddrHex;

                  // Basic validation - check if it's a valid hex string that looks like an address
                  if (/^0x[0-9a-fA-F]{40}$/.test(candidateAddr)) {
                    console.log(`Found potential ETH address at offset ${offset} in UP XMTP data:`, candidateAddr);

                    // Normalize the address
                    const normalizedAddr = candidateAddr.toLowerCase();

                    if (isMounted) {
                      setProfileData(prev => ({
                        ...prev,
                        xmtpAddress: normalizedAddr
                      }));

                      if (onXmtpAddressFound) {
                        onXmtpAddressFound(normalizedAddr);
                      }
                    }

                    return normalizedAddr;
                  }
                }
              }

              // Attempt to look for IPFS hashes or other content identifiers in the data
              // They might contain the actual XMTP data
              try {
                // Use detailed logging to help debug
                console.log('Searching for content identifiers in UP data...');

                // Look for IPFS hash pattern in hex data (CID prefix for IPFS)
                const ipfsMarkers = ['ipfs', 'Qm', 'baf'];
                let foundIPFS = false;

                // Convert to text to look for markers
                const textData = Buffer.from(hexData, 'hex').toString();

                // Log the text representation
                console.log('UP data as text:', textData);

                // Check for any IPFS markers
                for (const marker of ipfsMarkers) {
                  if (textData.includes(marker)) {
                    console.log(`Found potential IPFS marker '${marker}' in UP data`);
                    foundIPFS = true;
                  }
                }

                if (foundIPFS) {
                  console.log('UP data may contain IPFS reference that needs to be resolved');
                  // Note: We could add IPFS resolution here if needed
                }
              } catch (textError) {
                console.log('Error processing UP data as text:', textError);
              }
            }

            console.log('Could not extract XMTP address from UP data');
            return null;
          } catch (parseError) {
            console.error('Error parsing XMTP metadata:', parseError);
            return null;
          }
        } else {
          console.log('No XMTP metadata found in UP');
        }

        return null;
      } catch (error) {
        console.error('Error checking XMTP address:', error);

        // Avoid infinite retry loops
        if (retryCount < MAX_RETRIES && isMounted) {
          retryCount++;
          console.log(`Retry attempt ${retryCount} of ${MAX_RETRIES}`);
          return null;
        } else if (isMounted) {
          // Set error state after max retries
          setProfileData(prev => ({
            ...prev,
            isLoading: false,
            fullName: 'Network Error'
          }));
        }

        return null;
      }
    }

    async function fetchProfileData() {
      if (!isMounted) return;
      try {
        console.log('Fetching profile data for:', address);
        // Initially set loading state and blockie
        setProfileData(prev => ({
          ...prev,
          profileAddress: address || DEFAULT_ADDRESS,
          imgUrl: makeBlockie(address || DEFAULT_ADDRESS),
          isLoading: true,
        }));

        // Find a working RPC endpoint for ERC725
        let workingEndpoint = RPC_ENDPOINT;
        let endpointWorks = false;

        // Try each endpoint
        for (const endpoint of [RPC_ENDPOINT, ...BACKUP_RPC_ENDPOINTS]) {
          if (!isMounted) return;
          try {
            const provider = new ethers.JsonRpcProvider(endpoint);
            await withTimeout(provider.getNetwork(), RPC_TIMEOUT);
            workingEndpoint = endpoint;
            endpointWorks = true;
            console.log('Using RPC endpoint for ERC725:', endpoint);
            break;
          } catch (endpointError: unknown) {
            const error = endpointError as Error;
            console.warn(`Failed to connect to ${endpoint}:`, error.message);
          }
        }

        if (!endpointWorks) {
          throw new Error('All RPC endpoints failed, cannot fetch profile');
        }

        // Try to fetch profile data using ERC725.js
        const options = {
          ipfsGateway: 'https://api.universalprofile.cloud/ipfs/',
        };

        try {
          const erc725 = new ERC725(
            [{
              name: 'LSP3Profile',
              key: '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5',
              keyType: 'Singleton',
              valueContent: 'VerifiableURI',
              valueType: 'bytes',
            }],
            address,
            workingEndpoint,
            options
          );

          const profileData = await withTimeout(erc725.getData().catch(err => {
            console.error('ERC725 getData error:', err);
            return null;
          }), RPC_TIMEOUT);

          if (profileData && Array.isArray(profileData) && profileData.length > 0) {
            const profileInfo = profileData[0]?.value;

            if (profileInfo &&
              typeof profileInfo === 'object' &&
              'url' in profileInfo &&
              typeof profileInfo.url === 'string' &&
              profileInfo.url.startsWith('ipfs://')) {
              const ipfsUrl = `https://api.universalprofile.cloud/ipfs/${profileInfo.url.slice(7)}`;
              const response = await fetch(ipfsUrl).catch(err => {
                console.error('IPFS fetch error:', err);
                return null;
              });

              if (response && response.ok) {
                const data = await response.json().catch(() => null);
                if (data) {
                  console.log('Profile IPFS data:', data);

                  // Extract name
                  let name = 'Unknown Profile';
                  if (data.LSP3Profile && data.LSP3Profile.name) {
                    name = data.LSP3Profile.name;
                  } else if (data.name) {
                    name = data.name;
                  }

                  // Extract image
                  let imageUrl = '';
                  if (data.LSP3Profile && data.LSP3Profile.profileImage && data.LSP3Profile.profileImage.length > 0) {
                    const profileImage = data.LSP3Profile.profileImage[0];
                    if (profileImage.url) {
                      imageUrl = profileImage.url.startsWith('ipfs://')
                        ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
                        : profileImage.url;
                    }
                  } else if (data.profileImage && data.profileImage.length > 0) {
                    const profileImage = data.profileImage[0];
                    if (profileImage.url) {
                      imageUrl = profileImage.url.startsWith('ipfs://')
                        ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
                        : profileImage.url;
                    }
                  }

                  if (isMounted) {
                    setProfileData(prev => ({
                      ...prev,
                      fullName: name,
                      imgUrl: imageUrl || prev.imgUrl,
                      isLoading: false,
                    }));
                  }
                }
              }
            }
          }
        } catch (erc725Error) {
          console.error('Error fetching ERC725 data:', erc725Error);
        }

        // Check for XMTP address in parallel
        await checkXmtpAddress(address);

        // Ensure loading is set to false even if all fetches fail
        if (isMounted) {
          setProfileData(prev => ({
            ...prev,
            isLoading: false,
          }));
        }
      } catch (error: any) {
        console.error('Error fetching profile:', error);
        if (isMounted) {
          setProfileData(prev => ({
            ...prev,
            fullName: 'Error loading profile',
            profileAddress: address || DEFAULT_ADDRESS,
            isLoading: false,
          }));
        }
      }
    }

    if (address && address !== DEFAULT_ADDRESS) {
      fetchProfileData();
    }

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [address, onXmtpAddressFound]);

  return (
    <Card shadow="sm" padding="md" radius="md" mb="md">
      <Card.Section>
        <Box
          style={{
            height: 80,
            backgroundColor: '#4B5563',
            backgroundImage: profileData.background ? `url(${profileData.background})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative'
          }}
        >
          {profileData.isLoading && (
            <Box style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}>
              <Loader size="sm" />
            </Box>
          )}
        </Box>
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
          {profileData.xmtpAddress && (
            <Badge color="blue" mt={5}>
              XMTP Address Found
            </Badge>
          )}

          {/* Add a warning message when addresses don't match */}
          {profileData.xmtpAddress && currentXmtpAddress &&
            profileData.xmtpAddress.toLowerCase() !== currentXmtpAddress.toLowerCase() && (
              <Badge color="yellow" mt={5}>
                Stored XMTP address doesn't match current address
              </Badge>
            )}
        </Box>
      </Box>
    </Card>
  );
} 
