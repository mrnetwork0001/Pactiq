import { defineChain } from "viem";

export const qieMainnet = defineChain({
  id: 5656,
  name: "QIE Blockchain Mainnet",
  nativeCurrency: {
    decimals: 18,
    name: "QIE",
    symbol: "QIE",
  },
  rpcUrls: {
    default: {
      http: [
        "https://rpc-main1.qiblockchain.online/",
        "https://rpc-main2.qiblockchain.online/",
      ],
    },
    public: {
      http: ["https://rpc-main1.qiblockchain.online/"],
    },
  },
  blockExplorers: {
    default: {
      name: "QIE Explorer",
      url: "https://mainnet.qiblockchain.online",
    },
  },
});

export const PACTIQ_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_PACTIQ_CONTRACT_ADDRESS ||
  "0x5656000000000000000000000000000000005656";

export const PACTIQ_ABI = [
  {
    inputs: [
      { internalType: "string", name: "title", type: "string" },
      { internalType: "uint8", name: "category", type: "uint8" },
      { internalType: "uint256", name: "dailyStake", type: "uint256" },
      { internalType: "uint256", name: "totalDays", type: "uint256" },
      { internalType: "string", name: "qieId", type: "string" },
    ],
    name: "createPact",
    outputs: [{ internalType: "uint256", name: "pactId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "pactId", type: "uint256" },
      { internalType: "uint256", name: "dayIndex", type: "uint256" },
      { internalType: "bytes32", name: "proofHash", type: "bytes32" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "checkIn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "pactId", type: "uint256" }],
    name: "settlePact",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "pacts",
    outputs: [
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "address", name: "creator", type: "address" },
      { internalType: "string", name: "title", type: "string" },
      { internalType: "uint8", name: "category", type: "uint8" },
      { internalType: "uint256", name: "dailyStake", type: "uint256" },
      { internalType: "uint256", name: "totalDays", type: "uint256" },
      { internalType: "uint256", name: "startTime", type: "uint256" },
      { internalType: "uint256", name: "checkInCount", type: "uint256" },
      { internalType: "uint256", name: "lastCheckInDay", type: "uint256" },
      { internalType: "uint256", name: "totalStaked", type: "uint256" },
      { internalType: "uint8", name: "status", type: "uint8" },
      { internalType: "string", name: "qieId", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "communityRewardPool",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
