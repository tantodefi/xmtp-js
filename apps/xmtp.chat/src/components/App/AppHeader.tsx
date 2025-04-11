import { Badge, Box, Burger, Button, Flex, Group, Text, Image } from "@mantine/core";
import type { Client } from "@xmtp/browser-sdk";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ERC725, ERC725JSONSchema } from "@erc725/erc725.js";
import makeBlockie from "ethereum-blockies-base64";
import { AppMenu } from "@/components/App/AppMenu";
import { shortAddress } from "@/helpers/strings";
import { useSettings } from "@/hooks/useSettings";
import classes from "./AppHeader.module.css";

// LSP schemas required for fetching UP data
const LSPSchemas: ERC725JSONSchema[] = [
  {
    name: "LSP3Profile",
    key: "0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5",
    keyType: "Singleton",
    valueContent: "VerifiableURI",
    valueType: "bytes",
  }
];

// RPC endpoint for LUKSO mainnet
const RPC_ENDPOINT = "https://rpc.mainnet.lukso.network";

// Helper function to process profile data from ERC725 result
const processProfileData = async (data: any) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.log('No valid data to process');
    return null;
  }
  
  // Find the LSP3Profile in the array
  const profileDataItem = data.find(item => item.name === 'LSP3Profile');
  if (!profileDataItem || !profileDataItem.value) {
    console.log('No LSP3Profile found in data');
    return null;
  }
  
  // The profile data might be in the VerifiableURI format
  const profileData = profileDataItem.value;
  console.log('Raw profile data:', profileData);
  
  // If it's a VerifiableURI format with an IPFS URL, we need to fetch the actual data
  if (profileData.url && profileData.url.startsWith('ipfs://')) {
    try {
      console.log('Detected IPFS URL, fetching content:', profileData.url);
      const ipfsUrl = `https://api.universalprofile.cloud/ipfs/${profileData.url.slice(7)}`;
      console.log('Fetching from:', ipfsUrl);
      
      const response = await fetch(ipfsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch IPFS data: ${response.status}`);
      }
      
      const ipfsData = await response.json();
      console.log('IPFS profile data:', ipfsData);
      
      let name = '';
      let avatarUrl = '';
      
      // Extract profile name
      if (ipfsData.name) {
        name = ipfsData.name;
      } else if (ipfsData.LSP3Profile && ipfsData.LSP3Profile.name) {
        name = ipfsData.LSP3Profile.name;
      } else if (ipfsData.profileName) {
        name = ipfsData.profileName;
      }
      
      // Extract profile image
      if (ipfsData.profileImage && ipfsData.profileImage.length > 0) {
        const profileImage = ipfsData.profileImage[0];
        
        // Handle different image URL structures
        if (profileImage.url) {
          // Handle IPFS URLs
          avatarUrl = profileImage.url.startsWith('ipfs://')
            ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
            : profileImage.url;
        } else if (profileImage.verification && profileImage.verification.url) {
          // For VerifiableURI format
          avatarUrl = profileImage.verification.url.startsWith('ipfs://')
            ? `https://api.universalprofile.cloud/ipfs/${profileImage.verification.url.slice(7)}`
            : profileImage.verification.url;
        }
      } else if (ipfsData.LSP3Profile && ipfsData.LSP3Profile.profileImage && ipfsData.LSP3Profile.profileImage.length > 0) {
        const profileImage = ipfsData.LSP3Profile.profileImage[0];
        
        if (profileImage.url) {
          avatarUrl = profileImage.url.startsWith('ipfs://')
            ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
            : profileImage.url;
        }
      }
      
      console.log('Profile data from IPFS:', { name, avatarUrl });
      return { name, avatarUrl };
    } catch (error) {
      console.error('Error fetching IPFS data:', error);
      // Continue with the existing fallback approach
    }
  }
  
  // Original approach as fallback
  let name = '';
  let avatarUrl = '';
  
  // Get profile name
  if (profileData.name) {
    name = profileData.name;
  } else if (profileData.profileName) {
    name = profileData.profileName;
  }
  
  // Get profile image
  if (profileData.profileImage && profileData.profileImage.length > 0) {
    const profileImage = profileData.profileImage[0];
    
    // Handle different image URL structures
    if (profileImage.url) {
      // Handle IPFS URLs
      avatarUrl = profileImage.url.startsWith('ipfs://')
        ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
        : profileImage.url;
    } else if (profileImage.verification && profileImage.verification.url) {
      // For VerifiableURI format
      avatarUrl = profileImage.verification.url.startsWith('ipfs://')
        ? `https://api.universalprofile.cloud/ipfs/${profileImage.verification.url.slice(7)}`
        : profileImage.verification.url;
    }
  }
  
  console.log('Profile data processed with original approach:', { name, avatarUrl });
  return { name, avatarUrl };
};

// Find the original UP address from localStorage
const findOriginalUpAddress = (): string | null => {
  try {
    // The pattern used in Connect.tsx is 'lukso_ephemeral_key_{address}'
    const KEY_PREFIX = 'lukso_ephemeral_key_';
    
    // Scan all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) {
        // Extract the address part from the key
        const upAddress = key.substring(KEY_PREFIX.length);
        return upAddress;
      }
    }
    
    // Check if there's a specific key for the UP address
    const upAddress = localStorage.getItem('lukso_up_address');
    if (upAddress) {
      return upAddress;
    }
    
    return null;
  } catch (error) {
    console.error("Error accessing localStorage:", error);
    return null;
  }
};

// Safe function to get context accounts from LUKSO UP Provider
const safeGetContextAccounts = async (): Promise<string | null> => {
  try {
    // Check if window.lukso exists and has the required methods
    if (typeof window !== 'undefined' && 
        window.lukso && 
        typeof window.lukso.request === 'function') {
      
      // Try to get contextAccounts first
      if (window.lukso.contextAccounts && 
          Array.isArray(window.lukso.contextAccounts) && 
          window.lukso.contextAccounts.length > 0) {
        return window.lukso.contextAccounts[0].toLowerCase();
      }
      
      // Otherwise try the up_contextAccounts RPC method
      try {
        const contextAccounts = await window.lukso.request({
          method: 'up_contextAccounts',
          params: []
        });
        
        if (Array.isArray(contextAccounts) && contextAccounts.length > 0) {
          return contextAccounts[0].toLowerCase();
        }
      } catch (innerError) {
        console.log("Error calling up_contextAccounts, falling back to eth_accounts");
      }
      
      // Fall back to eth_accounts as last resort
      const accounts = await window.lukso.request({ 
        method: 'eth_accounts' 
      });
      
      if (Array.isArray(accounts) && accounts.length > 0) {
        return accounts[0].toLowerCase();
      }
    }
    return null;
  } catch (error) {
    console.error("Error safely accessing LUKSO provider:", error);
    return null;
  }
};

// Direct fetch approach as fallback
const fetchUpDataDirectly = async (address: string) => {
  try {
    console.log('Attempting direct RPC fetch for UP profile data');
    
    // LSP3 profile data key
    const lsp3ProfileKey = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5';
    
    // Build the RPC request
    const rpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [
        {
          to: address,
          data: `0x4c7ace41${lsp3ProfileKey.substring(2)}` // getData(bytes32) function selector + key
        },
        'latest'
      ]
    };
    
    // Make the request
    const response = await fetch(RPC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcRequest),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Direct RPC call response:', result);
    
    if (result.error) {
      throw new Error(`RPC error: ${result.error.message}`);
    }
    
    // Process the encoded data - this is simplified and works for basic cases
    if (result.result && result.result.startsWith('0x')) {
      // First check if it's IPFS
      const hexData = result.result.substring(2);
      if (hexData.length > 0) {
        try {
          // Check if the data points to IPFS
          const ipfsPrefix = Buffer.from('ipfs://', 'utf8').toString('hex');
          if (hexData.includes(ipfsPrefix)) {
            const hexStr = hexData.substring(hexData.indexOf(ipfsPrefix));
            let endIdx = hexStr.indexOf('00');
            if (endIdx === -1) endIdx = hexStr.length;
            
            const ipfsPath = Buffer.from(hexStr.substring(0, endIdx), 'hex').toString('utf8');
            console.log('Found IPFS path:', ipfsPath);
            
            if (ipfsPath.startsWith('ipfs://')) {
              const cid = ipfsPath.substring(7);
              const ipfsUrl = `https://api.universalprofile.cloud/ipfs/${cid}`;
              
              console.log('Fetching from IPFS URL:', ipfsUrl);
              const ipfsResponse = await fetch(ipfsUrl);
              if (ipfsResponse.ok) {
                const profileData = await ipfsResponse.json();
                console.log('IPFS profile data:', profileData);
                return profileData;
              }
            }
          }
        } catch (err) {
          console.error('Error processing IPFS path:', err);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in direct fetch:', error);
    return null;
  }
};

const GlowingCircle = () => {
  return (
    <Box
      w={6}
      h={6}
      bg="green.6"
      style={{
        borderRadius: "50%",
        boxShadow: "0px 0px 2px 2px var(--mantine-color-green-9)",
      }}
    />
  );
};

export type AppHeaderProps = {
  client: Client;
  opened?: boolean;
  toggle?: () => void;
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  client,
  opened,
  toggle,
}) => {
  const navigate = useNavigate();
  const { environment } = useSettings();
  const [accountIdentifier, setAccountIdentifier] = useState<string | null>(
    null,
  );
  const [upAddress, setUpAddress] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    setAccountIdentifier(
      client.accountIdentifier?.identifier.toLowerCase() ?? null,
    );
  }, [client.accountIdentifier]);

  // Try to get the original UP address from localStorage first, then fall back to provider methods
  useEffect(() => {
    const getUpAddress = async () => {
      // First try to get the address from localStorage (most reliable for getting original UP)
      const storedUpAddress = findOriginalUpAddress();
      if (storedUpAddress) {
        setUpAddress(storedUpAddress);
        
        // Set a default blockie avatar while we fetch the real profile
        setAvatarUrl(makeBlockie(storedUpAddress));
        
        // Try to fetch profile data using ERC725.js
        try {
          console.log('Creating ERC725 instance for address:', storedUpAddress);
          
          const options = {
            ipfsGateway: 'https://api.universalprofile.cloud/ipfs/',
            ipfsGatewayAuthHeader: {
              // Leave empty, but may be needed for some gateways
            }
          };
          
          const erc725 = new ERC725(
            LSPSchemas,
            storedUpAddress, 
            RPC_ENDPOINT,
            options
          );
          
          console.log('Fetching profile data...');
          const profileData = await erc725.getData();
          console.log('Profile data from ERC725:', profileData);
          
          const processedData = await processProfileData(profileData);
          
          if (processedData) {
            if (processedData.name) {
              console.log('Setting profile name:', processedData.name);
              setProfileName(processedData.name);
            }
            
            if (processedData.avatarUrl) {
              console.log('Setting avatar URL:', processedData.avatarUrl);
              setAvatarUrl(processedData.avatarUrl);
            }
          } else {
            // Try direct fetch as fallback if ERC725 didn't return usable data
            console.log('ERC725 data processing failed, trying direct fetch');
            const directData = await fetchUpDataDirectly(storedUpAddress);
            if (directData) {
              console.log('Got direct data:', directData);
              
              // Extract name
              if (directData.name) {
                setProfileName(directData.name);
              } else if (directData.profileName) {
                setProfileName(directData.profileName);
              } else if (directData.LSP3Profile && directData.LSP3Profile.name) {
                setProfileName(directData.LSP3Profile.name);
              }
              
              // Extract image URL
              if (directData.profileImage && directData.profileImage.length > 0) {
                const profileImage = directData.profileImage[0];
                if (profileImage.url) {
                  const imgUrl = profileImage.url.startsWith('ipfs://')
                    ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
                    : profileImage.url;
                  
                  setAvatarUrl(imgUrl);
                }
              } else if (directData.LSP3Profile && directData.LSP3Profile.profileImage && directData.LSP3Profile.profileImage.length > 0) {
                const profileImage = directData.LSP3Profile.profileImage[0];
                if (profileImage.url) {
                  const imgUrl = profileImage.url.startsWith('ipfs://')
                    ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
                    : profileImage.url;
                  
                  setAvatarUrl(imgUrl);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching profile data:', error);
          
          // Try direct fetch if ERC725 completely failed
          console.log('ERC725 failed, trying direct fetch');
          const directData = await fetchUpDataDirectly(storedUpAddress);
          if (directData) {
            console.log('Got direct data after ERC725 failure:', directData);
            
            // Extract name
            if (directData.name) {
              setProfileName(directData.name);
            } else if (directData.profileName) {
              setProfileName(directData.profileName);
            } else if (directData.LSP3Profile && directData.LSP3Profile.name) {
              setProfileName(directData.LSP3Profile.name);
            }
            
            // Extract image URL
            if (directData.profileImage && directData.profileImage.length > 0) {
              const profileImage = directData.profileImage[0];
              if (profileImage.url) {
                const imgUrl = profileImage.url.startsWith('ipfs://')
                  ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
                  : profileImage.url;
                
                setAvatarUrl(imgUrl);
              }
            } else if (directData.LSP3Profile && directData.LSP3Profile.profileImage && directData.LSP3Profile.profileImage.length > 0) {
              const profileImage = directData.LSP3Profile.profileImage[0];
              if (profileImage.url) {
                const imgUrl = profileImage.url.startsWith('ipfs://')
                  ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
                  : profileImage.url;
                
                setAvatarUrl(imgUrl);
              }
            }
          }
          
          // Keep using the blockie as fallback
        }
        
        return;
      }
      
      // If not found in localStorage, try provider methods
      const providerAddress = await safeGetContextAccounts();
      if (providerAddress) {
        setUpAddress(providerAddress);
        setAvatarUrl(makeBlockie(providerAddress));
        
        // Try to fetch profile data using ERC725.js
        try {
          console.log('Creating ERC725 instance for provider address:', providerAddress);
          
          const options = {
            ipfsGateway: 'https://api.universalprofile.cloud/ipfs/',
            ipfsGatewayAuthHeader: {
              // Leave empty, but may be needed for some gateways
            }
          };
          
          const erc725 = new ERC725(
            LSPSchemas,
            providerAddress, 
            RPC_ENDPOINT,
            options
          );
          
          console.log('Fetching profile data from provider address...');
          const profileData = await erc725.getData();
          console.log('Profile data from provider address:', profileData);
          
          const processedData = await processProfileData(profileData);
          
          if (processedData) {
            if (processedData.name) {
              console.log('Setting profile name from provider:', processedData.name);
              setProfileName(processedData.name);
            }
            
            if (processedData.avatarUrl) {
              console.log('Setting avatar URL from provider:', processedData.avatarUrl);
              setAvatarUrl(processedData.avatarUrl);
            }
          } else {
            // Try direct fetch as fallback if ERC725 didn't return usable data
            console.log('ERC725 data processing failed for provider, trying direct fetch');
            const directData = await fetchUpDataDirectly(providerAddress);
            if (directData) {
              console.log('Got direct data from provider:', directData);
              
              // Extract name
              if (directData.name) {
                setProfileName(directData.name);
              } else if (directData.profileName) {
                setProfileName(directData.profileName);
              } else if (directData.LSP3Profile && directData.LSP3Profile.name) {
                setProfileName(directData.LSP3Profile.name);
              }
              
              // Extract image URL
              if (directData.profileImage && directData.profileImage.length > 0) {
                const profileImage = directData.profileImage[0];
                if (profileImage.url) {
                  const imgUrl = profileImage.url.startsWith('ipfs://')
                    ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
                    : profileImage.url;
                  
                  setAvatarUrl(imgUrl);
                }
              } else if (directData.LSP3Profile && directData.LSP3Profile.profileImage && directData.LSP3Profile.profileImage.length > 0) {
                const profileImage = directData.LSP3Profile.profileImage[0];
                if (profileImage.url) {
                  const imgUrl = profileImage.url.startsWith('ipfs://')
                    ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
                    : profileImage.url;
                  
                  setAvatarUrl(imgUrl);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching profile data from provider address:', error);
          
          // Try direct fetch if ERC725 completely failed
          console.log('ERC725 failed for provider, trying direct fetch');
          const directData = await fetchUpDataDirectly(providerAddress);
          if (directData) {
            console.log('Got direct data after ERC725 failure from provider:', directData);
            
            // Extract name
            if (directData.name) {
              setProfileName(directData.name);
            } else if (directData.profileName) {
              setProfileName(directData.profileName);
            } else if (directData.LSP3Profile && directData.LSP3Profile.name) {
              setProfileName(directData.LSP3Profile.name);
            }
            
            // Extract image URL
            if (directData.profileImage && directData.profileImage.length > 0) {
              const profileImage = directData.profileImage[0];
              if (profileImage.url) {
                const imgUrl = profileImage.url.startsWith('ipfs://')
                  ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
                  : profileImage.url;
                
                setAvatarUrl(imgUrl);
              }
            } else if (directData.LSP3Profile && directData.LSP3Profile.profileImage && directData.LSP3Profile.profileImage.length > 0) {
              const profileImage = directData.LSP3Profile.profileImage[0];
              if (profileImage.url) {
                const imgUrl = profileImage.url.startsWith('ipfs://')
                  ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
                  : profileImage.url;
                
                setAvatarUrl(imgUrl);
              }
            }
          }
          
          // Keep using the blockie as fallback
        }
      } else if (accountIdentifier) {
        // If we can't get the UP address, use the accountIdentifier as fallback
        setAvatarUrl(makeBlockie(accountIdentifier));
      }
    };
    
    getUpAddress().catch(console.error);
  }, [accountIdentifier]);

  const handleClick = () => {
    void navigate("identity");
  };

  return (
    <Flex align="center" justify="space-between">
      <Flex align="center" gap="md" className={classes.header}>
        <div className={classes.burger}>
          <Burger opened={opened} onClick={toggle} size="sm" />
        </div>
        <Flex align="center" flex={1}>
          <Button
            variant="default"
            aria-label={upAddress || accountIdentifier || ""}
            className={classes.button}
            onClick={handleClick}>
            {avatarUrl && (
              <Image
                src={avatarUrl}
                alt="Profile"
                width={24}
                height={24}
                radius="xl"
                mr="xs"
                onError={(e: any) => {
                  console.error('Avatar image failed to load:', e.target.src);
                  // Fallback to blockie if image fails to load
                  const address = upAddress || accountIdentifier;
                  if (address) {
                    e.currentTarget.src = makeBlockie(address);
                  }
                }}
              />
            )}
            {profileName 
              ? <Text truncate maw={100}>{profileName}</Text>
              : upAddress 
                ? shortAddress(upAddress) 
                : accountIdentifier 
                  ? shortAddress(accountIdentifier) 
                  : "..."}
          </Button>
        </Flex>
      </Flex>
      <Group align="center" gap="xs">
        <Badge size="xl" radius="md" variant="default" p={0}>
          <Group align="center" gap="xs" px="sm">
            <GlowingCircle />
            <Text size="xs" fw={700}>
              {environment}
            </Text>
          </Group>
        </Badge>
        <AppMenu />
      </Group>
    </Flex>
  );
};
