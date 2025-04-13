import { useState, useEffect, useCallback } from 'react';
import { useWhiskSdkContext } from '@paperclip-labs/whisk-sdk';

// This type mirrors what we expect from the Whisk SDK
type WhiskIdentity = {
  name?: string;
  avatar?: string;
  address: string;
};

// Type for the GraphQL response
type ResolveIdentityResponse = {
  identity: {
    name?: string;
    avatar?: string;
  } | null;
};

// RPC endpoint for LUKSO mainnet - reuse existing constants if available
const RPC_ENDPOINT = "https://rpc.mainnet.lukso.network";

// Ethereum mainnet RPC for ENS resolution
const ETH_RPC_ENDPOINT = "https://eth-mainnet.g.alchemy.com/v2/demo"; // Using Alchemy's public endpoint

// ENS Reverse Records contract address (updated)
const ENS_REVERSE_RECORDS = "0x3671aE578E63FdF66ad4F3E12CC0c0d71Ac7510C";

// Cache results to avoid unnecessary network requests
const identityCache = new Map<string, WhiskIdentity>();

/**
 * Hook for resolving blockchain addresses to human-readable names
 * Tries ENS (.eth) resolution, Universal Profile data, then falls back to Whisk SDK
 * 
 * @param address The blockchain address to resolve
 * @returns The resolved identity information, loading state, and error
 */
export const useWhiskIdentity = (address: string | null) => {
  // Add debug log
  console.log('useWhiskIdentity called with address:', address);
  
  const [identity, setIdentity] = useState<WhiskIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Use the Whisk SDK context
  const { whiskClient } = useWhiskSdkContext();

  // Helper function to shorten addresses for display
  const shortenAddress = useCallback((addr: string): string => {
    if (!addr || addr.length < 10) return addr || "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  }, []);

  // Normalize Ethereum addresses
  const normalizeAddress = useCallback((addr: string): string => {
    if (!addr) return "";
    
    // Clean up the address - remove any URL prefixes or suffixes
    let cleaned = addr;
    
    // If it contains a 0x Ethereum address, extract it
    const addressMatch = addr.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      cleaned = addressMatch[0];
    }
    // If it's a valid-looking address but not exactly 42 chars
    else if (addr.startsWith('0x') && addr.length >= 8) {
      // Just use it as is, but log a warning
      cleaned = addr;
      console.warn('Using non-standard Ethereum address:', addr);
    }
    
    // Convert to lowercase for consistency
    return cleaned.toLowerCase();
  }, []);

  // Try to resolve ENS name for the address using a more reliable method
  const tryResolveENS = useCallback(async (addr: string): Promise<{name?: string, avatar?: string} | null> => {
    try {
      console.log('Trying to resolve ENS name for:', addr);
      
      // First try the ENS Public Resolver API
      const resolverResponse = await fetch(`https://api.ensideas.com/ens/resolve/${addr}`);
      if (resolverResponse.ok) {
        const resolverData = await resolverResponse.json();
        if (resolverData?.name) {
          console.log('Found ENS name via public resolver:', resolverData.name);
          
          // Try to get avatar
          let avatar;
          try {
            const avatarResponse = await fetch(`https://metadata.ens.domains/mainnet/avatar/${resolverData.name}`, {
              headers: { Accept: 'image/*' }
            });
            
            if (avatarResponse.ok) {
              avatar = avatarResponse.url;
              console.log('Found ENS avatar URL:', avatar);
            }
          } catch (avatarError) {
            console.error('Error fetching ENS avatar:', avatarError);
          }
          
          return { 
            name: resolverData.name,
            avatar
          };
        }
      }
      
      // If public resolver fails, try the Reverse Records contract
      const response = await fetch(ETH_RPC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            {
              to: ENS_REVERSE_RECORDS,
              data: `0x8e440c1d000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000${addr.slice(2).toLowerCase()}`
            },
            'latest'
          ]
        }),
      });
      
      if (!response.ok) {
        console.log('ENS resolution failed with status:', response.status);
        return null;
      }
      
      const data = await response.json();
      console.log('ENS resolution raw response:', data);
      
      if (!data.result || data.result === '0x' || data.result.length < 130) {
        console.log('No ENS name found in response');
        return null;
      }
      
      // Parse the response which should be an array of strings (but we only requested one address)
      const result = data.result;
      
      // The response format is:
      // 0x
      // 0000...0020 (32 bytes) - offset to start of array
      // 0000...0001 (32 bytes) - length of array (1)
      // 0000...0020 (32 bytes) - offset to first string
      // 0000...000x (32 bytes) - length of string
      // <string data>
      
      // Get the length of the string
      const stringLengthHex = result.slice(2 + 3*64, 2 + 4*64);
      const stringLength = parseInt(stringLengthHex, 16);
      
      if (stringLength === 0) {
        console.log('ENS name is empty');
        return null; // No ENS name found
      }
      
      // Extract the string data
      let ensName = '';
      for (let i = 0; i < stringLength * 2; i += 2) {
        const charCode = parseInt(result.slice(2 + 4*64 + i, 2 + 4*64 + i + 2), 16);
        if (charCode !== 0) { // Skip null bytes
          ensName += String.fromCharCode(charCode);
        }
      }
      
      // If we got a valid name that ends with .eth, it's an ENS name
      if (ensName && ensName.endsWith('.eth')) {
        console.log('Found ENS name:', ensName);
        
        // Try to get the avatar for this ENS name
        let avatar;
        try {
          // ENS Metadata API is a good source for avatars
          const avatarResponse = await fetch(`https://metadata.ens.domains/mainnet/avatar/${ensName}`, {
            headers: { Accept: 'image/*' }
          });
          
          if (avatarResponse.ok) {
            avatar = await avatarResponse.url;
            console.log('Found ENS avatar URL:', avatar);
          }
        } catch (avatarError) {
          console.error('Error fetching ENS avatar:', avatarError);
        }
        
        return { 
          name: ensName,
          avatar
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error resolving ENS name:', error);
      return null;
    }
  }, []);

  // Try to fetch Universal Profile data for the address
  const tryGetUPProfile = useCallback(async (addr: string): Promise<WhiskIdentity | null> => {
    try {
      // Normalize the address first
      const normalizedAddr = normalizeAddress(addr);
      console.log('Trying to fetch UP profile for normalized address:', normalizedAddr);
      
      // Check cache first
      if (identityCache.has(normalizedAddr)) {
        console.log('Using cached UP profile for:', normalizedAddr);
        return identityCache.get(normalizedAddr) || null;
      }
      
      // Make a simple fetch request to the UP API
      const response = await fetch(`https://api.universalprofile.cloud/v1/profiles/${normalizedAddr}`);
      
      if (!response.ok) {
        console.log('No UP profile found, status:', response.status);
        return null;
      }
      
      const data = await response.json();
      console.log('UP profile data:', data);
      
      if (!data) return null;
      
      // Extract name from various possible paths
      let name;
      if (data.name) {
        name = data.name;
      } else if (data.profileName) {
        name = data.profileName;
      } else if (data.LSP3Profile && data.LSP3Profile.name) {
        name = data.LSP3Profile.name;
      }
      
      // Extract avatar URL
      let avatar;
      if (data.profileImage && data.profileImage.length > 0) {
        const profileImage = data.profileImage[0];
        if (profileImage.url) {
          avatar = profileImage.url.startsWith('ipfs://')
            ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
            : profileImage.url;
        }
      } else if (data.LSP3Profile && data.LSP3Profile.profileImage && data.LSP3Profile.profileImage.length > 0) {
        const profileImage = data.LSP3Profile.profileImage[0];
        if (profileImage.url) {
          avatar = profileImage.url.startsWith('ipfs://')
            ? `https://api.universalprofile.cloud/ipfs/${profileImage.url.slice(7)}`
            : profileImage.url;
        }
      }
      
      if (name || avatar) {
        const result = {
          name: name || shortenAddress(normalizedAddr),
          avatar,
          address: normalizedAddr
        };
        
        // Cache the result
        identityCache.set(normalizedAddr, result);
        
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching UP profile:', error);
      return null;
    }
  }, [normalizeAddress, shortenAddress]);

  // Try alternative ENS resolution methods when the primary one fails
  const tryAlternativeENSResolution = useCallback(async (addr: string): Promise<{name?: string, avatar?: string} | null> => {
    try {
      console.log('Trying alternative ENS resolution for:', addr);
      
      // Try the ENS Public Resolver API directly
      const response = await fetch(`https://resolver.ens.domains/address/${addr}`);
      
      if (!response.ok) {
        console.log('Alternative ENS resolution failed, status:', response.status);
        return null;
      }
      
      const data = await response.json();
      console.log('Alternative ENS resolution data:', data);
      
      if (data && data.name) {
        const ensName = data.name;
        console.log('Found ENS name via alternative method:', ensName);
        
        // Try to get avatar
        let avatar;
        try {
          const avatarResponse = await fetch(`https://metadata.ens.domains/mainnet/avatar/${ensName}`, {
            headers: { Accept: 'image/*' }
          });
          
          if (avatarResponse.ok) {
            avatar = avatarResponse.url;
          }
        } catch (avatarError) {
          console.error('Error fetching ENS avatar:', avatarError);
        }
        
        return {
          name: ensName,
          avatar
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error with alternative ENS resolution:', error);
      return null;
    }
  }, []);

  // Try to resolve name using Whisk SDK
  const tryWhiskResolution = useCallback(async (addr: string): Promise<WhiskIdentity | null> => {
    try {
      // If Whisk client is not available, skip this step
      if (!whiskClient) {
        console.log('Whisk client not available, skipping Whisk resolution');
        return null;
      }
      
      console.log('Trying Whisk resolution for:', addr);
      
      // Use the Whisk GraphQL API to resolve the identity
      const result = await whiskClient.request<ResolveIdentityResponse>(`
        query ResolveIdentity($address: String!) {
          identity(address: $address) {
            name
            avatar
          }
        }
      `, { address: addr });

      console.log('Whisk resolution result:', result);
      
      if (result?.identity && (result.identity.name || result.identity.avatar)) {
        return {
          name: result.identity.name || shortenAddress(addr),
          avatar: result.identity.avatar,
          address: addr
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error with Whisk resolution:', error);
      return null;
    }
  }, [whiskClient, shortenAddress]);

  const resolveIdentity = useCallback(async (addr: string) => {
    if (!addr) {
      return null;
    }
    
    // Normalize the address
    const normalizedAddr = normalizeAddress(addr);
    console.log('Resolving identity for address:', normalizedAddr);
    
    if (!normalizedAddr.startsWith('0x')) {
      console.warn('Not a valid Ethereum address format:', addr);
      return {
        name: addr, // Just use the original string
        address: addr
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check cache first
      if (identityCache.has(normalizedAddr)) {
        console.log('Using cached identity for:', normalizedAddr);
        return identityCache.get(normalizedAddr);
      }
      
      // First, try to resolve ENS name
      const ensResult = await tryResolveENS(normalizedAddr);
      console.log('ENS resolution result:', ensResult);
      
      if (ensResult && ensResult.name) {
        console.log('Found ENS name:', ensResult.name);
        const result = {
          name: ensResult.name,
          avatar: ensResult.avatar,
          address: normalizedAddr
        };
        
        // Cache the result
        identityCache.set(normalizedAddr, result);
        return result;
      }
      
      // If primary ENS resolution fails, try alternative methods
      const altEnsResult = await tryAlternativeENSResolution(normalizedAddr);
      console.log('Alternative ENS resolution result:', altEnsResult);
      
      if (altEnsResult && altEnsResult.name) {
        console.log('Found ENS name via alternative method:', altEnsResult.name);
        const result = {
          name: altEnsResult.name,
          avatar: altEnsResult.avatar,
          address: normalizedAddr
        };
        
        // Cache the result
        identityCache.set(normalizedAddr, result);
        return result;
      }
      
      // If no ENS name, try to get Universal Profile data
      const upProfile = await tryGetUPProfile(normalizedAddr);
      console.log('UP profile result:', upProfile);
      
      if (upProfile) {
        console.log('Found UP profile:', upProfile);
        return upProfile;
      }
      
      // If no UP profile, try Whisk SDK
      const whiskResult = await tryWhiskResolution(normalizedAddr);
      console.log('Whisk resolution result:', whiskResult);
      
      if (whiskResult) {
        console.log('Found Whisk identity:', whiskResult);
        
        // Cache the result
        identityCache.set(normalizedAddr, whiskResult);
        
        return whiskResult;
      }

      // Placeholder implementation - just returns shortened address
      console.log('No identity found, using shortened address');
      const result = {
        name: shortenAddress(normalizedAddr),
        address: normalizedAddr
      };
      
      // Cache the result
      identityCache.set(normalizedAddr, result);
      
      return result;
    } catch (err) {
      console.error('Error resolving identity:', err);
      setError(err instanceof Error ? err : new Error('Failed to resolve identity'));
      
      const fallback = {
        name: shortenAddress(normalizedAddr),
        address: normalizedAddr
      };
      
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, [normalizeAddress, shortenAddress, tryResolveENS, tryAlternativeENSResolution, tryGetUPProfile, tryWhiskResolution]);

  useEffect(() => {
    if (address) {
      resolveIdentity(address)
        .then(result => {
          if (result) {
            setIdentity(result);
          }
        })
        .catch(err => {
          console.error('Error resolving identity in effect:', err);
          setError(err instanceof Error ? err : new Error('Failed to resolve identity'));
          
          const normalizedAddr = normalizeAddress(address);
          setIdentity({
            name: shortenAddress(normalizedAddr),
            address: normalizedAddr
          });
        });
    } else {
      setIdentity(null);
    }
  }, [address, resolveIdentity, shortenAddress, normalizeAddress]);

  return {
    identity,
    isLoading,
    error,
    // Expose helper methods
    shortenAddress,
    normalizeAddress,
    // Indicate if Whisk is available
    whiskAvailable: !!whiskClient
  };
}; 
