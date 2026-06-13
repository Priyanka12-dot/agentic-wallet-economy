/**
 * constants.ts
 * Central config for all Mantle network parameters and deployed contract addresses.
 * Update CONTRACT_ADDRESSES after running `npx hardhat run contracts/migrations/1_deploy.js`
 */

// ─── Network Config ───────────────────────────────────────────────────────────

export const NETWORKS = {
  MANTLE_SEPOLIA: {
    name:    "Mantle Sepolia Testnet",
    chainId: 5003,
    rpc:     process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz",
    explorer:"https://explorer.sepolia.mantle.xyz",
    currency:"mETH",
  },
  MANTLE_MAINNET: {
    name:    "Mantle Mainnet",
    chainId: 5000,
    rpc:     "https://rpc.mantle.xyz",
    explorer:"https://mantlescan.xyz",
    currency:"MNT",
  },
} as const;

export const ACTIVE_NETWORK = NETWORKS.MANTLE_SEPOLIA;

// ─── Contract Addresses ───────────────────────────────────────────────────────
// These are populated after deployment (see deployed-addresses.json)

export const CONTRACT_ADDRESSES = {
  AGENT_IDENTITY:  process.env.AGENT_IDENTITY_ADDRESS  || "0x0000000000000000000000000000000000000000",
  SIMPLE_ECONOMY:  process.env.SIMPLE_ECONOMY_ADDRESS  || "0x0000000000000000000000000000000000000000",
} as const;

// ─── Token Addresses (Mantle Sepolia) ─────────────────────────────────────────

export const TOKENS = {
  // Native wrapped mETH – use address(0) / WETH for swaps
  WMETH: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb", // WMETH on Mantle Sepolia
  USDC:  "0x2271e3Fef9e15046d09E1d78a8FF038c691E4B6", // Mock USDC on Mantle Sepolia
  USDT:  "0x48a7E3fb47E0c9db8ED8b7b30DC1AC54b17b2603", // Mock USDT on Mantle Sepolia
} as const;

// ─── ABIs (inline minimal ABIs for gas efficiency) ────────────────────────────

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

// ─── Agent Loop Config ────────────────────────────────────────────────────────

export const AGENT_CONFIG = {
  DECISION_INTERVAL_MS:  10_000,   // 10 seconds between decision loops
  CONSUMER_POST_INTERVAL_MS: 15_000, // Consumer posts a new task every 15s
  TASK_PAYMENT_WEI: BigInt("10000000000000000"), // 0.01 mETH per task
  MAX_GAS_PRICE_GWEI: 0.02,        // Mantle's low fee environment
  SWAP_SLIPPAGE_BPS: 50,           // 0.5% slippage tolerance
  MIN_WORKER_REPUTATION: 50,
} as const;

// ─── Task Templates (Consumer uses these to generate tasks) ──────────────────

export const TASK_TEMPLATES = [
  "Swap 0.01 mETH to USDC on Mantle",
  "Swap 0.005 mETH to USDT on Mantle",
  "Swap 0.02 USDC to mETH on Mantle",
  "Transfer 0.001 mETH to treasury",
  "Swap 0.01 mETH to WMETH on Mantle",
  "Swap 0.015 USDT to USDC on Mantle",
] as const;
