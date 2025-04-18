# XMTP TypeScript

This is the official repository for XMTP client SDKs, content types, and packages, written in TypeScript and powered by [Turborepo](https://turbo.build/repo).

To learn more about the contents of this repository, see this README and the READMEs provided in each workspace directory.

## What's inside?

### Apps

- [`xmtp.chat`](apps/xmtp.chat): A demo XMTP chat application with extensive web3 identity support featuring:
  - **LUKSO Universal Profile integration** for contact management with follower import and metadata syncing
  - **Two-way ENS resolution** and name display
  - **Universal Profile search** for easy user discovery
  - **Multi-chain identity support** via Whisk SDK (ENS, LUKSO UP, Lens, Farcaster)
  - **Decentralized address book storage**
  
  Built with React, TypeScript, Mantine UI, Ethers.js, Wagmi, and ERC725.js.
  
  **[Try the live app](https://xmtp-chat-up.vercel.app/welcome)**

### SDKs

- [`node-sdk`](https://github.com/xmtp/xmtp-js/blob/main/sdks/node-sdk): XMTP client SDK for Node (V3 only)
- [`browser-sdk`](https://github.com/xmtp/xmtp-js/blob/main/sdks/browser-sdk): XMTP client SDK for browsers (V3 only)

### Content types

- [`content-type-primitives`](content-types/content-type-primitives): Primitives for building custom XMTP content types
- [`content-type-reaction`](content-types/content-type-reaction): Content type for reactions to messages
- [`content-type-read-receipt`](content-types/content-type-read-receipt): Content type for read receipts for messages
- [`content-type-remote-attachment`](content-types/content-type-remote-attachment): Content type for sending file attachments that are stored off-network
- [`content-type-reply`](content-types/content-type-reply): Content type for direct replies to messages
- [`content-type-text`](content-types/content-type-text): Content type for plain text messages
- [`content-type-transaction-reference`](content-types/content-type-transaction-reference): Content type for on-chain transaction references

## Contributing

See our [contribution guide](./CONTRIBUTING.md) to learn more about contributing to this project.
