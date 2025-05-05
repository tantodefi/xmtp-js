import { useEffect, useState } from 'react';
import makeBlockie from 'ethereum-blockies-base64';
import { ethers } from 'ethers';
import { ERC725 } from '@erc725/erc725.js';
import { UniversalProfileArtifact } from '@/artifacts/UniversalProfile';

const DEFAULT_ADDRESS = '0x0000000000000000000000000000000000000000';
const RPC_ENDPOINT = 'https://rpc.mainnet.lukso.network/';
const BACKUP_RPC_ENDPOINTS = [
  'https://rpc.mainnet.lukso.network/',
  'https://lukso-mainnet.rpc.thirdweb.com/',
  'https://lukso.drpc.org',
  'https://lukso-mainnet.public.blastapi.io',
  'https://public-rpc.lukso.network/'
];
const RPC_TIMEOUT = 5000; // 5 seconds

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]);
}

export function useLuksoProfileData(address?: string) {
  const [profile, setProfile] = useState<{
    fullName: string;
    imgUrl: string;
    isLoading: boolean;
  }>({
    fullName: 'Loading...',
    imgUrl: makeBlockie(address || DEFAULT_ADDRESS),
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;
    async function fetchProfileData() {
      if (!address || address === DEFAULT_ADDRESS) {
        setProfile({ fullName: 'Unknown', imgUrl: makeBlockie(DEFAULT_ADDRESS), isLoading: false });
        return;
      }
      setProfile(prev => ({ ...prev, isLoading: true }));
      // Find a working RPC endpoint
      let workingEndpoint = RPC_ENDPOINT;
      let endpointWorks = false;
      for (const endpoint of [RPC_ENDPOINT, ...BACKUP_RPC_ENDPOINTS]) {
        if (!isMounted) return;
        try {
          const provider = new ethers.JsonRpcProvider(endpoint);
          await withTimeout(provider.getNetwork(), RPC_TIMEOUT);
          workingEndpoint = endpoint;
          endpointWorks = true;
          break;
        } catch {}
      }
      if (!endpointWorks) {
        setProfile(prev => ({ ...prev, fullName: 'Network Error', isLoading: false }));
        return;
      }
      const options = { ipfsGateway: 'https://api.universalprofile.cloud/ipfs/' };
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
        const profileData = await withTimeout(erc725.getData().catch(() => null), RPC_TIMEOUT);
        if (profileData && Array.isArray(profileData) && profileData.length > 0) {
          const profileInfo = profileData[0]?.value;
          let name = 'Unknown Profile';
          let imageUrl = makeBlockie(address);
          if (profileInfo && typeof profileInfo === 'object' && 'url' in profileInfo && typeof profileInfo.url === 'string' && profileInfo.url.startsWith('ipfs://')) {
            const ipfsUrl = `https://api.universalprofile.cloud/ipfs/${profileInfo.url.slice(7)}`;
            const response = await fetch(ipfsUrl).catch(() => null);
            if (response && response.ok) {
              const data = await response.json().catch(() => null);
              if (data) {
                if (data.LSP3Profile && data.LSP3Profile.name) {
                  name = data.LSP3Profile.name;
                } else if (data.name) {
                  name = data.name;
                }
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
              }
            }
          }
          if (isMounted) {
            setProfile({ fullName: name, imgUrl: imageUrl, isLoading: false });
          }
        } else if (isMounted) {
          setProfile(prev => ({ ...prev, fullName: 'Unknown Profile', isLoading: false }));
        }
      } catch {
        if (isMounted) {
          setProfile(prev => ({ ...prev, fullName: 'Error loading profile', isLoading: false }));
        }
      }
    }
    fetchProfileData();
    return () => { isMounted = false; };
  }, [address]);

  return profile;
}
