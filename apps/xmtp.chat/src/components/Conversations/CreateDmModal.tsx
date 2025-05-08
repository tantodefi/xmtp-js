import { Box, Button, Group, TextInput, Divider, Stack, Title, Text, Image, Loader } from "@mantine/core";
import { Utils, type Conversation } from "@xmtp/browser-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/Modal";
import { isValidEthereumAddress, isValidInboxId } from "@/helpers/strings";
import { useCollapsedMediaQuery } from "@/hooks/useCollapsedMediaQuery";
import { useConversations } from "@/hooks/useConversations";
import { useSettings } from "@/hooks/useSettings";
import { ContentLayout } from "@/layouts/ContentLayout";
import { LuksoProfile } from "@/components/LuksoProfile";
import { useWhiskIdentity } from "@/hooks/useWhiskIdentity";
import { useEnsAddress } from "wagmi";
import { useXMTP } from "@/contexts/XMTPContext";
import { gql, request } from "graphql-request";
import makeBlockie from "ethereum-blockies-base64";
import { createClientUPProvider, type ClientUPProvider } from "@lukso/up-provider";

const WHISK_API_URL = 'https://api.whisk.so/graphql';

// Improved function to safely get all context accounts from LUKSO UP Provider
const safeGetContextAccounts = async (): Promise<string[]> => {
  try {
    console.log("CreateDmModal: Starting context accounts check");

    // First try with browser extension if available
    if (typeof window !== 'undefined' && window.lukso) {
      console.log("CreateDmModal: Browser extension detected (window.lukso)");

      // Try accessing contextAccounts directly from window.lukso
      if (window.lukso.contextAccounts && Array.isArray(window.lukso.contextAccounts)) {
        const accounts = window.lukso.contextAccounts.map(account => account.toLowerCase());
        console.log("CreateDmModal: Found context accounts from window.lukso.contextAccounts:", accounts);
        return accounts;
      }

      // Try RPC method with browser extension
      if (typeof window.lukso.request === 'function') {
        try {
          console.log("CreateDmModal: Trying up_contextAccounts RPC method with extension");
          const contextAccounts = await window.lukso.request({
            method: 'up_contextAccounts',
            params: []
          });

          if (Array.isArray(contextAccounts) && contextAccounts.length > 0) {
            const accounts = contextAccounts.map(account => account.toLowerCase());
            console.log("CreateDmModal: Found context accounts via RPC:", accounts);
            return accounts;
          }
        } catch (extensionError) {
          console.log("CreateDmModal: Error with extension RPC:", extensionError);
        }
      }
    }

    // Try with @lukso/up-provider package as fallback
    try {
      console.log("CreateDmModal: Attempting to create client UP provider from package");
      const clientProvider: ClientUPProvider = createClientUPProvider();

      // Log to see what we get
      console.log("CreateDmModal: Created clientProvider:", {
        hasAllowedAccounts: !!clientProvider.allowedAccounts,
        hasContextAccounts: !!clientProvider.contextAccounts,
        methods: Object.keys(clientProvider).filter(key => {
          try {
            return typeof (clientProvider as any)[key] === 'function';
          } catch (e) {
            return false;
          }
        })
      });

      // Check contextAccounts property
      if (clientProvider.contextAccounts && Array.isArray(clientProvider.contextAccounts) && clientProvider.contextAccounts.length > 0) {
        const accounts = clientProvider.contextAccounts.map(account => account.toLowerCase());
        console.log("CreateDmModal: Found context accounts from clientProvider.contextAccounts:", accounts);
        return accounts;
      }

      // Try RPC method with client provider
      try {
        console.log("CreateDmModal: Trying up_contextAccounts RPC method with client provider");
        const contextAccounts = await clientProvider.request('up_contextAccounts', []);

        if (Array.isArray(contextAccounts) && contextAccounts.length > 0) {
          const accounts = contextAccounts.map(account => account.toLowerCase());
          console.log("CreateDmModal: Found context accounts via client provider RPC:", accounts);
          return accounts;
        }
      } catch (clientProviderError) {
        console.log("CreateDmModal: Error with client provider RPC:", clientProviderError);
      }

      // Last resort - try eth_accounts
      try {
        console.log("CreateDmModal: Falling back to eth_accounts with client provider");
        const accounts = await clientProvider.request('eth_accounts', []);

        if (Array.isArray(accounts) && accounts.length > 0) {
          const normalizedAccounts = accounts.map(account => account.toLowerCase());
          console.log("CreateDmModal: Found accounts from eth_accounts via client provider:", normalizedAccounts);
          return normalizedAccounts;
        }
      } catch (accountsError) {
        console.log("CreateDmModal: Error getting eth_accounts via client provider:", accountsError);
      }
    } catch (packageError) {
      console.error("CreateDmModal: Error creating client provider from package:", packageError);
    }

    // Final fallback - try window.ethereum if it's a LUKSO provider
    if (typeof window !== 'undefined' && window.ethereum &&
      (window.ethereum.isLukso || window.ethereum.isUniversalProfile) &&
      typeof window.ethereum.request === 'function') {
      console.log("CreateDmModal: Trying window.ethereum as LUKSO provider");

      try {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts'
        });

        if (Array.isArray(accounts) && accounts.length > 0) {
          const normalizedAccounts = accounts.map(account => account.toLowerCase());
          console.log("CreateDmModal: Found accounts from window.ethereum:", normalizedAccounts);
          return normalizedAccounts;
        }
      } catch (ethereumError) {
        console.log("CreateDmModal: Error with window.ethereum:", ethereumError);
      }
    }

    console.log("CreateDmModal: No LUKSO provider or context accounts found after all attempts");
    return [];
  } catch (error) {
    console.error("CreateDmModal: Error safely accessing LUKSO provider:", error);
    return [];
  }
};

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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // For grid owner detection
  const [contextAccounts, setContextAccounts] = useState<string[]>([]);
  const [gridOwnerXmtpAddress, setGridOwnerXmtpAddress] = useState<string | null>(null);

  // Add Whisk identity resolution for any Ethereum address
  const isEnsName = memberId.endsWith('.eth');
  const isValidAddress = isValidEthereumAddress(memberId);

  // Use Whisk to resolve ANY address, not just for forward lookups
  const { identity: whiskIdentity, isLoading: isResolvingWhiskIdentity } = useWhiskIdentity(
    isValidAddress ? memberId : null
  );

  // Use BOTH wagmi's ENS resolution AND our own Whisk resolver for .eth names
  const { data: ensAddress, isLoading: isResolvingEns } = useEnsAddress({
    name: isEnsName ? memberId : undefined,
  });

  // State for custom ENS resolution
  const [whiskResolvedAddress, setWhiskResolvedAddress] = useState<string | null>(null);
  const [isResolvingWhiskENS, setIsResolvingWhiskENS] = useState(false);

  // Custom effect to resolve ENS names using Whisk SDK
  useEffect(() => {
    if (!isEnsName || !memberId) {
      setWhiskResolvedAddress(null);
      return;
    }

    const resolveWithWhisk = async () => {
      setIsResolvingWhiskENS(true);
      try {
        console.log('Resolving ENS with enhanced resolver:', memberId);
        const address = await resolveEnsName(memberId);
        console.log('Enhanced resolved ENS address:', address);

        if (address) {
          // We got a successful resolution
          setWhiskResolvedAddress(address);
          setMemberIdError(null);

          // Verify it's on XMTP 
          if (utilsRef.current) {
            try {
              const inboxId = await utilsRef.current.getInboxIdForIdentifier(
                {
                  identifier: address.toLowerCase(),
                  identifierKind: "Ethereum",
                },
                environment,
              );
              if (!inboxId) {
                // Address is valid but not on XMTP
                setMemberIdError("ENS resolved but address not registered on XMTP");
              }
            } catch (xmtpError) {
              console.error('Error checking XMTP registration for ENS address:', xmtpError);
            }
          }
        } else {
          // Resolution failed
          setWhiskResolvedAddress(null);
          setMemberIdError("Invalid ENS name or not registered");
        }
      } catch (error) {
        console.error('Error resolving ENS with enhanced resolver:', error);
        setWhiskResolvedAddress(null);
        setMemberIdError("Error resolving ENS name");
      } finally {
        setIsResolvingWhiskENS(false);
      }
    };

    void resolveWithWhisk();
  }, [isEnsName, memberId, environment]);

  // Prefer Whisk resolution over wagmi if available
  const effectiveEnsAddress = useMemo(() => {
    return whiskResolvedAddress || ensAddress;
  }, [whiskResolvedAddress, ensAddress]);

  // Combined loading state for ENS resolution
  const isResolvingEffectiveENS = isResolvingEns || isResolvingWhiskENS;

  // Handle displaying ENS resolution status
  const displayEnsResolutionStatus = useMemo(() => {
    if (!isEnsName) return null;

    return (
      <Box mt={5}>
        {effectiveEnsAddress ? (
          <Text size="sm" c="green.6" fw={500}>
            <span role="img" aria-label="Resolved">✓</span> Resolved to: <b>{effectiveEnsAddress}</b>
            {memberIdError ? (
              <Text size="xs" c="orange.6" mt={1}>
                ⚠️ {memberIdError}
              </Text>
            ) : (
              <Text size="xs" c="green.6" mt={1}>
                ✓ Address is registered on XMTP
              </Text>
            )}
          </Text>
        ) : isResolvingEffectiveENS ? (
          <Text size="sm" c="gray.6">
            <Loader size="xs" mr={5} display="inline-block" /> Resolving ENS name...
          </Text>
        ) : (
          <Text size="sm" c="red.6">
            <span role="img" aria-label="Not Found">⚠️</span> {memberIdError || "Could not resolve ENS name"}
          </Text>
        )}
      </Box>
    );
  }, [isEnsName, effectiveEnsAddress, isResolvingEffectiveENS, memberIdError]);

  // Handle LUKSO Profile search
  const handleLuksoProfileSearch = useCallback(async (query: string) => {
    if (query.length !== 3) return;

    setIsSearching(true);
    try {
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

      const { search_profiles: data } = (await request(
        'https://envio.lukso-mainnet.universal.tech/v1/graphql',
        gqlQuery,
        { id: query }
      )) as { search_profiles: any[] };

      setSearchResults(data);
      setShowSearchResults(data.length > 0);
    } catch (error) {
      console.error('LUKSO Profile search error:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Unified input handler
  const handleUnifiedInput = useCallback((input: string) => {
    setMemberId(input);

    // Clear previous results when input changes
    if (searchResults.length > 0) {
      setSearchResults([]);
      setShowSearchResults(false);
    }

    // If input is exactly 3 characters, trigger LUKSO profile search
    if (input.length === 3) {
      handleLuksoProfileSearch(input);
    }

    // Clear selected profile if input changes
    if (selectedProfileAddress) {
      setSelectedProfileAddress(null);
    }

    // Clear XMTP address if input changes
    if (xmtpAddressFromUP) {
      setXmtpAddressFromUP(null);
    }
  }, [handleLuksoProfileSearch, searchResults.length, selectedProfileAddress, xmtpAddressFromUP]);

  // Handle selection of a profile from search results
  const handleSelectSearchResult = useCallback((profile: any) => {
    try {
      const address = profile.id as `0x${string}`;
      setMemberId(address);
      setSelectedProfileAddress(address);
      setSearchResults([]);
      setShowSearchResults(false);
    } catch (error) {
      console.error('Invalid address:', error);
    }
  }, []);

  // Check for context accounts (grid owner) on mount
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelays = [500, 1000, 2000, 3000, 5000]; // Exponential backoff in ms
    let timeoutRef: NodeJS.Timeout | null = null;

    // Try to get context accounts with a retry mechanism
    const attemptGetContextAccounts = async () => {
      if (!mounted) return;

      try {
        console.log(`CreateDmModal: Attempt ${retryCount + 1}/${maxRetries + 1} to get context accounts`);
        const accounts = await safeGetContextAccounts();

        if (mounted) {
          console.log(`CreateDmModal: Context accounts (attempt ${retryCount + 1}):`, accounts);
          setContextAccounts(accounts);

          // If we found at least 2 accounts (UP owner + grid owner), we can stop retrying
          if (accounts.length > 1) {
            console.log("CreateDmModal: Found grid owner account, stopping retries");
            return;
          }

          // If we haven't found grid owner but have reached max retries, stop
          if (retryCount >= maxRetries) {
            console.log("CreateDmModal: Max retries reached, stopping attempts");
            return;
          }

          // Schedule next retry with exponential backoff
          const delay = retryDelays[retryCount] || 5000;
          console.log(`CreateDmModal: Scheduling retry in ${delay}ms`);

          timeoutRef = setTimeout(() => {
            if (mounted) {
              retryCount++;
              void attemptGetContextAccounts();
            }
          }, delay);
        }
      } catch (error) {
        console.error("CreateDmModal: Error checking for LUKSO context accounts:", error);

        // If error but haven't reached max retries, try again
        if (retryCount < maxRetries && mounted) {
          const delay = retryDelays[retryCount] || 5000;
          console.log(`CreateDmModal: Error occurred. Retrying in ${delay}ms`);

          timeoutRef = setTimeout(() => {
            if (mounted) {
              retryCount++;
              void attemptGetContextAccounts();
            }
          }, delay);
        }
      }
    };

    // Start the first attempt
    void attemptGetContextAccounts();

    // Cleanup function
    return () => {
      mounted = false;
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
    };
  }, []);

  // Function to handle grid owner XMTP address found
  const handleGridOwnerXmtpAddressFound = useCallback((address: string) => {
    console.log("CreateDmModal: Grid owner XMTP address found:", address);
    setGridOwnerXmtpAddress(address);
  }, []);

  // Check if we're in a grid context (second context account exists)
  const hasGridOwner = useMemo(() => {
    // Check if we have more than one context account
    if (contextAccounts.length > 1) {
      return true;
    }

    // Check if second account is different from first (to avoid duplicate UP accounts)
    if (contextAccounts.length > 1 &&
      contextAccounts[0] &&
      contextAccounts[1] &&
      contextAccounts[0].toLowerCase() !== contextAccounts[1].toLowerCase()) {
      return true;
    }

    return false;
  }, [contextAccounts]);

  const gridOwnerAddress = useMemo(() => {
    // If we have multiple accounts, the second one is the grid owner
    if (contextAccounts.length > 1) {
      console.log("CreateDmModal: Using second context account as grid owner:", contextAccounts[1]);
      return contextAccounts[1];
    }
    return null;
  }, [contextAccounts]);

  // Function to message the grid owner
  const handleMessageGridOwner = useCallback(() => {
    // If XMTP address is available, use it; otherwise fall back to UP address
    const targetAddress = gridOwnerXmtpAddress ||
      (contextAccounts.length > 1 ? contextAccounts[1] : null);

    if (targetAddress) {
      console.log("CreateDmModal: Messaging grid owner:", targetAddress);
      setMemberId(targetAddress);
      // If we have the XMTP address from the UP, set it
      if (gridOwnerXmtpAddress) {
        setXmtpAddressFromUP(gridOwnerXmtpAddress);
      }
    }
  }, [gridOwnerXmtpAddress, contextAccounts]);

  const resolveEnsName = async (name: string) => {
    try {
      console.log(`Attempting to resolve ENS name: ${name}`);

      // Create an array of resolution methods to try in sequence
      const resolutionMethods = [
        // Method 1: Public ENS resolver API (most reliable)
        async () => {
          try {
            const publicResolverResponse = await fetch(`https://api.ensideas.com/ens/resolve/${name}`);
            if (publicResolverResponse.ok) {
              const resolverData = await publicResolverResponse.json();
              if (resolverData?.address) {
                console.log(`Resolved ${name} to ${resolverData.address} via public ENS resolver`);
                return resolverData.address;
              }
            }
            return null;
          } catch (error) {
            console.error('Error with public ENS resolver:', error);
            return null;
          }
        },

        // Method 2: TheGraph ENS API (good alternative)
        async () => {
          try {
            const thegraphResponse = await fetch('https://api.thegraph.com/subgraphs/name/ensdomains/ens', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                query: `{
                  domains(where: { name: "${name}" }) {
                    resolvedAddress {
                      id
                    }
                  }
                }`
              })
            });

            const thegraphData = await thegraphResponse.json();
            if (thegraphData?.data?.domains?.[0]?.resolvedAddress?.id) {
              const address = thegraphData.data.domains[0].resolvedAddress.id;
              console.log(`Resolved ${name} to ${address} via TheGraph ENS API`);
              return address;
            }
            return null;
          } catch (error) {
            console.error('Error with TheGraph ENS API:', error);
            return null;
          }
        },

        // Method 3: Whisk API (if available)
        async () => {
          if (!import.meta.env.VITE_WHISK_API_KEY) return null;

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

            const responseData = await response.json();
            if (responseData?.data?.identity?.address) {
              console.log(`Resolved ${name} to ${responseData.data.identity.address} via Whisk API`);
              return responseData.data.identity.address;
            }
            return null;
          } catch (error) {
            console.error('Error with Whisk API ENS resolution:', error);
            return null;
          }
        },

        // Method 4: Ethereum Name Wrapper
        async () => {
          try {
            const nameWrapperResponse = await fetch(`https://eth-mainnet.g.alchemy.com/v2/demo`, {
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
                    to: '0x114D4603199df73e7D157787f8778E21fCd13066', // ENS Name Wrapper
                    data: `0xbc1c58d1${name.split('.')[0].padEnd(64, '0')}${name.split('.')[1].padEnd(64, '0')}`
                  },
                  'latest'
                ]
              })
            });

            const nameWrapperData = await nameWrapperResponse.json();
            if (nameWrapperData?.result && nameWrapperData.result !== '0x' && nameWrapperData.result.length >= 42) {
              const address = `0x${nameWrapperData.result.slice(-40)}`;
              if (address !== '0x0000000000000000000000000000000000000000') {
                console.log(`Resolved ${name} to ${address} via ENS Name Wrapper`);
                return address;
              }
            }
            return null;
          } catch (error) {
            console.error('Error with ENS Name Wrapper resolution:', error);
            return null;
          }
        },

        // Method 5: Direct Public Resolver Call (most reliable but complex)
        async () => {
          try {
            // This is a simplified approach - in production would use proper namehash
            const ethRpcEndpoint = 'https://eth-mainnet.g.alchemy.com/v2/demo';

            // First try the addr(bytes32) function (old style)
            const oldStyleCall = {
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_call',
              params: [
                {
                  to: '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41', // ENS public resolver
                  data: `0x3b3b57de${name.slice(0, -4).padEnd(64, '0')}` // Function selector for addr(bytes32)
                },
                'latest'
              ]
            };

            const rpcResponse = await fetch(ethRpcEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(oldStyleCall)
            });

            const rpcData = await rpcResponse.json();
            if (rpcData?.result && rpcData.result !== '0x' && rpcData.result !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              const address = `0x${rpcData.result.slice(-40)}`;
              console.log(`Resolved ${name} to ${address} via ENS Public Resolver (old style)`);
              return address;
            }

            // If old style fails, try new style addr(bytes32,uint256) function
            const newStyleCall = {
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_call',
              params: [
                {
                  to: '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41', // ENS public resolver
                  data: `0xf1cb7e06${name.slice(0, -4).padEnd(64, '0')}0000000000000000000000000000000000000000000000000000000000000001` // addr(bytes32,uint256)
                },
                'latest'
              ]
            };

            const newStyleResponse = await fetch(ethRpcEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newStyleCall)
            });

            const newStyleData = await newStyleResponse.json();
            if (newStyleData?.result && newStyleData.result !== '0x' && newStyleData.result !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              const address = `0x${newStyleData.result.slice(-40)}`;
              console.log(`Resolved ${name} to ${address} via ENS Public Resolver (new style)`);
              return address;
            }

            return null;
          } catch (error) {
            console.error('Error with direct Ethereum RPC resolution:', error);
            return null;
          }
        },

        // Method 6: Cloudflare ENS Gateway (another public resolver)
        async () => {
          try {
            const cloudflareResponse = await fetch(`https://cloudflare-eth.com`, {
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
                    to: '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41',
                    data: `0x3b3b57de${name.slice(0, -4).padEnd(64, '0')}`
                  },
                  'latest'
                ]
              })
            });

            const cloudflareData = await cloudflareResponse.json();
            if (cloudflareData?.result && cloudflareData.result !== '0x' && cloudflareData.result !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              const address = `0x${cloudflareData.result.slice(-40)}`;
              console.log(`Resolved ${name} to ${address} via Cloudflare ENS Gateway`);
              return address;
            }
            return null;
          } catch (error) {
            console.error('Error with Cloudflare ENS Gateway:', error);
            return null;
          }
        }
      ];

      // Try each resolution method in sequence with retries for network issues
      for (const method of resolutionMethods) {
        // Try each method up to 2 times (initial + 1 retry)
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const result = await method();
            if (result) return result;

            // If method failed but didn't throw, continue to next method/attempt
            if (attempt === 0) {
              console.log('Resolution attempt failed, retrying...');
              await new Promise(r => setTimeout(r, 300)); // Small delay before retry
            }
          } catch (methodError) {
            console.error(`Resolution method error on attempt ${attempt + 1}:`, methodError);
            if (attempt === 0) {
              await new Promise(r => setTimeout(r, 300)); // Small delay before retry
            }
          }
        }
      }

      // If we get here, all methods failed
      console.warn(`Failed to resolve ENS name ${name} with all available methods`);
      return null;
    } catch (error) {
      console.error('Error in ENS resolution process:', error);
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
        if (isResolvingEffectiveENS) {
          setMemberIdError(null);
          return;
        }

        if (!effectiveEnsAddress) {
          setMemberIdError("Invalid ENS name");
          return;
        }

        // Check XMTP registration for resolved ENS address
        if (utilsRef.current) {
          try {
            const inboxId = await utilsRef.current.getInboxIdForIdentifier(
              {
                identifier: effectiveEnsAddress.toLowerCase(),
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
  }, [memberId, isEnsName, effectiveEnsAddress, isResolvingEffectiveENS, environment]);

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
      } else if (isEnsName && effectiveEnsAddress) {
        console.log('Creating DM with resolved ENS address:', effectiveEnsAddress);
        conversation = await newDmWithIdentifier({
          identifier: effectiveEnsAddress,
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
          disabled={loading || memberIdError !== null || (isEnsName && isResolvingEffectiveENS)}
          loading={loading}
          onClick={() => void handleCreate()}>
          Create
        </Button>
      </Group>
    );
  }, [handleClose, handleCreate, loading, memberIdError, isEnsName, isResolvingEffectiveENS]);

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
        <Stack p="md" gap="md">
          <Text size="sm">
            Enter a 3 digit code to search LUKSO profiles, or enter an Ethereum address, ENS name, Lukso Universal Profile address, or XMTP inbox ID
          </Text>
          <Box pos="relative">
            <TextInput
              value={memberId}
              onChange={(e) => handleUnifiedInput(e.target.value)}
              error={memberIdError}
              placeholder="Enter 3 chars to search, or 0x123…, example.eth, user@example.com, inbox-id"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && showSearchResults && searchResults.length > 0) {
                  handleSelectSearchResult(searchResults[0]);
                  e.preventDefault();
                }
              }}
              rightSection={
                isSearching ? (
                  <Loader size="xs" mr="xs" />
                ) : null
              }
            />
          </Box>

          {/* Display ENS name if address is valid and has an ENS using Whisk */}
          {isValidAddress && !isSearching && !isEnsName && (
            <Box mt={5}>
              {whiskIdentity && whiskIdentity.name && whiskIdentity.name !== whiskIdentity.address ? (
                <Text size="sm" c="blue.6" fw={500}>
                  <span role="img" aria-label="Identity">🔍</span> Identity: <b>{whiskIdentity.name}</b>
                  {whiskIdentity.avatar && (
                    <Image
                      src={whiskIdentity.avatar}
                      alt={whiskIdentity.name}
                      width={24}
                      height={24}
                      radius="xl"
                      display="inline-block"
                      ml={5}
                      style={{ verticalAlign: 'middle' }}
                    />
                  )}
                </Text>
              ) : isResolvingWhiskIdentity ? (
                <Text size="sm" c="gray.6">
                  <Loader size="xs" mr={5} display="inline-block" /> Looking up identity...
                </Text>
              ) : null}
            </Box>
          )}

          {/* Display ENS resolution status */}
          {displayEnsResolutionStatus}

          {/* Display search results */}
          {showSearchResults && searchResults.length > 0 && (
            <Box style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              zIndex: 10,
              maxHeight: 180,
              overflowY: 'auto'
            }}>
              {searchResults.map((result) => (
                <Button
                  key={result.id}
                  variant="subtle"
                  fullWidth
                  className="flex items-start gap-4 border-b border-gray-100 last:border-0"
                  styles={{
                    root: {
                      display: 'flex',
                      justifyContent: 'flex-start',
                      padding: '8px 12px',
                      height: 'auto',
                      textAlign: 'left',
                    },
                    label: {
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      width: '100%',
                    }
                  }}
                  onClick={() => handleSelectSearchResult(result)}
                >
                  <Box>
                    <Image
                      src={
                        result.profileImages && result.profileImages.length > 0
                          ? (result.profileImages[0].url?.startsWith('ipfs://')
                            ? `https://api.universalprofile.cloud/ipfs/${result.profileImages[0].url.slice(7)}`
                            : result.profileImages[0].url || result.profileImages[0].src)
                          : makeBlockie(result.id)
                      }
                      alt={`${result.name || result.id} avatar`}
                      width={40}
                      height={40}
                      radius="xl"
                      onError={(e: any) => {
                        e.currentTarget.src = makeBlockie(result.id);
                      }}
                    />
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    {result.name && (
                      <Text size="sm" c="dark">
                        {result.name}
                      </Text>
                    )}
                    {result.fullName && (
                      <Text size="xs" c="dimmed" truncate>
                        {result.fullName}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed" truncate>
                      {result.id}
                    </Text>
                  </Box>
                </Button>
              ))}
            </Box>
          )}

          {/* Display selected profile if available */}
          {selectedProfileAddress && !hasGridOwner && (
            <>
              <Divider my="md" />
              <Text size="sm" fw={600}>Selected profile:</Text>
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

          {/* Show grid owner section if we're in a grid context */}
          {hasGridOwner && gridOwnerAddress && (
            <>
              <Divider my="md" />
              <Box
                p="md"
                style={{
                  border: '1px solid #1971c2',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(231, 245, 255, 0.5)'
                }}
              >
                <Text size="sm" fw={700} ta="center" c="blue.7" mb="xs">
                  🔍 Grid Owner Detected
                </Text>
                <Text size="xs" c="gray.7" ta="center" mb="md">
                  You're in a grid context. Want to message the grid owner?
                </Text>
                <Box w="100%">
                  <LuksoProfile
                    address={gridOwnerAddress}
                    onXmtpAddressFound={handleGridOwnerXmtpAddressFound}
                  />
                </Box>
                {gridOwnerXmtpAddress && (
                  <Box py="xs">
                    <Text size="sm" fw={500} c="blue.7">
                      ✓ Found XMTP address in Grid Owner Profile
                    </Text>
                    <Text size="xs" c="dimmed">
                      This address will be used to create the conversation.
                    </Text>
                  </Box>
                )}
                <Button
                  mt="sm"
                  fullWidth
                  color="blue"
                  onClick={handleMessageGridOwner}>
                  Message Grid Owner
                </Button>
              </Box>
            </>
          )}

          <Divider my="md" />

          {client && !initializing && (
            <Button variant="light" size="sm" onClick={handleElsaClick}>
              Message ELSA
            </Button>
          )}
        </Stack>
      </ContentLayout>
    </Modal>
  );
};
