# xmtp.chat app

## Decentralized Identity & Messaging for LUKSO and XMTP

**xmtp.chat** is a next-generation dApp that brings together [XMTP](https://xmtp.org/) and [LUKSO Universal Profiles](https://docs.lukso.tech/essentials/universal-profile/) to enable truly decentralized, cross-platform messaging and identity. By combining XMTP's secure, open messaging protocol with LUKSO's Universal Profile standard, users gain full ownership of their communications and on-chain identity—no centralized gatekeepers, no walled gardens.

> **Learn more about decentralized identity and XMTP:** [https://xmtp.org/identity](https://xmtp.org/identity)

---

## Features

- **LUKSO Universal Profile Support**: Connect with your UP wallet and message using your on-chain identity.
- **Grid Mini-App Compatibility**: Seamlessly operate as a mini-app within Universal Profile grids—`contextAccounts[0]` is the visitor, `contextAccounts[1]` is the grid owner.
- **ENS Lookup**: Send messages using Ethereum Name Service (ENS) names for easy addressing.
- **XMTP Messaging**: End-to-end encrypted, decentralized messaging using the XMTP protocol.
- **Profile Avatars & Names**: Fetch and display LUKSO or ENS profile data, including avatars and display names.
- **WalletConnect, MetaMask, Coinbase, and Universal Profile Extension Support**: Flexible wallet connection options.
- **Dynamic Context Awareness**: Detects if loaded as a grid mini-app or standalone, and adapts UI accordingly.
- **Feedback & Issue Reporting**: Built-in links to provide feedback and report issues.

---

## Getting Started

The app is built using the [XMTP client browser SDK](/sdks/browser-sdk/README.md), [React](https://react.dev/), and [RainbowKit](https://www.rainbowkit.com/). It is ready for both LUKSO and Ethereum environments.

- To keep up with the latest React app developments, see the [Issues tab](https://github.com/xmtp/xmtp-js/issues) in this repo.
- To learn more about XMTP and get answers to frequently asked questions, see the [XMTP documentation](https://xmtp.org/docs).

## Useful commands

- `yarn clean`: Removes `node_modules` and `.turbo` folders
- `yarn dev`: Runs the app in development mode
- `yarn typecheck`: Runs `tsc`

---

## Limitations

This React app isn't a complete solution. For example, the list of conversations doesn't update when new messages arrive in existing conversations.

---

## Contributing

We welcome contributions and feedback! Please open an issue or submit a pull request if you'd like to help improve the app.
