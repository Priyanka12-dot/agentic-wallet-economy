/**
 * scripts/mint-identity.ts
 *
 * Mints ERC-8004 identity NFTs for the Worker and Consumer agents.
 * Run AFTER deploying contracts:
 *   npx ts-node scripts/mint-identity.ts
 *
 * Requires:
 *   DEPLOYER_PRIVATE_KEY   — wallet that owns AgentIdentity contract
 *   WORKER_ADDRESS         — worker agent wallet address
 *   CONSUMER_ADDRESS       — consumer agent wallet address
 *   AGENT_IDENTITY_ADDRESS — deployed AgentIdentity contract address
 *   MANTLE_RPC_URL         — Mantle Sepolia RPC URL
 */

import "dotenv/config";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const AGENT_IDENTITY_ABI = [
  "function mintIdentity(address agent, string name, uint8 role) external returns (uint256)",
  "function getProfile(address agent) external view returns (tuple(string name, uint8 role, uint256 reputationScore, uint256 totalDecisions, uint256 successfulTasks, uint256 mintedAt))",
  "function agentTokenId(address) external view returns (uint256)",
  "function totalAgents() external view returns (uint256)",
];

const AgentRole = { WORKER: 0, CONSUMER: 1 };

async function main() {
  const rpc       = process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz";
  const chainId   = Number(process.env.CHAIN_ID ?? 5003);
  const provider  = new ethers.JsonRpcProvider(rpc, { name: "mantle-sepolia", chainId });

  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  const deployer = new ethers.Wallet(deployerKey, provider);

  const contractAddr = process.env.AGENT_IDENTITY_ADDRESS;
  if (!contractAddr || contractAddr === ethers.ZeroAddress) {
    throw new Error("AGENT_IDENTITY_ADDRESS not set — deploy contracts first");
  }

  const contract = new ethers.Contract(contractAddr, AGENT_IDENTITY_ABI, deployer);

  console.log("\n🎭 AgentSwap — Minting ERC-8004 Identity NFTs");
  console.log("═══════════════════════════════════════════════");
  console.log("Deployer  :", deployer.address);
  console.log("Contract  :", contractAddr);
  console.log("Network   :", rpc);
  console.log("");

  const agents = [
    {
      key:  "WORKER",
      name: "AgentSwap Worker",
      role: AgentRole.WORKER,
      addr: process.env.WORKER_ADDRESS,
    },
    {
      key:  "CONSUMER",
      name: "AgentSwap Consumer",
      role: AgentRole.CONSUMER,
      addr: process.env.CONSUMER_ADDRESS,
    },
  ];

  const results: Record<string, { tokenId: number; address: string }> = {};

  for (const agent of agents) {
    if (!agent.addr) {
      console.warn(`⚠  ${agent.key}_ADDRESS not set, skipping`);
      continue;
    }

    console.log(`\n📋 Minting identity for ${agent.name}…`);
    console.log(`   Address: ${agent.addr}`);

    // Check if already minted
    const existingId = await contract.agentTokenId(agent.addr);
    if (Number(existingId) !== 0) {
      console.log(`   ✅ Already minted — Token #${existingId}`);
      results[agent.key] = { tokenId: Number(existingId), address: agent.addr };
      continue;
    }

    try {
      const tx      = await contract.mintIdentity(agent.addr, agent.name, agent.role, { gasLimit: 300_000n });
      const receipt = await tx.wait();
      const tokenId = Number(await contract.agentTokenId(agent.addr));

      console.log(`   ✅ Minted! Token #${tokenId}`);
      console.log(`   TX: ${receipt.hash}`);
      console.log(`   Explorer: https://explorer.sepolia.mantle.xyz/tx/${receipt.hash}`);

      results[agent.key] = { tokenId, address: agent.addr };
    } catch (err: any) {
      console.error(`   ✗ Mint failed: ${err.message}`);
    }
  }

  // Write token IDs to byreal-config
  const configPath = path.resolve(__dirname, "../agent-core/byreal-config/agent-wallets.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    for (const [key, val] of Object.entries(results)) {
      const configKey = key.toLowerCase();
      if (config[configKey]) {
        config[configKey].tokenId = val.tokenId;
        config[configKey].address = val.address;
      }
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("\n📄 Token IDs written to byreal-config/agent-wallets.json");
  }

  const total = Number(await contract.totalAgents());
  console.log(`\n✅ Done! Total agents on-chain: ${total}`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ mint-identity failed:", err.message);
  process.exit(1);
});
