// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
// Note: Counters.sol was removed in OpenZeppelin v5. Use plain uint256 instead.

/**
 * @title AgentIdentity (ERC-8004)
 * @notice Mints a unique identity NFT per AI agent and logs every on-chain decision
 *         immutably. This forms the reputation backbone of AgentSwap.
 *
 * ERC-8004 is an experimental extension of ERC-721 designed for the Mantle
 * Turing Test Hackathon. It adds:
 *   - Per-agent decision history via DecisionLogged events
 *   - On-chain reputation score tracking
 *   - Typed roles (WORKER / CONSUMER)
 */
contract AgentIdentity is ERC721, Ownable {

    // ─── Types ────────────────────────────────────────────────────────────────

    enum AgentRole { WORKER, CONSUMER }

    struct AgentProfile {
        string  name;
        AgentRole role;
        uint256 reputationScore;  // starts at 100, +/- on outcomes
        uint256 totalDecisions;
        uint256 successfulTasks;
        uint256 mintedAt;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    // Plain uint256 counter — replaces OZ v4 Counters.Counter (removed in OZ v5)
    uint256 private _tokenIdCounter;

    /// tokenId → profile
    mapping(uint256 => AgentProfile) public profiles;

    /// agent address → tokenId (only one identity per agent)
    mapping(address => uint256) public agentTokenId;

    // ─── Events (ERC-8004 core) ───────────────────────────────────────────────

    event AgentMinted(
        uint256 indexed tokenId,
        address indexed agent,
        string  name,
        AgentRole role,
        uint256 timestamp
    );

    event DecisionLogged(
        uint256 indexed tokenId,
        address indexed agent,
        bytes32 indexed taskId,
        string  decision,      // "ACCEPT" | "REJECT" | "COMPLETE" | "FAIL"
        string  details,
        uint256 reputationDelta,
        uint256 newReputation,
        uint256 timestamp
    );

    event ReputationUpdated(
        uint256 indexed tokenId,
        address indexed agent,
        int256  delta,
        uint256 newScore
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error AlreadyHasIdentity(address agent);
    error NoIdentityFound(address agent);
    error Unauthorized(address caller);
    error InvalidReputationDelta();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() ERC721("AgentIdentity", "AGID") Ownable(msg.sender) {}

    // ─── Minting ──────────────────────────────────────────────────────────────

    /**
     * @notice Mint an ERC-8004 identity NFT for a new agent.
     * @dev Only contract owner (deployer / orchestrator) can mint.
     *      Each agent address may only hold one identity NFT.
     */
    function mintIdentity(
        address agent,
        string calldata name,
        AgentRole role
    ) external onlyOwner returns (uint256 tokenId) {
        if (agentTokenId[agent] != 0) revert AlreadyHasIdentity(agent);

        // Pre-increment so token IDs start at 1 (0 is used as "no identity" sentinel)
        unchecked { ++_tokenIdCounter; }
        tokenId = _tokenIdCounter;

        _safeMint(agent, tokenId);

        profiles[tokenId] = AgentProfile({
            name:             name,
            role:             role,
            reputationScore:  100,
            totalDecisions:   0,
            successfulTasks:  0,
            mintedAt:         block.timestamp
        });

        agentTokenId[agent] = tokenId;

        emit AgentMinted(tokenId, agent, name, role, block.timestamp);
    }

    // ─── Decision Logging (ERC-8004 core) ────────────────────────────────────

    /**
     * @notice Called by an agent (or the economy contract on their behalf)
     *         to permanently log a decision to their on-chain record.
     *
     * @param agent          The agent whose record is being updated.
     * @param taskId         Unique identifier of the task.
     * @param decision       Outcome string: "ACCEPT" | "REJECT" | "COMPLETE" | "FAIL"
     * @param details        Human-readable detail string (kept short for gas).
     * @param reputationDelta Signed reputation change (-10 to +10 typical).
     */
    function logDecision(
        address agent,
        bytes32 taskId,
        string  calldata decision,
        string  calldata details,
        int8    reputationDelta
    ) external {
        uint256 tokenId = agentTokenId[agent];
        if (tokenId == 0) revert NoIdentityFound(agent);

        // Only the agent itself or the economy contract (owner) may log
        if (msg.sender != agent && msg.sender != owner()) {
            revert Unauthorized(msg.sender);
        }

        AgentProfile storage p = profiles[tokenId];
        p.totalDecisions++;

        // Apply reputation delta safely
        uint256 newRep;
        if (reputationDelta >= 0) {
            newRep = p.reputationScore + uint256(uint8(reputationDelta));
            if (newRep > 1000) newRep = 1000; // cap
        } else {
            uint256 decrease = uint256(uint8(-reputationDelta));
            newRep = p.reputationScore > decrease
                ? p.reputationScore - decrease
                : 0;
        }

        p.reputationScore = newRep;

        // Track successful outcomes
        if (
            keccak256(bytes(decision)) == keccak256(bytes("COMPLETE"))
        ) {
            p.successfulTasks++;
        }

        emit DecisionLogged(
            tokenId,
            agent,
            taskId,
            decision,
            details,
            reputationDelta >= 0
                ? uint256(uint8(reputationDelta))
                : uint256(uint8(-reputationDelta)),
            newRep,
            block.timestamp
        );

        emit ReputationUpdated(tokenId, agent, reputationDelta, newRep);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    function getProfile(address agent)
        external
        view
        returns (AgentProfile memory)
    {
        uint256 tokenId = agentTokenId[agent];
        if (tokenId == 0) revert NoIdentityFound(agent);
        return profiles[tokenId];
    }

    function getReputation(address agent) external view returns (uint256) {
        uint256 tokenId = agentTokenId[agent];
        if (tokenId == 0) return 0;
        return profiles[tokenId].reputationScore;
    }

    function totalAgents() external view returns (uint256) {
        return _tokenIdCounter;
    }

    // ─── Soulbound override (optional – uncomment to make non-transferable) ───
    // function _update(address to, uint256 tokenId, address auth)
    //     internal override returns (address) {
    //     address from = _ownerOf(tokenId);
    //     require(from == address(0), "AgentIdentity: soulbound");
    //     return super._update(to, tokenId, auth);
    // }
}