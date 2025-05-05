// Adapter to make ethers v6 Wallet compatible with XMTP browser SDK
import { Wallet } from 'ethers';

export function xmtpEthers6SignerAdapter(wallet: Wallet) {
  return {
    getAddress: async () => wallet.address,
    signMessage: async (message: string | Uint8Array) => {
      // ethers v6 Wallet.signMessage expects a string or Uint8Array
      return await wallet.signMessage(message);
    },
    // XMTP expects a getSignerType method for identity
    getSignerType: async () => 'local',
    // XMTP v3+ expects getIdentifier for identity (address in this case)
    getIdentifier: async () => wallet.address,
  };
}
