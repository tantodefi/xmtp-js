import "@mantine/core/styles.css";
import "./globals.css";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { createConfig, http, WagmiProvider } from "wagmi";
import {
  coinbaseWallet,
  injected,
  metaMask,
  walletConnect,
} from "wagmi/connectors";
import { App } from "@/components/App/App";
import { XMTPProvider } from "@/contexts/XMTPContext";

// Define all chain types locally
const mainnet = {
  id: 1,
  name: 'Ethereum',
  network: 'homestead',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['https://cloudflare-eth.com'] },
    default: { http: ['https://cloudflare-eth.com'] },
  },
} as const;

const sepolia = {
  id: 11155111,
  name: 'Sepolia',
  network: 'sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Sepolia Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['https://rpc.sepolia.org'] },
    default: { http: ['https://rpc.sepolia.org'] },
  },
} as const;

const base = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['https://mainnet.base.org'] },
    default: { http: ['https://mainnet.base.org'] },
  },
} as const;

const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['https://sepolia.base.org'] },
    default: { http: ['https://sepolia.base.org'] },
  },
} as const;

// Define LUKSO chains
const luksoMainnet = {
  id: 42,
  name: 'LUKSO Mainnet',
  network: 'lukso',
  nativeCurrency: {
    decimals: 18,
    name: 'LYX',
    symbol: 'LYX',
  },
  rpcUrls: {
    public: { http: ['https://rpc.mainnet.lukso.network'] },
    default: { http: ['https://rpc.mainnet.lukso.network'] },
  },
} as const;

const luksoTestnet = {
  id: 4201,
  name: 'LUKSO Testnet',
  network: 'lukso-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'LYXt',
    symbol: 'LYXt',
  },
  rpcUrls: {
    public: { http: ['https://rpc.testnet.lukso.network'] },
    default: { http: ['https://rpc.testnet.lukso.network'] },
  },
} as const;

const queryClient = new QueryClient();

export const config = createConfig({
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "xmtp.chat",
    }),
    metaMask(),
    walletConnect({ projectId: import.meta.env.VITE_PROJECT_ID }),
  ],
  chains: [mainnet, base, sepolia, baseSepolia, luksoMainnet, luksoTestnet],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [luksoMainnet.id]: http(),
    [luksoTestnet.id]: http(),
  },
});

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <BrowserRouter>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <MantineProvider>
            <XMTPProvider>
              <App />
            </XMTPProvider>
          </MantineProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </BrowserRouter>,
  );
}
