import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { ACTIVE_NETWORK } from "../shared/constants";
import { logger, shortAddr } from "../shared/utils";

const AGENT_NAME = "CONSUMER";

export class WalletManager {
  private provider: ethers.JsonRpcProvider;
  private wallet:   ethers.Wallet;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(
      ACTIVE_NETWORK.rpc,
      {
        name:    ACTIVE_NETWORK.name,
        chainId: ACTIVE_NETWORK.chainId,
      }
    );

    const privateKey = this._loadPrivateKey("CONSUMER_PRIVATE_KEY", "consumer");
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    logger.ok(AGENT_NAME, `Wallet loaded  : ${this.wallet.address}`);
    logger.ok(AGENT_NAME, `Network        : ${ACTIVE_NETWORK.name} (chain ${ACTIVE_NETWORK.chainId})`);
  }

  getSigner(): ethers.Wallet {
    return this.wallet;
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getAddress(): string {
    return this.wallet.address;
  }

  async logBalance(): Promise<void> {
    const balance = await this.provider.getBalance(this.wallet.address);
    logger.info(
      AGENT_NAME,
      `Balance: ${ethers.formatEther(balance)} ${ACTIVE_NETWORK.currency} (${shortAddr(this.wallet.address)})`
    );
  }

  private _loadPrivateKey(envVar: string, agentKey: string): string {
    if (process.env[envVar]) {
      logger.info(AGENT_NAME, `Key source: environment variable ${envVar}`);
      return process.env[envVar]!;
    }

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
      } catch {}
    }

    // Hardhat account #1 as dev fallback (different from worker)
    const fallback = "0x59c6995e998f97a5a0044966f094538 19dc9bed8f1a9a4b5c7e3c9046dd7ef";
    logger.warn(AGENT_NAME, "⚠ No key found — using Hardhat default account #1 (DEV ONLY)");
    return fallback.replace(" ", "");
  }
}
