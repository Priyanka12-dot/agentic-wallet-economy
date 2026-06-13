// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAgentIdentity {
    function logDecision(
        address agent,
        bytes32 taskId,
        string  calldata decision,
        string  calldata details,
        int8    reputationDelta
    ) external;

    function getReputation(address agent) external view returns (uint256);
}

/**
 * @title SimpleEconomy
 * @notice Minimal on-chain labor market for autonomous agents.
 *
 * Flow:
 *   1. Consumer calls postTask() with mETH payment locked in escrow.
 *   2. Worker calls acceptTask() — reputation check optional.
 *   3. Worker calls completeTask() → escrow released, reputation boosted.
 *   4. If Worker fails/times out, Consumer calls reclaimTask() to retrieve funds.
 *
 * All transitions are logged to AgentIdentity (ERC-8004) for on-chain
 * benchmarking.
 */
contract SimpleEconomy is Ownable, ReentrancyGuard {

    // ─── Types ────────────────────────────────────────────────────────────────

    enum TaskStatus {
        OPEN,        // posted, awaiting worker
        ACCEPTED,    // claimed by a worker
        COMPLETED,   // worker completed, payment released
        FAILED,      // worker failed, funds returned to consumer
        RECLAIMED    // consumer reclaimed expired task
    }

    struct Task {
        bytes32    id;
        address    consumer;
        address    worker;      // address(0) if OPEN
        string     description; // e.g. "Swap 0.01 mETH to USDC"
        uint256    payment;     // in wei (mETH)
        uint256    deadline;    // unix timestamp
        TaskStatus status;
        uint256    postedAt;
        uint256    acceptedAt;
        uint256    completedAt;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    IAgentIdentity public agentIdentity;

    mapping(bytes32 => Task) public tasks;
    bytes32[] public taskIds;

    uint256 public constant TASK_TTL = 10 minutes; // task expires if unclaimed
    uint256 public constant MIN_REPUTATION = 50;   // workers need ≥50 rep

    // ─── Events ───────────────────────────────────────────────────────────────

    event TaskPosted(
        bytes32 indexed taskId,
        address indexed consumer,
        string  description,
        uint256 payment,
        uint256 deadline
    );

    event TaskAccepted(
        bytes32 indexed taskId,
        address indexed worker,
        uint256 timestamp
    );

    event TaskCompleted(
        bytes32 indexed taskId,
        address indexed worker,
        uint256 payment,
        uint256 timestamp
    );

    event TaskFailed(
        bytes32 indexed taskId,
        address indexed worker,
        uint256 timestamp
    );

    event TaskReclaimed(
        bytes32 indexed taskId,
        address indexed consumer,
        uint256 refund,
        uint256 timestamp
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error TaskNotFound(bytes32 taskId);
    error TaskNotOpen(bytes32 taskId, TaskStatus status);
    error TaskNotAccepted(bytes32 taskId);
    error NotTaskWorker(address caller, bytes32 taskId);
    error NotTaskConsumer(address caller, bytes32 taskId);
    error TaskExpired(bytes32 taskId);
    error TaskNotExpired(bytes32 taskId);
    error InsufficientPayment();
    error InsufficientReputation(address worker, uint256 score);
    error TransferFailed();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _agentIdentity) Ownable(msg.sender) {
        agentIdentity = IAgentIdentity(_agentIdentity);
    }

    // ─── Consumer actions ─────────────────────────────────────────────────────

    /**
     * @notice Consumer posts a task with mETH locked as payment.
     * @param description  Human-readable task description.
     * @return taskId      keccak256 hash used as the task identifier.
     */
    function postTask(string calldata description)
        external
        payable
        returns (bytes32 taskId)
    {
        if (msg.value == 0) revert InsufficientPayment();

        taskId = keccak256(
            abi.encodePacked(msg.sender, description, block.timestamp, block.prevrandao)
        );

        tasks[taskId] = Task({
            id:          taskId,
            consumer:    msg.sender,
            worker:      address(0),
            description: description,
            payment:     msg.value,
            deadline:    block.timestamp + TASK_TTL,
            status:      TaskStatus.OPEN,
            postedAt:    block.timestamp,
            acceptedAt:  0,
            completedAt: 0
        });

        taskIds.push(taskId);

        // Log consumer's intent to AgentIdentity
        _safeLogDecision(
            msg.sender,
            taskId,
            "POST",
            description,
            int8(1) // +1 rep for activity
        );

        emit TaskPosted(taskId, msg.sender, description, msg.value, tasks[taskId].deadline);
    }

    /**
     * @notice Consumer reclaims funds from an expired, uncompleted task.
     */
    function reclaimTask(bytes32 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        if (t.consumer == address(0)) revert TaskNotFound(taskId);
        if (t.consumer != msg.sender) revert NotTaskConsumer(msg.sender, taskId);
        if (t.status != TaskStatus.OPEN && t.status != TaskStatus.ACCEPTED) {
            revert TaskNotOpen(taskId, t.status);
        }
        if (block.timestamp <= t.deadline) revert TaskNotExpired(taskId);

        uint256 refund = t.payment;
        t.status  = TaskStatus.RECLAIMED;
        t.payment = 0;

        (bool ok,) = t.consumer.call{value: refund}("");
        if (!ok) revert TransferFailed();

        emit TaskReclaimed(taskId, msg.sender, refund, block.timestamp);
    }

    // ─── Worker actions ───────────────────────────────────────────────────────

    /**
     * @notice Worker claims an open task. Reputation check enforced.
     */
    function acceptTask(bytes32 taskId) external {
        Task storage t = tasks[taskId];
        if (t.consumer == address(0)) revert TaskNotFound(taskId);
        if (t.status != TaskStatus.OPEN) revert TaskNotOpen(taskId, t.status);
        if (block.timestamp > t.deadline) revert TaskExpired(taskId);

        uint256 rep = agentIdentity.getReputation(msg.sender);
        if (rep < MIN_REPUTATION) revert InsufficientReputation(msg.sender, rep);

        t.worker     = msg.sender;
        t.status     = TaskStatus.ACCEPTED;
        t.acceptedAt = block.timestamp;

        _safeLogDecision(msg.sender, taskId, "ACCEPT", t.description, int8(2));

        emit TaskAccepted(taskId, msg.sender, block.timestamp);
    }

    /**
     * @notice Worker signals task completion. Payment released to worker.
     * @dev In production this would verify an off-chain execution proof.
     *      For the hackathon demo, worker self-reports completion.
     */
    function completeTask(bytes32 taskId, string calldata proof)
        external
        nonReentrant
    {
        Task storage t = tasks[taskId];
        if (t.consumer == address(0)) revert TaskNotFound(taskId);
        if (t.status != TaskStatus.ACCEPTED) revert TaskNotAccepted(taskId);
        if (t.worker != msg.sender) revert NotTaskWorker(msg.sender, taskId);

        uint256 payment = t.payment;
        t.status      = TaskStatus.COMPLETED;
        t.completedAt = block.timestamp;
        t.payment     = 0;

        // Release payment to worker
        (bool ok,) = msg.sender.call{value: payment}("");
        if (!ok) revert TransferFailed();

        // Log success on both agent identities
        string memory detail = string(abi.encodePacked("PROOF:", proof));
        _safeLogDecision(msg.sender,  taskId, "COMPLETE", detail, int8(5));
        _safeLogDecision(t.consumer,  taskId, "VERIFIED", detail, int8(3));

        emit TaskCompleted(taskId, msg.sender, payment, block.timestamp);
    }

    /**
     * @notice Worker self-reports a failure (e.g., swap reverted on DEX).
     *         Funds are returned to consumer; worker reputation penalised.
     */
    function failTask(bytes32 taskId, string calldata reason) external {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.ACCEPTED) revert TaskNotAccepted(taskId);
        if (t.worker != msg.sender) revert NotTaskWorker(msg.sender, taskId);

        uint256 refund = t.payment;
        t.status  = TaskStatus.FAILED;
        t.payment = 0;

        (bool ok,) = t.consumer.call{value: refund}("");
        if (!ok) revert TransferFailed();

        _safeLogDecision(msg.sender, taskId, "FAIL", reason, int8(-5));

        emit TaskFailed(taskId, msg.sender, block.timestamp);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    function getTask(bytes32 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getOpenTasks() external view returns (bytes32[] memory open) {
        uint256 count;
        for (uint256 i = 0; i < taskIds.length; i++) {
            if (tasks[taskIds[i]].status == TaskStatus.OPEN) count++;
        }
        open = new bytes32[](count);
        uint256 j;
        for (uint256 i = 0; i < taskIds.length; i++) {
            if (tasks[taskIds[i]].status == TaskStatus.OPEN) {
                open[j++] = taskIds[i];
            }
        }
    }

    function totalTasks() external view returns (uint256) {
        return taskIds.length;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _safeLogDecision(
        address agent,
        bytes32 taskId,
        string  memory decision,
        string  memory details,
        int8    delta
    ) internal {
        try agentIdentity.logDecision(agent, taskId, decision, details, delta) {}
        catch {}
    }

    // Allow contract to receive ETH (for testing)
    receive() external payable {}
}
