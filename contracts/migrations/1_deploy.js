const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Deploy AgentIdentity (ERC-8004) then SimpleEconomy in one transaction sequence.
 * Also mints ERC-8004 identity NFTs for both agents BEFORE transferring ownership.
 *
 * Run with: npx hardhat run contracts/migrations/1_deploy.js --network mantle_sepolia
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🚀 Deploying AgentSwap contracts");
  console.log("   Deployer :", deployer.address);
  console.log("   Balance  :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "mETH\n");

  // ── 1. AgentIdentity ──────────────────────────────────────────────────────
  console.log("📜 Deploying AgentIdentity (ERC-8004)…");
  const AgentIdentity = await ethers.getContractFactory("AgentIdentity");
  const agentIdentity = await AgentIdentity.deploy();
  await agentIdentity.waitForDeployment();
  const agentIdentityAddr = await agentIdentity.getAddress();
  console.log("   ✅ AgentIdentity deployed:", agentIdentityAddr);

  // ── 2. SimpleEconomy ──────────────────────────────────────────────────────
  console.log("\n📜 Deploying SimpleEconomy…");
  const SimpleEconomy = await ethers.getContractFactory("SimpleEconomy");
  const simpleEconomy = await SimpleEconomy.deploy(agentIdentityAddr);
  await simpleEconomy.waitForDeployment();
  const simpleEconomyAddr = await simpleEconomy.getAddress();
  console.log("   ✅ SimpleEconomy deployed:", simpleEconomyAddr);

  // ── 3. Mint ERC-8004 identity NFTs (MUST happen before ownership transfer) ─
  // At this point the deployer still owns AgentIdentity so mintIdentity() works.
  const workerAddress   = process.env.WORKER_ADDRESS;
  const consumerAddress = process.env.CONSUMER_ADDRESS;

  if (!workerAddress || !consumerAddress) {
    console.log("\n⚠️  WORKER_ADDRESS or CONSUMER_ADDRESS not set in .env");
    console.log("   Skipping identity minting — run npm run mint separately.");
    console.log("   NOTE: npm run mint will FAIL if you run it after ownership");
    console.log("   is transferred. Set both addresses in .env before deploying.\n");
  } else {
    console.log("\n🎭 Minting ERC-8004 identity NFTs…");

    // Mint Worker identity (AgentRole.WORKER = 0)
    console.log(`   Minting Worker identity → ${workerAddress}`);
    const mintWorkerTx = await agentIdentity.mintIdentity(workerAddress, "AgentSwap Worker", 0);
    const mintWorkerReceipt = await mintWorkerTx.wait();
    const workerTokenId = await agentIdentity.agentTokenId(workerAddress);
    console.log(`   ✅ Worker minted — Token #${workerTokenId} | TX: ${mintWorkerReceipt.hash}`);

    // Mint Consumer identity (AgentRole.CONSUMER = 1)
    console.log(`   Minting Consumer identity → ${consumerAddress}`);
    const mintConsumerTx = await agentIdentity.mintIdentity(consumerAddress, "AgentSwap Consumer", 1);
    const mintConsumerReceipt = await mintConsumerTx.wait();
    const consumerTokenId = await agentIdentity.agentTokenId(consumerAddress);
    console.log(`   ✅ Consumer minted — Token #${consumerTokenId} | TX: ${mintConsumerReceipt.hash}`);

    console.log(`\n   Total agents on-chain: ${await agentIdentity.totalAgents()}`);
  }

  // ── 4. Transfer AgentIdentity ownership to SimpleEconomy ─────────────────
  // Now safe to transfer — minting is already done.
  // SimpleEconomy needs ownership to call logDecision() on behalf of agents.
  console.log("\n🔗 Transferring AgentIdentity ownership to SimpleEconomy…");
  const ownershipTx = await agentIdentity.transferOwnership(simpleEconomyAddr);
  await ownershipTx.wait();
  console.log("   ✅ Ownership transferred");

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║           AgentSwap Deployment Summary              ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  AgentIdentity : ${agentIdentityAddr}  ║`);
  console.log(`║  SimpleEconomy : ${simpleEconomyAddr}  ║`);
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("\n⚠️  Copy the above addresses into your .env file\n");

  // Save to file
  const fs = require("fs");
  const deployedAddresses = {
    network:        (await ethers.provider.getNetwork()).name,
    chainId:        Number((await ethers.provider.getNetwork()).chainId),
    AgentIdentity:  agentIdentityAddr,
    SimpleEconomy:  simpleEconomyAddr,
    WorkerAddress:  workerAddress  || "not set",
    ConsumerAddress:consumerAddress || "not set",
    deployedAt:     new Date().toISOString(),
    deployedBy:     deployer.address,
  };

  fs.writeFileSync(
    "./deployed-addresses.json",
    JSON.stringify(deployedAddresses, null, 2)
  );
  console.log("📄 Addresses saved to deployed-addresses.json");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});