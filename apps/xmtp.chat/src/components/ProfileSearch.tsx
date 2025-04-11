/**
 * ProfileSearch Component
 * 
 * A searchable interface for Universal Profiles that allows users to search and select
 * blockchain addresses associated with profiles.
 * 
 * Features:
 * - Auto-search triggers when exactly 3 characters are entered
 * - Manual search available via Enter key
 * - Displays profile images with blockies fallback
 * - Shows profile name, full name, and address in results
 * 
 * @component
 * @param {Object} props
 * @param {(address: `0x${string}`) => void} props.onSelectAddress - Callback function triggered when a profile is selected
 */
'use client';

import { useCallback, useState } from 'react';
import { request, gql } from 'graphql-request';
import makeBlockie from 'ethereum-blockies-base64';
import { Box, Image } from '@mantine/core';

const gqlQuery = gql`
  query MyQuery($id: String!) {
    search_profiles(args: { search: $id }) {
      name
      fullName
      id
      profileImages(
        where: { error: { _is_null: true } }
        order_by: { width: asc }
      ) {
        width
        src
        url
        verified
      }
    }
  }
`;

type Profile = {
  name?: string;
  id: string;
  fullName?: string;
  profileImages?: {
    width: number;
    src: string;
    url: string;
    verified: boolean;
  }[];
};

type SearchProps = {
  onSelectAddress: (address: `0x${string}`) => void;
};

export function ProfileSearch({ onSelectAddress }: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSearch = useCallback(
    async (searchQuery: string, forceSearch: boolean = false) => {
      setQuery(searchQuery);
      if (searchQuery.length < 3) {
        setResults([]);
        setShowDropdown(false);
        return;
      }

      // Only search automatically for exactly 3 chars, or when forced (Enter pressed)
      if (searchQuery.length > 3 && !forceSearch) {
        return;
      }

      setLoading(true);
      try {
        const { search_profiles: data } = (await request(
          'https://envio.lukso-testnet.universal.tech/v1/graphql',
          gqlQuery,
          { id: searchQuery }
        )) as { search_profiles: Profile[] };

        setResults(data);
        setShowDropdown(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(query, true);
    }
  };

  const handleSelectProfile = (profile: Profile) => {
    try {
      // The profile.id should be an Ethereum address
      const address = profile.id as `0x${string}`;
      onSelectAddress(address);
      setShowDropdown(false);
      setQuery('');
    } catch (error) {
      console.error('Invalid address:', error);
    }
  };

  const getProfileImage = (profile: Profile) => {
    if (profile.profileImages && profile.profileImages.length > 0) {
      const imageUrl = profile.profileImages[0].url || profile.profileImages[0].src;
      // Handle IPFS URLs
      const finalUrl = imageUrl.startsWith('ipfs://')
        ? `https://api.universalprofile.cloud/ipfs/${imageUrl.slice(7)}`
        : imageUrl;

      return (
        <Image
          src={finalUrl}
          alt={`${profile.name || profile.id} avatar`}
          width={40}
          height={40}
          radius="xl"
          onError={(e: any) => {
            // Fallback to blockie if image fails to load
            e.currentTarget.src = makeBlockie(profile.id);
          }}
        />
      );
    }

    return (
      <Image
        src={makeBlockie(profile.id)}
        alt={`${profile.name || profile.id} avatar`}
        width={40}
        height={40}
        radius="xl"
      />
    );
  };

  return (
    <Box className="w-full">
      <Box pos="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Enter 3 characters to search..."
          className="w-full p-2 border border-gray-300 rounded-md"
          disabled={loading}
        />
        {loading && (
          <Box pos="absolute" right={12} top="50%" style={{ transform: 'translateY(-50%)' }}>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-500 border-t-transparent"></div>
          </Box>
        )}
      </Box>
      {showDropdown && results.length > 0 && (
        <Box mt={8} style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: 10,
          maxHeight: 180,
          overflowY: 'auto'
        }}>
          {results.map((result) => (
            <button
              key={result.id}
              className="w-full px-2 py-4 text-left hover:bg-gray-100 flex items-start gap-4 border-b border-gray-100 last:border-0 transition-colors"
              onClick={() => handleSelectProfile(result)}
            >
              <Box>{getProfileImage(result)}</Box>
              <Box style={{ flex: 1, minWidth: 0 }}>
                {result.name && (
                  <Box style={{ fontSize: 14, color: '#374151' }}>
                    {result.name}
                  </Box>
                )}
                {result.fullName && (
                  <Box style={{ fontSize: 14, color: '#6B7280', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {result.fullName}
                  </Box>
                )}
                <Box style={{ fontSize: 14, color: '#9CA3AF', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {result.id}
                </Box>
              </Box>
            </button>
          ))}
        </Box>
      )}
    </Box>
  );
} 