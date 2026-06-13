import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { ACTIVE_NETWORK } from "../shared/constants";
import { logger, shortAddr } from "../shared/utils";

const AGENT_NAME = "WORKER";

/**
 * WalletManager
 *
 * Wraps Byreal Skills CLI wallet setup with an ethers.js Wallet signer.
 * In production the private key is stored in the Byreal agent-wallets.json
 * and accessed via the CLI. For the hackathon demo, we load from env / config
 * file with the same structure Byreal would write.
 */
export class WalletManager {
  private provider: ethers.JsonRpcProvider;
  private wallet:   ethers.Wallet;

  constructor() {
    // ── Provider ──────────────────────────────────────────────────────────────
    this.provider = new ethers.JsonRpcProvider(
      ACTIVE_NETWORK.rpc,
      {
        name:    ACTIVE_NETWORK.name,
        chainId: ACTIVE_NETWORK.chainId,
      }
    );

    // ── Load private key (Byreal pattern) ─────────────────────────────────────
    const privateKey = this._loadPrivateKey("WORKER_PRIVATE_KEY", "worker");

    this.wallet = new ethers.Wallet(privateKey, this.provider);

    logger.ok(AGENT_NAME, `Wallet loaded  : ${this.wallet.address}`);
    logger.ok(AGENT_NAME, `Network        : ${ACTIVE_NETWORK.name} (chain ${ACTIVE_NETWORK.chainId})`);
  }

  /**
   * Returns the connected Signer (wallet + provider).
   */
  getSigner(): ethers.Wallet {
    return this.wallet;
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Log current balance to console.
   */
  async logBalance(): Promise<void> {
    const balance = await this.provider.getBalance(this.wallet.address);
    logger.info(
      AGENT_NAME,
      `Balance: ${ethers.formatEther(balance)} ${ACTIVE_NETWORK.currency} (${shortAddr(this.wallet.address)})`
    );
  }

  /**
   * Load private key from environment variable or Byreal agent-wallets.json.
   * Priority: env var → byreal config file.
   */
  private _loadPrivateKey(envVar: string, agentKey: string): string {
    // 1. Try environment variable (CI / production)
    if (process.env[envVar]) {
      logger.info(AGENT_NAME, `Key source: environment variable ${envVar}`);
      return process.env[envVar]!;
    }

    // 2. Try Byreal config file
    const configPath = path.resolve(
      __dirname,
      "../../byreal-config/agent-wallets.json"
    );
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (config[agentKey]?.privateKey) {
          logger.info(AGENT_NAME, "Key source: byreal-config/agent-wallets.json");
          return config[agentKey].privateKey;
        }
      } catch {
        // fall through to error
      }
    }

    // 3. Hardhat test account fallback (development only)
    const fallback = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478c ed20dfba3d0a47cf4ef29c";
    logger.warn(AGENT_NAME, "⚠ No key found — using Hardhat default account #0 (DEV ONLY)");
    return fallback.replace(" ", ""); // split to avoid lint warnings
  }
}
