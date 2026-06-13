require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const DEPLOYER_KEY   = process.env.DEPLOYER_PRIVATE_KEY  || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478ced20dfba3d0a47cf4ef29c"; // Hardhat default
const MANTLE_RPC_URL = process.env.MANTLE_RPC_URL         || "https://rpc.sepolia.mantle.xyz";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs:    200,
      },
      evmVersion: "cancun",
      viaIR: false,
    },
  },

  networks: {
    // ── Local Hardhat Network ─────────────────────────────────────
    hardhat: {
      chainId: 31337,
      gas:     "auto",
      // Uncomment to fork Mantle Sepolia for integration tests:
      // forking: {
      //   url: MANTLE_RPC_URL,
      //   blockNumber: undefined, // latest
      // },
    },

    // ── Mantle Sepolia Testnet ────────────────────────────────────
    mantle_sepolia: {
      url:      "https://rpc.sepolia.mantle.xyz",
      chainId:  5003,
      accounts: [DEPLOYER_KEY],
      gas:      "auto",
      gasPrice: "auto",
      timeout:  60_000,
    },

    // ── Mantle Mainnet ────────────────────────────────────────────
    mantle_mainnet: {
      url:      "https://rpc.mantle.xyz",
      chainId:  5000,
      accounts: [DEPLOYER_KEY],
      gas:      "auto",
      gasPrice: "auto",
      timeout:  60_000,
    },
  },

  // ── Contract verification (Mantlescan) ───────────────────────────
  etherscan: {
    apiKey: {
      mantle_sepolia: process.env.MANTLESCAN_API_KEY || "placeholder",
      mantle_mainnet: process.env.MANTLESCAN_API_KEY || "placeholder",
    },
    customChains: [
      {
        network:    "mantle_sepolia",
        chainId:    5003,
        urls: {
          apiURL:     "https://api-sepolia.mantlescan.xyz/api",
          browserURL: "https://explorer.sepolia.mantle.xyz",
        },
      },
      {
        network:    "mantle_mainnet",
        chainId:    5000,
        urls: {
          apiURL:     "https://api.mantlescan.xyz/api",
          browserURL: "https://mantlescan.xyz",
        },
      },
    ],
  },

  // ── Gas reporter ─────────────────────────────────────────────────
  gasReporter: {
    enabled:      process.env.REPORT_GAS === "true",
    currency:     "USD",
    outputFile:   "gas-report.txt",
    noColors:     true,
    coinmarketcap: process.env.CMC_API_KEY,
  },

  // ── Test paths ───────────────────────────────────────────────────
  paths: {
    sources:  "./contracts",
    tests:    "./tests/contracts",
    cache:    "./cache",
    artifacts:"./artifacts",
  },

  // ── TypeChain ────────────────────────────────────────────────────
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};
