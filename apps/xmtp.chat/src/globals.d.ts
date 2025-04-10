/// <reference types="vite/client" />

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.png" {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Add LUKSO chains to wagmi's Chain type
declare module "wagmi/chains" {
  interface ChainConfig {
    id: number;
    name: string;
    network: string;
    nativeCurrency: {
      decimals: number;
      name: string;
      symbol: string;
    };
    rpcUrls: {
      public: { http: string[] };
      default: { http: string[] };
    };
  }

  const luksoMainnet: ChainConfig;
  const luksoTestnet: ChainConfig;
}
