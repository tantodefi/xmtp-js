export const UniversalProfileArtifact = {
  abi: [
    {
      inputs: [
        {
          internalType: "bytes32",
          name: "_key",
          type: "bytes32",
        },
        {
          internalType: "bytes",
          name: "_value",
          type: "bytes",
        },
      ],
      name: "setData",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "bytes32",
          name: "_key",
          type: "bytes32",
        },
      ],
      name: "getData",
      outputs: [
        {
          internalType: "bytes",
          name: "",
          type: "bytes",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "operationType",
          type: "uint256",
        },
        {
          internalType: "address",
          name: "to",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256",
        },
        {
          internalType: "bytes",
          name: "data",
          type: "bytes",
        },
      ],
      name: "execute",
      outputs: [
        {
          internalType: "bytes",
          name: "",
          type: "bytes",
        },
      ],
      stateMutability: "payable",
      type: "function",
    },
  ],
}; 