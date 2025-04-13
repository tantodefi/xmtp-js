import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import {
  getLocalAddressBook,
  saveLocalAddressBook,
  syncAddressBook,
  saveAddressBookToUP,
  isAddressBookBackedUp,
  importFromCustomNames,
  getAddressBookFromUP,
  AddressBookData,
  AddressBookEntry
} from '@/utils/upAddressBook';

export function useAddressBook() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [addressBook, setAddressBook] = useState<AddressBookData>(getLocalAddressBook());
  const [isBackedUp, setIsBackedUp] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Check backup status when component mounts or address changes
  useEffect(() => {
    async function checkBackupStatus() {
      if (!address) return;
      
      try {
        const backed = await isAddressBookBackedUp(address);
        setIsBackedUp(backed);
      } catch (error) {
        console.error('Error checking backup status:', error);
        setIsBackedUp(false);
      }
    }

    checkBackupStatus();
  }, [address]);

  // Initialize address book from localStorage
  useEffect(() => {
    // Import from custom names on first load
    const imported = importFromCustomNames();
    setAddressBook(imported);
  }, []);

  // Sync address book with UP
  const handleSync = useCallback(async () => {
    if (!address) {
      setSyncError('No wallet connected');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const synced = await syncAddressBook(address);
      setAddressBook(synced);
      
      // Check backup status after sync
      const backed = await isAddressBookBackedUp(address);
      setIsBackedUp(backed);
      
      return synced;
    } catch (error) {
      console.error('Error syncing address book:', error);
      setSyncError('Failed to sync address book');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [address]);

  // Backup address book to UP
  const handleBackup = useCallback(async () => {
    if (!address || !walletClient) {
      setBackupError('No wallet connected or wallet client available');
      return false;
    }

    setIsBackingUp(true);
    setBackupError(null);
    
    try {
      // Make sure we're working with the latest local data
      const current = getLocalAddressBook();
      
      // Update the timestamp
      current.lastSynced = Date.now();
      
      // Convert walletClient to ethers signer - this is a simplified approach
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      
      // Save to UP
      const success = await saveAddressBookToUP(address, current, signer);
      
      if (success) {
        setIsBackedUp(true);
        return true;
      } else {
        setBackupError('Failed to save to Universal Profile');
        return false;
      }
    } catch (error) {
      console.error('Error backing up address book:', error);
      setBackupError('Error backing up address book');
      return false;
    } finally {
      setIsBackingUp(false);
    }
  }, [address, walletClient]);

  // Add or update an entry in the address book
  const addOrUpdateEntry = useCallback((entry: AddressBookEntry) => {
    const addr = entry.address.toLowerCase();
    
    setAddressBook(prev => {
      const updated: AddressBookData = {
        ...prev,
        entries: {
          ...prev.entries,
          [addr]: {
            ...entry,
            timestamp: Date.now(),
            source: entry.source || 'local'
          }
        },
        lastSynced: Date.now()
      };
      
      // Save to localStorage
      saveLocalAddressBook(updated);
      
      // After update, we're not backed up anymore
      setIsBackedUp(false);
      
      return updated;
    });
  }, []);

  // Remove an entry from the address book
  const removeEntry = useCallback((address: string) => {
    const addr = address.toLowerCase();
    
    setAddressBook(prev => {
      const { [addr]: removed, ...remaining } = prev.entries;
      
      const updated: AddressBookData = {
        ...prev,
        entries: remaining,
        lastSynced: Date.now()
      };
      
      // Save to localStorage
      saveLocalAddressBook(updated);
      
      // After update, we're not backed up anymore
      setIsBackedUp(false);
      
      return updated;
    });
  }, []);

  // Get an entry from the address book
  const getEntry = useCallback((address: string): AddressBookEntry | undefined => {
    const addr = address.toLowerCase();
    return addressBook.entries[addr];
  }, [addressBook]);

  // Restore address book from UP
  const restoreFromUP = useCallback(async () => {
    if (!address) {
      setSyncError('No wallet connected');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const upAddressBook = await getAddressBookFromUP(address);
      
      if (!upAddressBook) {
        setSyncError('No address book found in Universal Profile');
        return false;
      }
      
      // Update local address book with UP data
      setAddressBook(upAddressBook);
      saveLocalAddressBook(upAddressBook);
      
      setIsBackedUp(true);
      return true;
    } catch (error) {
      console.error('Error restoring from UP:', error);
      setSyncError('Failed to restore address book from Universal Profile');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [address]);

  return {
    addressBook,
    entries: Object.values(addressBook.entries),
    isBackedUp,
    isSyncing,
    isBackingUp,
    backupError,
    syncError,
    handleSync,
    handleBackup,
    addOrUpdateEntry,
    removeEntry,
    getEntry,
    restoreFromUP
  };
} 
