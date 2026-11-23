// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPactiqReputation
 * @notice Proof-of-Human reputation for the QIE ecosystem.
 *
 * Pactiq users earn reputation by doing something bots can't do cheaply: staking real QIE and
 * passing an AI-verified photo check-in every day. Any QIE dApp can read this to gate airdrops,
 * allowlists, faucets or governance against sybil farms.
 *
 * Score formula (see PactiqVault.getHumanProfile):
 *   10 per verified check-in + 100 per completed pact + 20 per day of best streak
 *   − 50 per failed pact (floored at 0)
 */
interface IPactiqReputation {
    struct HumanProfile {
        uint256 score;
        uint256 checkIns;
        uint256 completedPacts;
        uint256 failedPacts;
        uint256 bestStreak;
        uint256 firstActivity; // timestamp of first pact, 0 if never active
        uint8 badges; // bitmask: 1 = 7-day streak, 2 = 30-day streak, 4 = 100-day streak
    }

    function humanScore(address user) external view returns (uint256);

    function isVerifiedHuman(address user, uint256 minScore) external view returns (bool);

    function getHumanProfile(address user) external view returns (HumanProfile memory);
}
