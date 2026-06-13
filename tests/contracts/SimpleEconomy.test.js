/**
 * tests/contracts/SimpleEconomy.test.js
 *
 * Tests the full task lifecycle: post → accept → complete / fail → reclaim
 * Run with: npx hardhat test tests/contracts/SimpleEconomy.test.js
 */

const { expect }  = require("chai");
const { ethers }  = require("hardhat");
const { time }    = require("@nomicfoundation/hardhat-network-helpers");

describe("SimpleEconomy", function () {
  let agentIdentity, simpleEconomy;
  let deployer, worker, consumer, stranger;
  const PAYMENT = ethers.parseEther("0.01");

  // ── Deploy fresh contracts before each test ──────────────────────────────
  beforeEach(async () => {
    [deployer, worker, consumer, stranger] = await ethers.getSigners();

    const AgentIdentity = await ethers.getContractFactory("AgentIdentity");
    agentIdentity = await AgentIdentity.deploy();
    await agentIdentity.waitForDeployment();

    const SimpleEconomy = await ethers.getContractFactory("SimpleEconomy");
    simpleEconomy = await SimpleEconomy.deploy(await agentIdentity.getAddress());
    await simpleEconomy.waitForDeployment();

    // Transfer AgentIdentity ownership to SimpleEconomy
    await agentIdentity.transferOwnership(await simpleEconomy.getAddress());

    // Mint identities for worker and consumer
    // Note: SimpleEconomy now owns AgentIdentity, but deployer can call via
    // direct contract interaction in tests
    // Re-deploy with deployer keeping ownership for setup
    const AI2 = await ethers.getContractFactory("AgentIdentity");
    agentIdentity = await AI2.deploy();
    await agentIdentity.waitForDeployment();
    const SE2 = await ethers.getContractFactory("SimpleEconomy");
    simpleEconomy = await SE2.deploy(await agentIdentity.getAddress());
    await simpleEconomy.waitForDeployment();

    // Mint before transferring ownership
    await agentIdentity.mintIdentity(worker.address,   "Test Worker",   0); // WORKER
    await agentIdentity.mintIdentity(consumer.address, "Test Consumer", 1); // CONSUMER

    // Now transfer
    await agentIdentity.transferOwnership(await simpleEconomy.getAddress());
  });

  // ─── postTask ─────────────────────────────────────────────────────────────

  describe("postTask", () => {
    it("locks payment in escrow and emits TaskPosted", async () => {
      const description = "Swap 0.01 mETH to USDC";
      const contractBefore = await ethers.provider.getBalance(await simpleEconomy.getAddress());

      const tx = await simpleEconomy.connect(consumer).postTask(description, { value: PAYMENT });
      const receipt = await tx.wait();

      const contractAfter = await ethers.provider.getBalance(await simpleEconomy.getAddress());
      expect(contractAfter - contractBefore).to.equal(PAYMENT);

      // Check event
      const event = receipt.logs
        .map(log => { try { return simpleEconomy.interface.parseLog(log); } catch { return null; } })
        .find(e => e?.name === "TaskPosted");

      expect(event).to.not.be.null;
      expect(event.args.consumer).to.equal(consumer.address);
      expect(event.args.description).to.equal(description);
      expect(event.args.payment).to.equal(PAYMENT);
    });

    it("reverts with InsufficientPayment if no ETH sent", async () => {
      await expect(
        simpleEconomy.connect(consumer).postTask("Swap mETH", { value: 0n })
      ).to.be.revertedWithCustomError(simpleEconomy, "InsufficientPayment");
    });

    it("increments totalTasks", async () => {
      await simpleEconomy.connect(consumer).postTask("Task A", { value: PAYMENT });
      await simpleEconomy.connect(consumer).postTask("Task B", { value: PAYMENT });
      expect(await simpleEconomy.totalTasks()).to.equal(2n);
    });
  });

  // ─── acceptTask ───────────────────────────────────────────────────────────

  describe("acceptTask", () => {
    let taskId;

    beforeEach(async () => {
      const tx = await simpleEconomy.connect(consumer).postTask("Swap 0.01 mETH", { value: PAYMENT });
      const receipt = await tx.wait();
      const event = receipt.logs
        .map(log => { try { return simpleEconomy.interface.parseLog(log); } catch { return null; } })
        .find(e => e?.name === "TaskPosted");
      taskId = event.args.taskId;
    });

    it("assigns worker and emits TaskAccepted", async () => {
      await expect(simpleEconomy.connect(worker).acceptTask(taskId))
        .to.emit(simpleEconomy, "TaskAccepted")
        .withArgs(taskId, worker.address, anyValue());

      const task = await simpleEconomy.getTask(taskId);
      expect(task.worker).to.equal(worker.address);
      expect(task.status).to.equal(1n); // ACCEPTED
    });

    it("reverts if worker reputation is below minimum", async () => {
      // Stranger has no identity NFT → reputation 0
      await expect(
        simpleEconomy.connect(stranger).acceptTask(taskId)
      ).to.be.revertedWithCustomError(simpleEconomy, "InsufficientReputation");
    });

    it("reverts if task already accepted", async () => {
      await simpleEconomy.connect(worker).acceptTask(taskId);
      await expect(
        simpleEconomy.connect(worker).acceptTask(taskId)
      ).to.be.revertedWithCustomError(simpleEconomy, "TaskNotOpen");
    });
  });

  // ─── completeTask ─────────────────────────────────────────────────────────

  describe("completeTask", () => {
    let taskId;

    beforeEach(async () => {
      const tx = await simpleEconomy.connect(consumer).postTask("Swap 0.01 mETH", { value: PAYMENT });
      const receipt = await tx.wait();
      const event = receipt.logs
        .map(log => { try { return simpleEconomy.interface.parseLog(log); } catch { return null; } })
        .find(e => e?.name === "TaskPosted");
      taskId = event.args.taskId;
      await simpleEconomy.connect(worker).acceptTask(taskId);
    });

    it("releases payment to worker and emits TaskCompleted", async () => {
      const workerBefore = await ethers.provider.getBalance(worker.address);

      const tx = await simpleEconomy.connect(worker).completeTask(taskId, "0xPROOF");
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const workerAfter = await ethers.provider.getBalance(worker.address);
      expect(workerAfter - workerBefore + gasUsed).to.equal(PAYMENT);

      const task = await simpleEconomy.getTask(taskId);
      expect(task.status).to.equal(2n); // COMPLETED
      expect(task.payment).to.equal(0n);
    });

    it("reverts if called by non-worker", async () => {
      await expect(
        simpleEconomy.connect(stranger).completeTask(taskId, "0xPROOF")
      ).to.be.revertedWithCustomError(simpleEconomy, "NotTaskWorker");
    });
  });

  // ─── failTask ─────────────────────────────────────────────────────────────

  describe("failTask", () => {
    let taskId;

    beforeEach(async () => {
      const tx = await simpleEconomy.connect(consumer).postTask("Swap 0.01 mETH", { value: PAYMENT });
      const receipt = await tx.wait();
      const event = receipt.logs
        .map(log => { try { return simpleEconomy.interface.parseLog(log); } catch { return null; } })
        .find(e => e?.name === "TaskPosted");
      taskId = event.args.taskId;
      await simpleEconomy.connect(worker).acceptTask(taskId);
    });

    it("refunds consumer and marks task FAILED", async () => {
      const consumerBefore = await ethers.provider.getBalance(consumer.address);

      await simpleEconomy.connect(worker).failTask(taskId, "DEX pool empty");

      const consumerAfter = await ethers.provider.getBalance(consumer.address);
      expect(consumerAfter - consumerBefore).to.equal(PAYMENT);

      const task = await simpleEconomy.getTask(taskId);
      expect(task.status).to.equal(3n); // FAILED
    });
  });

  // ─── reclaimTask ──────────────────────────────────────────────────────────

  describe("reclaimTask", () => {
    let taskId;

    beforeEach(async () => {
      const tx = await simpleEconomy.connect(consumer).postTask("Swap 0.01 mETH", { value: PAYMENT });
      const receipt = await tx.wait();
      const event = receipt.logs
        .map(log => { try { return simpleEconomy.interface.parseLog(log); } catch { return null; } })
        .find(e => e?.name === "TaskPosted");
      taskId = event.args.taskId;
    });

    it("refunds consumer after task expires", async () => {
      // Fast-forward past TASK_TTL (10 minutes)
      await time.increase(11 * 60);

      const consumerBefore = await ethers.provider.getBalance(consumer.address);
      const tx = await simpleEconomy.connect(consumer).reclaimTask(taskId);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const consumerAfter = await ethers.provider.getBalance(consumer.address);
      expect(consumerAfter - consumerBefore + gasUsed).to.equal(PAYMENT);

      const task = await simpleEconomy.getTask(taskId);
      expect(task.status).to.equal(4n); // RECLAIMED
    });

    it("reverts if task has not yet expired", async () => {
      await expect(
        simpleEconomy.connect(consumer).reclaimTask(taskId)
      ).to.be.revertedWithCustomError(simpleEconomy, "TaskNotExpired");
    });

    it("reverts if called by non-consumer", async () => {
      await time.increase(11 * 60);
      await expect(
        simpleEconomy.connect(stranger).reclaimTask(taskId)
      ).to.be.revertedWithCustomError(simpleEconomy, "NotTaskConsumer");
    });
  });

  // ─── getOpenTasks ─────────────────────────────────────────────────────────

  describe("getOpenTasks", () => {
    it("returns only OPEN task IDs", async () => {
      const tx1 = await simpleEconomy.connect(consumer).postTask("Task 1", { value: PAYMENT });
      const tx2 = await simpleEconomy.connect(consumer).postTask("Task 2", { value: PAYMENT });
      await tx1.wait(); await tx2.wait();

      let openTasks = await simpleEconomy.getOpenTasks();
      expect(openTasks.length).to.equal(2);

      // Accept one
      await simpleEconomy.connect(worker).acceptTask(openTasks[0]);
      openTasks = await simpleEconomy.getOpenTasks();
      expect(openTasks.length).to.equal(1);
    });
  });
});

// Chai helper: match any value
function anyValue() {
  return { asymmetricMatch: () => true };
}
