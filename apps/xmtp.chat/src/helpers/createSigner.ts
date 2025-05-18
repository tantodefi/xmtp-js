import type { Signer } from "@xmtp/browser-sdk";
import { toBytes, type Hex, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Utility function to detect if a provider is a LUKSO Universal Profile provider
 */
export const isLuksoUPProvider = (provider: any): boolean => {
  if (!provider) return false;
  
  // Log provider details for debugging
  console.log("Provider inspection:", {
    isLukso: provider.isLukso,
    isUP: provider.isUP,
    isWindowLukso: window.lukso === provider,
    hasWindowLukso: !!window.lukso,
    methods: Object.keys(provider).filter(method => 
      typeof provider[method] === 'function')
      .slice(0, 10), // Just log first 10 methods to avoid spam
    providerId: provider.providerId,
    hasLsp: provider.lsp !== undefined,
    // Additional checks
    isUMD: provider.isUMD,
    chainId: provider.chainId,
    networkVersion: provider.networkVersion,
    selectedAddress: provider.selectedAddress,
  });
  
  // Enhanced LUKSO detection
  // Check if this is a LUKSO UP provider with more possible conditions
  return (
    provider.isLukso === true || 
    provider.isUP === true || 
    provider.isUMD === true ||
    (window.lukso !== undefined && provider === window.lukso) ||
    (typeof provider.networkVersion === 'string' && provider.networkVersion === '42') ||
    (typeof provider.chainId === 'string' && provider.chainId === '0x2a') ||
    (provider.providerId && provider.providerId.toLowerCase().includes('lukso')) ||
    provider.lsp !== undefined || // LUKSO has LSP namespace
    (provider.selectedAddress && 
     typeof provider.selectedAddress === 'string' && 
     provider.selectedAddress.toLowerCase().startsWith('0x')) // Additional check for UP address
  );
};

// Add type definition for LUKSO provider
interface LuksoProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  isLukso?: boolean;
  isUP?: boolean;
}

/**
 * Creates a signer for the XMTP protocol using a standard Ethereum wallet.
 * This function follows XMTP's strict Signer interface requirements.
 *
 * @param address - The Ethereum address
 * @param walletClient - The viem wallet client
 * @returns A Signer compatible with XMTP
 */
export const createStandardSigner = (
  address: `0x${string}`,
  walletClient: WalletClient,
): Signer => {
  // XMTP requires lowercase addresses
  const normalizedAddress = address.toLowerCase() as `0x${string}`;
  
  // This signer closely follows the template from XMTP documentation
  return {
    // Must be exactly "EOA" for standard wallets
    type: "EOA" as const,
    
    // Returns the blockchain address for this signer
    getIdentifier: async () => {
      return {
        identifierKind: "Ethereum" as const,
        identifier: normalizedAddress,
      };
    },
    
    // Signs a message and returns the signature as bytes
    signMessage: async (message: string): Promise<Uint8Array> => {
      console.log("Standard signer signing message:", message);
      try {
        const signature = await walletClient.signMessage({
          account: normalizedAddress,
          message,
        });
        console.log("Signature obtained:", signature);
        return toBytes(signature);
      } catch (error) {
        console.error("Error signing message with standard method:", error);
        throw error;
      }
    },
  };
};

// Create a specialized LUKSO UP signer that conforms exactly to XMTP requirements
export const createLuksoSigner = (
  address: `0x${string}`,
  walletClient: WalletClient,
): Signer => {
  // Make absolutely sure the address is lowercase - XMTP is strict about this
  const normalizedAddress = address.toLowerCase() as `0x${string}`;
  
  return {
    // XMTP only officially supports EOA and SCW types
    type: "EOA",
    
    // This method must return an object with identifier and identifierKind
    getIdentifier: () => {
      console.log("Getting identifier for LUKSO signer:", normalizedAddress);
      return {
        identifier: normalizedAddress,
        identifierKind: "Ethereum" as const, // Must be exact string "Ethereum"
      };
    },
    
    // This method must accept a string and return a Uint8Array
    signMessage: async (message: string): Promise<Uint8Array> => {
      console.log("LUKSO signer signing message:", message);
      
      try {
        // Primary signing method
        const signature = await walletClient.signMessage({
          account: normalizedAddress,
          message,
        });
        
        // Convert to bytes - XMTP expects Uint8Array
        console.log("LUKSO signature obtained:", signature);
        return toBytes(signature);
      } catch (error) {
        console.error("Primary signing method failed:", error);
        
        // Fallback method using window.lukso directly
        try {
          const provider = window.lukso;
          
          if (!provider) {
            throw new Error("No LUKSO provider available");
          }
          
          const signature = await provider.request({
            method: 'personal_sign',
            params: [message, normalizedAddress],
          });
          
          console.log("LUKSO signature via window.lukso:", signature);
          return toBytes(signature as `0x${string}`);
        } catch (providerError) {
          console.error("LUKSO fallback signing failed:", providerError);
          throw new Error(`Failed to sign message with LUKSO UP: ${(providerError as Error).message}`);
        }
      }
    },
  };
};

export const createEphemeralSigner = (privateKey: Hex): Signer => {
  const account = privateKeyToAccount(privateKey);
  return {
    type: "EOA",
    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: "Ethereum",
    }),
    signMessage: async (message: string) => {
      const signature = await account.signMessage({
        message,
      });
      return toBytes(signature);
    },
  };
};

export const createEOASigner = (
  address: `0x${string}`,
  walletClient: WalletClient,
): Signer => {
  return {
    type: "EOA",
    getIdentifier: () => ({
      identifier: address.toLowerCase(),
      identifierKind: "Ethereum",
    }),
    signMessage: async (message: string) => {
      const signature = await walletClient.signMessage({
        account: address,
        message,
      });
      return toBytes(signature);
    },
  };
};

// Supported chain IDs for XMTP
const SUPPORTED_CHAIN_IDS = new Set([
  '1',      // Ethereum Mainnet
  '8453',   // Base
  '42161',  // Arbitrum
  '10',     // Optimism
  '137',    // Polygon
  '324',    // zkSync
  '59144',  // Linea
  '42'      // LUKSO
]);

/**
 * Creates a Smart Contract Wallet signer for XMTP that works with LUKSO Universal Profile.
 * This follows the XMTP SCW signer specification exactly.
 *
 * @param address - The Universal Profile address
 * @param chainId - The chain ID (LUKSO mainnet = 42, LUKSO testnet = 4201)
 * @returns A Signer compatible with XMTP's SCW requirements
 */
export const createSCWSigner = (
  address: `0x${string}`,
  chainId: string | number
): Signer => {
  // Convert chainId to string for comparison
  const chainIdStr = chainId.toString();
  
  // Validate chain ID
  if (!SUPPORTED_CHAIN_IDS.has(chainIdStr)) {
    console.warn(`Chain ID ${chainIdStr} is not officially supported by XMTP. This may cause issues.`);
  }

  // Initialize block number cache
  let cachedBlockNumber = BigInt(0);
  let lastBlockFetch = 0;
  const BLOCK_CACHE_DURATION = 10000; // 10 seconds

  // Clone the provider to avoid mutation issues and ensure it has the request method
  if (!window.lukso?.request) {
    throw new Error("LUKSO provider not available or missing request method");
  }
  const provider = window.lukso as LuksoProvider & { request: NonNullable<LuksoProvider['request']> };

  // Pre-fetch block number without awaiting
  const prefetchBlockNumber = async () => {
    try {
      const blockNumber = await provider.request({ method: 'eth_blockNumber' });
      cachedBlockNumber = BigInt(blockNumber);
      lastBlockFetch = Date.now();
    } catch (error) {
      console.warn('Failed to prefetch block number:', error);
    }
  };
  prefetchBlockNumber();

  return {
    type: "SCW",
    getIdentifier: () => ({
      identifier: address.toLowerCase(),
      identifierKind: "Ethereum",
    }),
    signMessage: async (message: string) => {
      try {
        console.log("SCW signer: Signing message with LUKSO provider");
        
        // Add Ethereum prefix to message if not already present
        const prefixedMessage = message.startsWith('\x19Ethereum Signed Message:\n') 
          ? message 
          : `\x19Ethereum Signed Message:\n${message.length}${message}`;

        // Request signature from LUKSO provider
        const signature = await provider.request({
          method: 'personal_sign',
          params: [prefixedMessage, address],
        });

        console.log("SCW signer: Signature obtained:", signature);

        // Convert hex signature to Uint8Array
        const signatureBytes = new Uint8Array(Buffer.from(signature.slice(2), 'hex'));
        
        // Log signature details for debugging
        console.log("SCW signer: Signature details:", {
          length: signatureBytes.length,
          hex: signature,
          address,
          chainId: chainIdStr
        });

        return signatureBytes;
      } catch (error) {
        console.error('Error signing message with SCW:', error);
        throw new Error(`SCW signature failed: ${(error as Error).message}`);
      }
    },
    getChainId: () => {
      return BigInt(chainId);
    },
    getBlockNumber: () => {
      // Return cached block number
      return cachedBlockNumber;
    }
  };
};

/* --------------- MINIMAL SIGNER FOR DEBUGGING --------------- */

/**
 * This is a minimal signer implementation following XMTP documentation
 * strictly. It avoids any extra functionality that might confuse
 * the XMTP client's validation.
 */
export const createMinimalSigner = (
  address: `0x${string}`,
  walletClient: WalletClient,
): Signer => {
  // Ensure address is lowercase
  const normalizedAddress = address.toLowerCase();
  
  return {
    // Type must be one of the allowed values
    type: "EOA" as const,
    
    // Return the blockchain address identifier in the exact format XMTP expects
    getIdentifier: async () => {
      return {
        identifierKind: "Ethereum" as const,
        identifier: normalizedAddress,
      };
    },
    
    // Sign a message and return bytes
    signMessage: async (message: string): Promise<Uint8Array> => {
      console.log("Minimal signer signing message:", message);
      
      // Use wallet to sign
      const signature = await walletClient.signMessage({
        account: address,
        message,
      });
      
      // Convert hex signature to Uint8Array
      return toBytes(signature);
    }
  };
};

/* --------------- DIRECT LUKSO PROVIDER SIGNER --------------- */

/**
 * This creates a direct signer implementation that works with the LUKSO provider
 * without any wagmi abstraction. It addresses the "Unknown signer" error.
 */
export const createDirectLuksoSigner = (
  address: `0x${string}`,
): Signer => {
  if (!window.lukso) {
    throw new Error("LUKSO provider not available");
  }
  
  // Get LUKSO provider directly
  const provider = window.lukso;

  // Ensure address is lowercase
  const normalizedAddress = address.toLowerCase();
  
  // Important - define these properties directly in the object literal
  // Do not use methods or computed properties to avoid validation issues
  const signer: Signer = {
    type: "EOA",
    getIdentifier: async function() {
      console.log("Direct LUKSO signer: getIdentifier called");
      return {
        identifierKind: "Ethereum",
        identifier: normalizedAddress
      };
    },
    signMessage: async function(message) {
      console.log("Direct LUKSO signer: signMessage called with", message);
      
      // Use personal_sign which UP/LUKSO supports
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, normalizedAddress]
      });
      
      console.log("Direct LUKSO signature obtained:", signature);
      return toBytes(signature as `0x${string}`);
    }
  };
  
  return signer;
};

/* --------------- SIGNERS FOR LUKSO --------------- */

/**
 * A basic UP signer implementation that follows XMTP documentation exactly
 * This is optimized for compatibility, not features
 */
export const createUPSigner = (
  address: `0x${string}`
): Signer => {
  // Ensure address is lowercase as required by XMTP
  const normalizedAddress = address.toLowerCase() as `0x${string}`;
  
  // Verify lukso provider is available
  if (!window.lukso || typeof window.lukso.request !== 'function') {
    throw new Error("LUKSO provider not available or missing request method");
  }
  
  // Clone the provider to a local constant to satisfy TypeScript
  const provider = window.lukso;
  
  return {
    // Exact type string required by XMTP
    type: "EOA" as const,
    
    // Non-async getIdentifier that returns the exact format XMTP expects
    getIdentifier: () => ({
      identifierKind: "Ethereum" as const,
      identifier: normalizedAddress,
    }),
    
    // Sign messages with the UP extension
    signMessage: async (message: string): Promise<Uint8Array> => {
      if (!provider || typeof provider.request !== 'function') {
        throw new Error("LUKSO provider not available for signing");
      }
      
      try {
        // Use personal_sign which is supported by UP
        const signature = await provider.request({
          method: 'personal_sign',
          params: [message, normalizedAddress]
        });
        
        return toBytes(signature as `0x${string}`);
      } catch (error) {
        throw error;
      }
    }
  };
};

/**
 * This creates a proxy ephemeral signer that transparently works with LUKSO UP
 * by using an ephemeral key internally but representing the LUKSO address identity.
 * This approach bypasses the provider abstraction issues.
 */
export const createProxyEphemeralSigner = (
  address: `0x${string}`,
): Signer => {
  // Generate a random private key for signing with proper 0x prefix
  const randomHex = new Array(64).fill(0).map(() => 
    "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  const tempPrivateKey = `0x${randomHex}` as Hex;
  
  console.log("Generated private key with format:", {
    length: tempPrivateKey.length,
    hasPrefix: tempPrivateKey.startsWith('0x'),
    isHex: /^0x[0-9a-f]{64}$/i.test(tempPrivateKey)
  });
  
  // Create an ephemeral account with this key
  const ephemeralAccount = privateKeyToAccount(tempPrivateKey);
  
  // Ensure UP address is lowercase - XMTP requires this
  const normalizedAddress = address.toLowerCase();
  
  console.log("Creating proxy ephemeral signer for UP address:", normalizedAddress);
  
  // This signer follows XMTP's required interface exactly
  return {
    // Type must be exactly "EOA" (case sensitive)
    type: "EOA",
    
    // IMPORTANT: getIdentifier must NOT be async for XMTP
    getIdentifier: () => ({
      identifierKind: "Ethereum",
      identifier: normalizedAddress,
    }),
    
    // Sign with the ephemeral key
    signMessage: async (message: string): Promise<Uint8Array> => {
      console.log("Proxy signer signing message with ephemeral key:", message);
      
      // Sign using the ephemeral account
      const signature = await ephemeralAccount.signMessage({
        message,
      });
      
      console.log("Proxy signature obtained:", signature);
      return toBytes(signature);
    }
  };
};
