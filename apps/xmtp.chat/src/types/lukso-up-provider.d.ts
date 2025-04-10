declare module '@lukso/up-provider' {
  export interface ClientUPProvider {
    on(eventName: string, listener: (...args: any[]) => void): void;
    removeListener(eventName: string, listener: (...args: any[]) => void): void;
    request(method: string, params?: any[]): Promise<any>;
    allowedAccounts: `0x${string}`[];
    contextAccounts: `0x${string}`[];
  }

  export function createClientUPProvider(): ClientUPProvider;

  export interface UPClientChannel {
    enabled: boolean;
    accounts: `0x${string}`[];
    chainId: number;
    contextAccounts: `0x${string}`[];
    setAllowedAccounts(addresses: `0x${string}`[]): void;
    setChainId(chainId: number): void;
    setContextAccounts(addresses: `0x${string}`[]): void;
    setupChannel(
      enable: boolean,
      accounts: `0x${string}`[],
      contextAccounts: `0x${string}`[],
      chainId: number
    ): void;
  }

  export interface UPProviderConnector {
    on(eventName: 'channelCreated', listener: (data: { channel: UPClientChannel, id: string }) => void): void;
    setAllowedAccounts(addresses: `0x${string}`[]): void;
    setChainId(chainId: number): void;
    setContextAccounts(addresses: `0x${string}`[]): void;
    setupProvider(provider: any, rpcUrls: string[]): void;
  }

  export function createUPProviderConnector(provider: any, rpcUrls: string[]): UPProviderConnector;
} 