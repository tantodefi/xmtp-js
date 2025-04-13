// src/hooks/useStealthAddresses.ts
import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { 
  generateOneTimeStealthAddress,
  registerStealthKeys,
  announceStealthMessage,
  deriveStealthKeys,
  getDummyPrivateKey,
  isStealthAddressForUser,
  getStealthMetaAddress,
  watchAnnouncementsForUser
} from '@/utils/stealthAddresses';

export function useStealthAddresses() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [stealthMetaAddress, setStealthMetaAddress] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [viewingPrivateKey, setViewingPrivateKey] = useState<string | null>(null);
  
  // Initialize stealth meta-address when wallet is connected
  useEffect(() => {
    async function initStealthAddress() {
      if (!address || !walletClient) return;
      
      try {
        // In production, you would get these from the wallet
        // For this demo, we'll use a deterministic key derived from the address
        const dummyPrivateKey = getDummyPrivateKey(address);
        setViewingPrivateKey(dummyPrivateKey);
        
        // Derive public keys from the private key
        const { spendingPublicKey, viewingPublicKey } = deriveStealthKeys(dummyPrivateKey);
        
        // Generate the stealth meta-address
        const metaAddress = await getStealthMetaAddress({
          spendingPublicKey,
          viewingPublicKey
        });
        setStealthMetaAddress(metaAddress);
        
        // In a real implementation, we would check if the keys are registered
        // For now, we'll just set it to false initially
        setIsRegistered(false);
      } catch (error) {
        console.error('Error initializing stealth address:', error);
      }
    }
    
    initStealthAddress();
  }, [address, walletClient]);
  
  // Register stealth keys
  const registerKeys = useCallback(async () => {
    if (!address || !walletClient || !stealthMetaAddress) {
      return false;
    }
    
    setRegistrationStatus('pending');
    
    try {
      // Convert walletClient to ethers signer
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      
      // In a real implementation, these would be derived properly
      // For now, we'll use our helper function
      const dummyPrivateKey = getDummyPrivateKey(address);
      const { spendingPublicKey, viewingPublicKey } = deriveStealthKeys(dummyPrivateKey);
      
      await registerStealthKeys(signer, spendingPublicKey, viewingPublicKey);
      
      setIsRegistered(true);
      setRegistrationStatus('success');
      return true;
    } catch (error) {
      console.error('Error registering stealth keys:', error);
      setRegistrationStatus('error');
      return false;
    }
  }, [address, walletClient, stealthMetaAddress]);
  
  // Generate stealth address for sending message
  const generateStealthAddressForRecipient = useCallback(async (recipientMetaAddress: string) => {
    if (!recipientMetaAddress) return null;
    
    try {
      return await generateOneTimeStealthAddress(recipientMetaAddress);
    } catch (error) {
      console.error('Error generating stealth address:', error);
      return null;
    }
  }, []);
  
  // Announce message sent to stealth address
  const sendStealthAnnouncement = useCallback(async (stealthAddress: string, ephemeralPublicKey: string, viewTag: number) => {
    if (!address || !walletClient) return false;
    
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      
      await announceStealthMessage(signer, stealthAddress, ephemeralPublicKey, viewTag);
      return true;
    } catch (error) {
      console.error('Error announcing stealth message:', error);
      return false;
    }
  }, [address, walletClient]);
  
  // Watch for incoming stealth announcements
  useEffect(() => {
    if (!address || !walletClient || !viewingPrivateKey) return;
    
    console.log('Setting up stealth announcement watcher');
    
    const unwatch = watchAnnouncementsForUser({
      viewingPrivateKey,
      onAnnouncementsReceived: (newAnnouncements: any[]) => {
        console.log('New stealth announcements received:', newAnnouncements);
        
        // Filter announcements for this user
        const userAnnouncements = newAnnouncements.filter(announcement => 
          isStealthAddressForUser(
            announcement.stealthAddress,
            announcement.ephemeralPublicKey,
            announcement.viewTag,
            viewingPrivateKey
          )
        );
        
        if (userAnnouncements.length > 0) {
          console.log('Found stealth announcements for user:', userAnnouncements);
          setAnnouncements(prev => [...prev, ...userAnnouncements]);
        }
      }
    });
    
    return () => {
      if (unwatch) unwatch();
      console.log('Stealth announcement watcher cleaned up');
    };
  }, [address, walletClient, viewingPrivateKey]);
  
  // Check if a stealth address might belong to the user
  const checkStealthAddress = useCallback((stealthAddress: string, ephemeralPublicKey: string, viewTag: number) => {
    if (!viewingPrivateKey) return false;
    
    return isStealthAddressForUser(
      stealthAddress,
      ephemeralPublicKey,
      viewTag,
      viewingPrivateKey
    );
  }, [viewingPrivateKey]);
  
  return {
    stealthMetaAddress,
    isRegistered,
    registrationStatus,
    announcements,
    registerKeys,
    generateStealthAddressForRecipient,
    sendStealthAnnouncement,
    checkStealthAddress
  };
}
