/**
 * dashboard/src/shared/constants.ts
 * ─────────────────────────────────────────────────────────────
 * After every `npm run deploy`, update the addresses below.
 * After minting, update AGENT_PROFILES with correct token IDs.
 * ─────────────────────────────────────────────────────────────
 */

// ── Deployed contract addresses ───────────────────────────────────────────────
export const AGENT_IDENTITY_ADDRESS  = "0x871A5A7540237Ea1D07F31fb547fB620ae5E0139";
export const SIMPLE_ECONOMY_ADDRESS  = "0x51A0e1607e90a5f42E8193C7fCbf2e4Ee5541Fa8";
export const WORKER_ADDRESS          = "0x79EE8E925bCAD1b87dCD4bb0cB6dB13E5BDE19C6";
export const CONSUMER_ADDRESS        = "0x0e1ceE04C05CF4f173C1e4075b3f25416e0385e3";

// ── Static agent profiles (set once after minting, never changes) ─────────────
// tokenId comes from `npm run mint` output or `npm run deploy` output.
export const AGENT_PROFILES: Record<string, {
  name: string;
  role: "WORKER" | "CONSUMER";
  tokenId: number;
}> = {
  [WORKER_ADDRESS.toLowerCase()]: {
    name:    "AgentSwap Worker",
    role:    "WORKER",
    tokenId: 1,
  },
  [CONSUMER_ADDRESS.toLowerCase()]: {
    name:    "AgentSwap Consumer",
    role:    "CONSUMER",
    tokenId: 2,
  },
};

// ─────────────────────────────────────────────────────────────────────────────

export const NETWORKS = {
  MANTLE_SEPOLIA: {
    name:     "Mantle Sepolia Testnet",
    chainId:  5003,
    rpc:      "https://rpc.sepolia.mantle.xyz",
    explorer: "https://explorer.sepolia.mantle.xyz",
    currency: "mETH",
  },
} as const;

export const ACTIVE_NETWORK = NETWORKS.MANTLE_SEPOLIA;

export const CONTRACT_ADDRESSES = {
  AGENT_IDENTITY: AGENT_IDENTITY_ADDRESS,
  SIMPLE_ECONOMY: SIMPLE_ECONOMY_ADDRESS,
} as const;

export const AGENT_ADDRESSES = {
  WORKER:   WORKER_ADDRESS,
  CONSUMER: CONSUMER_ADDRESS,
} as const;

export const AGENT_IDENTITY_ABI = [
  "function mintIdentity(address agent, string name, uint8 role) external returns (uint256)",
  "function logDecision(address agent, bytes32 taskId, string decision, string details, int8 reputationDelta) external",
  "function getProfile(address agent) external view returns (tuple(string name, uint8 role, uint256 reputationScore, uint256 totalDecisions, uint256 successfulTasks, uint256 mintedAt))",
  "function getReputation(address agent) external view returns (uint256)",
  "function agentTokenId(address) external view returns (uint256)",
  "function totalAgents() external view returns (uint256)",
  "event AgentMinted(uint256 indexed tokenId, address indexed agent, string name, uint8 role, uint256 timestamp)",
  "event DecisionLogged(uint256 indexed tokenId, address indexed agent, bytes32 indexed taskId, string decision, string details, uint256 reputationDelta, uint256 newReputation, uint256 timestamp)",
  "event ReputationUpdated(uint256 indexed tokenId, address indexed agent, int256 delta, uint256 newScore)",
] as const;

export const SIMPLE_ECONOMY_ABI = [
  "function postTask(string description) external payable returns (bytes32)",
  "function acceptTask(bytes32 taskId) external",
  "function completeTask(bytes32 taskId, string proof) external",
  "function failTask(bytes32 taskId, string reason) external",
  "function reclaimTask(bytes32 taskId) external",
  "function getTask(bytes32 taskId) external view returns (tuple(bytes32 id, address consumer, address worker, string description, uint256 payment, uint256 deadline, uint8 status, uint256 postedAt, uint256 acceptedAt, uint256 completedAt))",
  "function getOpenTasks() external view returns (bytes32[])",
  "function totalTasks() external view returns (uint256)",
  "event TaskPosted(bytes32 indexed taskId, address indexed consumer, string description, uint256 payment, uint256 deadline)",
  "event TaskAccepted(bytes32 indexed taskId, address indexed worker, uint256 timestamp)",
  "event TaskCompleted(bytes32 indexed taskId, address indexed worker, uint256 payment, uint256 timestamp)",
  "event TaskFailed(bytes32 indexed taskId, address indexed worker, uint256 timestamp)",
  "event TaskReclaimed(bytes32 indexed taskId, address indexed consumer, uint256 refund, uint256 timestamp)",
] as const;