/**
 * scripts/fund-wallets.ts
 *
 * Sends test mETH from the deployer wallet to each agent wallet so they
 * can pay for gas and post tasks.
 *
 * Run with: npx ts-node scripts/fund-wallets.ts
 *
 * Requires:
 *   DEPLOYER_PRIVATE_KEY — faucet wallet with test mETH
 *   WORKER_ADDRESS       — worker wallet to fund
 *   CONSUMER_ADDRESS     — consumer wallet to fund (needs more, pays task escrow)
 *   MANTLE_RPC_URL       — Mantle Sepolia RPC
 *
 * Get testnet mETH from: https://faucet.sepolia.mantle.xyz
 */

import "dotenv/config";
import { ethers } from "ethers";

const FUND_AMOUNTS = {
  worker:   ethers.parseEther("0.1"),   // 0.1 mETH — mostly gas
  consumer: ethers.parseEther("0.5"),   // 0.5 mETH — gas + task escrow payments
};

async function main() {
  const rpc      = process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz";
  const chainId  = Number(process.env.CHAIN_ID ?? 5003);
  const provider = new ethers.JsonRpcProvider(rpc, { name: "mantle-sepolia", chainId });

  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  const deployer = new ethers.Wallet(deployerKey, provider);

  const deployerBalance = await provider.getBalance(deployer.address);
  console.log("\n💸 AgentSwap — Funding Agent Wallets");
  console.log("═════════════════════════════════════");
  console.log(`Funder   : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(deployerBalance)} mETH`);
  console.log(`Network  : ${rpc}\n`);

  const targets = [
    { label: "Worker",   addr: process.env.WORKER_ADDRESS,   amount: FUND_AMOUNTS.worker   },
    { label: "Consumer", addr: process.env.CONSUMER_ADDRESS, amount: FUND_AMOUNTS.consumer },
  ];

  for (const target of targets) {
    if (!target.addr) {
      console.warn(`⚠  ${target.label} address not set, skipping`);
      continue;
    }

    const currentBalance = await provider.getBalance(target.addr);
    console.log(`📬 ${target.label} (${target.addr})`);
    console.log(`   Current balance : ${ethers.formatEther(currentBalance)} mETH`);

    // Skip if already sufficiently funded
    const minRequired = target.amount / 2n;
    if (currentBalance >= minRequired) {
      console.log(`   Already funded — skipping\n`);
      continue;
    }

    const sendAmount = target.amount - currentBalance;
    console.log(`   Sending         : ${ethers.formatEther(sendAmount)} mETH`);

    try {
      const tx = await deployer.sendTransaction({
        to:       target.addr,
        value:    sendAmount,
        gasLimit: 21_000n,
      });
      const receipt = await tx.wait();

      const newBalance = await provider.getBalance(target.addr);
      console.log(`   ✅ Funded! New balance: ${ethers.formatEther(newBalance)} mETH`);
      console.log(`   TX: https://explorer.sepolia.mantle.xyz/tx/${receipt!.hash}\n`);
    } catch (err: any) {
      console.error(`   ✗ Failed: ${err.message}\n`);
    }
  }

  const finalBalance = await provider.getBalance(deployer.address);
  console.log(`Deployer remaining: ${ethers.formatEther(finalBalance)} mETH`);
  console.log("═════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ fund-wallets failed:", err.message);
  process.exit(1);
});
