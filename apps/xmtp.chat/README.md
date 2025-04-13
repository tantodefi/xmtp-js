# xmtp.chat app

Use this React app as a tool to start building an app with XMTP.

The app is built using the [XMTP client browser SDK](/sdks/browser-sdk/README.md), [React](https://react.dev/), and [RainbowKit](https://www.rainbowkit.com/).

**Try it live: [XMTP Chat with Universal Profile](https://xmtp-chat-up.vercel.app/welcome)**

To keep up with the latest React app developments, see the [Issues tab](https://github.com/xmtp/xmtp-js/issues) in this repo.

To learn more about XMTP and get answers to frequently asked questions, see the [XMTP documentation](https://xmtp.org/docs).

## Features

### Cross-Chain Identity Resolution

The app supports comprehensive identity resolution across multiple networks:

- **Two-way ENS resolution**: Automatically resolves Ethereum Name Service (ENS) names to addresses and addresses to ENS names, providing human-readable identifiers in the chat interface.
- **Universal Profile search**: Easily find and start conversations with LUKSO Universal Profile users through an integrated search function.
- **Multi-chain identity support**: Leveraging the Whisk SDK, the app supports multiple identity systems including ENS, LUKSO UP, Lens Protocol, Farcaster, and other on-chain identities, creating a unified messaging experience across the web3 ecosystem.

### Universal Profile Address Book Integration

The app includes a comprehensive contacts management system with LUKSO Universal Profile integration:

- **Sync contacts with UP metadata**: Contacts are stored in the user's Universal Profile, maintaining sovereignty and control over their data.
- **Automatic follower import**: UP followers are automatically imported to your contact list, creating a natural social network within the chat application.
- **Redundant storage**: Contact data is stored both locally and in the UP metadata, providing redundancy and enabling restoration across devices.
- **Unified naming system**: Custom contact names are synced between the local address book and UP metadata, ensuring consistent naming across devices and sessions.
- **Intuitive UI**: Simple backup and sync buttons in the conversations sidebar make managing your contacts effortless.

## Built With

This application leverages the following technologies and packages:

### Core Technologies

- [React](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vite](https://vitejs.dev/) - Fast build tooling

### Web3 Integration

- [@xmtp/browser-sdk](https://github.com/xmtp/xmtp-js/tree/main/sdks/browser-sdk) - XMTP messaging client
- [Ethers.js](https://docs.ethers.org/v6/) - Ethereum utility library
- [Wagmi](https://wagmi.sh/) - React hooks for Ethereum
- [RainbowKit](https://www.rainbowkit.com/) - Wallet connection UI

### Identity Systems

- [@paperclip-labs/whisk-sdk](https://www.npmjs.com/package/@paperclip-labs/whisk-sdk) - Multi-chain identity resolution
- [@erc725/erc725.js](https://docs.lukso.tech/tools/erc725js/getting-started) - Universal Profile interaction
- [@lukso/up-provider](https://www.npmjs.com/package/@lukso/up-provider) - LUKSO Universal Profile provider

### UI Framework

- [@mantine/core](https://mantine.dev/) - UI component library
- [@tabler/icons-react](https://tabler-icons.io/) - Icon library

### Storage

- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (via browser) - Local storage
- [LUKSO Universal Profile Metadata](https://docs.lukso.tech/standards/universal-profile/lsp3-profile-metadata) - Decentralized storage

### Limitations

This React app isn't a complete solution. For example, the list of conversations doesn't update when new messages arrive in existing conversations.

## Useful commands

- `yarn clean`: Removes `node_modules` and `.turbo` folders
- `yarn dev`: Runs the app in development mode
- `yarn typecheck`: Runs `tsc`
