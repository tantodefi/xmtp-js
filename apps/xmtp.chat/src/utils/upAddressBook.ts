import { ethers } from 'ethers';
import { UniversalProfileArtifact } from '@/artifacts/UniversalProfile';

// Keys for storing data in UP metadata
const ADDRESS_BOOK_KEY = '0x6bc3f244db122dc9d843809e91f83deb22b3e9ef5b3f755cf58c6deeca71f02b'; // keccak256('address-book')
const FOLLOWERS_KEY = '0x6f357c6a820361fe0d713a0d7d14d3f7a9fc2dda7be8f740b8afc02f7c960cbc'; // keccak256('followers')
const XMTP_KEY = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5';

// LUKSO RPC endpoints
const RPC_ENDPOINTS = [
  'https://rpc.mainnet.lukso.network/',
  'https://lukso-mainnet.rpc.thirdweb.com/',
  'https://lukso.drpc.org',
  'https://lukso-mainnet.public.blastapi.io',
  'https://public-rpc.lukso.network/'
];

// Timeout for RPC requests
const RPC_TIMEOUT = 8000; // 8 seconds

// Helper function to timeout a promise
const withTimeout = function <T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>(function (_, reject) {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]);
};

export type AddressBookEntry = {
  address: string;
  name: string;
  timestamp: number;
  source?: string; // 'up-metadata', 'up-followers', 'local', etc.
};

export type AddressBookData = {
  version: string;
  entries: Record<string, AddressBookEntry>;
  lastSynced: number;
};

/**
 * Gets a working provider for LUKSO network
 */
async function getProvider(): Promise<ethers.JsonRpcProvider> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.JsonRpcProvider(endpoint);
      await withTimeout(provider.getNetwork(), RPC_TIMEOUT);
      console.log('Connected to RPC endpoint:', endpoint);
      return provider;
    } catch (error) {
      console.warn(`RPC endpoint ${endpoint} failed:`, error);
    }
  }
  throw new Error('All RPC endpoints failed, cannot connect to LUKSO network');
}

/**
 * Fetches Universal Profile followers
 * @param upAddress The Universal Profile address
 */
export async function getUpFollowers(upAddress: string): Promise<string[]> {
  try {
    console.log('Fetching UP followers for:', upAddress);
    const provider = await getProvider();
    
    const universalProfile = new ethers.Contract(
      upAddress,
      UniversalProfileArtifact.abi,
      provider
    );

    // Fetch followers data from UP metadata
    const followersData = await withTimeout(universalProfile.getData(FOLLOWERS_KEY), RPC_TIMEOUT);
    
    if (!followersData || followersData === '0x') {
      console.log('No followers data found');
      return [];
    }
    
    try {
      const decodedData = ethers.toUtf8String(followersData);
      const followersObj = JSON.parse(decodedData);
      
      if (Array.isArray(followersObj.followers)) {
        console.log(`Found ${followersObj.followers.length} followers`);
        return followersObj.followers;
      } else {
        console.log('Followers data not in expected format:', followersObj);
        return [];
      }
    } catch (error) {
      console.error('Error parsing followers data:', error);
      return [];
    }
  } catch (error) {
    console.error('Error getting UP followers:', error);
    return [];
  }
}

/**
 * Gets the address book from UP metadata
 * @param upAddress The Universal Profile address
 */
export async function getAddressBookFromUP(upAddress: string): Promise<AddressBookData | null> {
  try {
    console.log('Getting address book from UP metadata:', upAddress);
    const provider = await getProvider();
    
    const universalProfile = new ethers.Contract(
      upAddress,
      UniversalProfileArtifact.abi,
      provider
    );

    // Fetch address book data from UP metadata
    const addressBookData = await withTimeout(universalProfile.getData(ADDRESS_BOOK_KEY), RPC_TIMEOUT);
    
    if (!addressBookData || addressBookData === '0x') {
      console.log('No address book data found in UP metadata');
      return null;
    }
    
    try {
      const decodedData = ethers.toUtf8String(addressBookData);
      const addressBook = JSON.parse(decodedData) as AddressBookData;
      
      console.log(`Found address book with ${Object.keys(addressBook.entries).length} entries`);
      return addressBook;
    } catch (error) {
      console.error('Error parsing address book data:', error);
      return null;
    }
  } catch (error) {
    console.error('Error getting address book from UP:', error);
    return null;
  }
}

/**
 * Saves the address book to UP metadata
 * @param upAddress The Universal Profile address 
 * @param addressBook The address book data to save
 * @param signer An ethers signer with permissions to update the UP
 */
export async function saveAddressBookToUP(
  upAddress: string, 
  addressBook: AddressBookData,
  signer: ethers.Signer
): Promise<boolean> {
  try {
    console.log('Saving address book to UP metadata:', upAddress);
    
    // Convert address book to JSON string, then to bytes
    const addressBookJson = JSON.stringify(addressBook);
    const addressBookBytes = ethers.toUtf8Bytes(addressBookJson);
    
    const universalProfile = new ethers.Contract(
      upAddress,
      UniversalProfileArtifact.abi,
      signer
    );

    // Call the setData function to update the metadata
    const tx = await universalProfile.setData(ADDRESS_BOOK_KEY, addressBookBytes);
    await tx.wait();
    
    console.log('Address book saved to UP metadata successfully');
    return true;
  } catch (error) {
    console.error('Error saving address book to UP:', error);
    return false;
  }
}

/**
 * Gets the current address book from localStorage
 */
export function getLocalAddressBook(): AddressBookData {
  try {
    const localDataStr = localStorage.getItem('xmtp_address_book');
    if (localDataStr) {
      return JSON.parse(localDataStr) as AddressBookData;
    }
  } catch (error) {
    console.error('Error reading local address book:', error);
  }
  
  // Return empty address book if none exists
  return {
    version: "1.0",
    entries: {},
    lastSynced: 0
  };
}

/**
 * Saves the address book to localStorage
 */
export function saveLocalAddressBook(addressBook: AddressBookData): void {
  try {
    localStorage.setItem('xmtp_address_book', JSON.stringify(addressBook));
  } catch (error) {
    console.error('Error saving local address book:', error);
  }
}

/**
 * Imports address book entries from the custom names in localStorage
 * This converts the existing EditableAnonBadge custom names to address book entries
 */
export function importFromCustomNames(): AddressBookData {
  try {
    const customNamesStr = localStorage.getItem('xmtp_custom_address_names_v2');
    if (!customNamesStr) return getLocalAddressBook();
    
    const customNames = JSON.parse(customNamesStr);
    const addressBook = getLocalAddressBook();
    
    // Convert custom names to address book entries
    for (const [key, entry] of Object.entries(customNames)) {
      // Skip conversation-specific names (they contain underscores)
      if (key.includes('_')) continue;
      
      // Only use global names
      const address = key.toLowerCase();
      const { name, timestamp } = entry as { name: string, timestamp: number };
      
      addressBook.entries[address] = {
        address,
        name,
        timestamp,
        source: 'local'
      };
    }
    
    saveLocalAddressBook(addressBook);
    return addressBook;
  } catch (error) {
    console.error('Error importing from custom names:', error);
    return getLocalAddressBook();
  }
}

/**
 * Merges local and UP address books and followers
 * @param upAddress The Universal Profile address
 */
export async function syncAddressBook(upAddress: string): Promise<AddressBookData> {
  try {
    console.log('Syncing address book for UP:', upAddress);
    
    // Get local address book first
    let mergedAddressBook = importFromCustomNames();
    
    // Get address book from UP
    const upAddressBook = await getAddressBookFromUP(upAddress);
    if (upAddressBook) {
      // Merge entries from UP
      for (const [address, entry] of Object.entries(upAddressBook.entries)) {
        // Only overwrite if UP entry is newer or local entry doesn't exist
        if (!mergedAddressBook.entries[address] || 
            entry.timestamp > mergedAddressBook.entries[address].timestamp) {
          mergedAddressBook.entries[address] = {
            ...entry,
            source: 'up-metadata'
          };
        }
      }
    }
    
    // Get followers and add them to address book
    const followers = await getUpFollowers(upAddress);
    for (const follower of followers) {
      const address = follower.toLowerCase();
      if (!mergedAddressBook.entries[address]) {
        // Only add if not already in address book
        mergedAddressBook.entries[address] = {
          address,
          name: `Follower-${address.substring(0, 6)}`,
          timestamp: Date.now(),
          source: 'up-followers'
        };
      }
    }
    
    // Update sync timestamp
    mergedAddressBook.lastSynced = Date.now();
    
    // Save merged address book locally
    saveLocalAddressBook(mergedAddressBook);
    
    return mergedAddressBook;
  } catch (error) {
    console.error('Error syncing address book:', error);
    return getLocalAddressBook();
  }
}

/**
 * Checks if the address book is backed up to the UP profile
 * @param upAddress The Universal Profile address
 */
export async function isAddressBookBackedUp(upAddress: string): Promise<boolean> {
  try {
    const upAddressBook = await getAddressBookFromUP(upAddress);
    if (!upAddressBook) return false;
    
    const localAddressBook = getLocalAddressBook();
    
    // Check if all local entries exist in UP
    const localEntries = Object.keys(localAddressBook.entries);
    if (localEntries.length === 0) return true; // Consider empty address book as backed up
    
    const upEntries = Object.keys(upAddressBook.entries);
    
    // Check if UP has at least as many entries as local
    if (upEntries.length < localEntries.length) return false;
    
    // Check if UP's last sync time is recent enough (within a day)
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    if (upAddressBook.lastSynced < now - dayInMs) return false;
    
    return true;
  } catch (error) {
    console.error('Error checking if address book is backed up:', error);
    return false;
  }
} 
