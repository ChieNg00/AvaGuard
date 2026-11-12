// Generated from the Forge RiskRegistry artifact.
export const registryAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "initialOwner",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "acceptOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "attesters",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReport",
    inputs: [
      {
        name: "reportHash",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct RiskRegistry.Commitment",
        components: [
          {
            name: "report",
            type: "tuple",
            internalType: "struct RiskRegistry.Publication",
            components: [
              {
                name: "target",
                type: "address",
                internalType: "address",
              },
              {
                name: "score",
                type: "uint8",
                internalType: "uint8",
              },
              {
                name: "codehash",
                type: "bytes32",
                internalType: "bytes32",
              },
              {
                name: "implementation",
                type: "address",
                internalType: "address",
              },
              {
                name: "reportHash",
                type: "bytes32",
                internalType: "bytes32",
              },
              {
                name: "rulesetVersion",
                type: "uint32",
                internalType: "uint32",
              },
              {
                name: "blockNumber",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "blockHash",
                type: "bytes32",
                internalType: "bytes32",
              },
            ],
          },
          {
            name: "attester",
            type: "address",
            internalType: "address",
          },
          {
            name: "publishedAt",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isCodeStale",
    inputs: [
      {
        name: "reportHash",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "latestReport",
    inputs: [
      {
        name: "target",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct RiskRegistry.Commitment",
        components: [
          {
            name: "report",
            type: "tuple",
            internalType: "struct RiskRegistry.Publication",
            components: [
              {
                name: "target",
                type: "address",
                internalType: "address",
              },
              {
                name: "score",
                type: "uint8",
                internalType: "uint8",
              },
              {
                name: "codehash",
                type: "bytes32",
                internalType: "bytes32",
              },
              {
                name: "implementation",
                type: "address",
                internalType: "address",
              },
              {
                name: "reportHash",
                type: "bytes32",
                internalType: "bytes32",
              },
              {
                name: "rulesetVersion",
                type: "uint32",
                internalType: "uint32",
              },
              {
                name: "blockNumber",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "blockHash",
                type: "bytes32",
                internalType: "bytes32",
              },
            ],
          },
          {
            name: "attester",
            type: "address",
            internalType: "address",
          },
          {
            name: "publishedAt",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pendingOwner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "publish",
    inputs: [
      {
        name: "p",
        type: "tuple",
        internalType: "struct RiskRegistry.Publication",
        components: [
          {
            name: "target",
            type: "address",
            internalType: "address",
          },
          {
            name: "score",
            type: "uint8",
            internalType: "uint8",
          },
          {
            name: "codehash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "implementation",
            type: "address",
            internalType: "address",
          },
          {
            name: "reportHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "rulesetVersion",
            type: "uint32",
            internalType: "uint32",
          },
          {
            name: "blockNumber",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "blockHash",
            type: "bytes32",
            internalType: "bytes32",
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "reportCount",
    inputs: [
      {
        name: "target",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "reportHashAt",
    inputs: [
      {
        name: "target",
        type: "address",
        internalType: "address",
      },
      {
        name: "index",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setAttester",
    inputs: [
      {
        name: "attester",
        type: "address",
        internalType: "address",
      },
      {
        name: "allowed",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [
      {
        name: "newOwner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "AttesterUpdated",
    inputs: [
      {
        name: "attester",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "allowed",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferStarted",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ReportPublished",
    inputs: [
      {
        name: "target",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "reportHash",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "attester",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "score",
        type: "uint8",
        indexed: false,
        internalType: "uint8",
      },
      {
        name: "codehash",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
      {
        name: "implementation",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "rulesetVersion",
        type: "uint32",
        indexed: false,
        internalType: "uint32",
      },
      {
        name: "blockNumber",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
      {
        name: "blockHash",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
      {
        name: "publishedAt",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "CodehashMismatch",
    inputs: [],
  },
  {
    type: "error",
    name: "DuplicateReport",
    inputs: [],
  },
  {
    type: "error",
    name: "EmptyTarget",
    inputs: [],
  },
  {
    type: "error",
    name: "FutureSnapshot",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidScore",
    inputs: [],
  },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "UnauthorizedAttester",
    inputs: [],
  },
  {
    type: "error",
    name: "UnknownReport",
    inputs: [],
  },
] as const;
export const registryRuntimeHash =
  "0x4fae2a424c444bfdc1c89924898d33a63b25b30a5ece9ed3bb4c1fbe96397b38" as const;
