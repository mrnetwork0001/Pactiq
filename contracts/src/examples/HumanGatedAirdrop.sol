// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPactiqReputation} from "../IPactiqReputation.sol";

/**
 * @title HumanGatedAirdrop
 * @notice Example integration: any QIE project can gate a reward on Pactiq's Proof-of-Human score
 *         with one external call. Fund it with QIE; each verified human can claim once.
 */
contract HumanGatedAirdrop {
    IPactiqReputation public immutable reputation;
    uint256 public immutable minScore;
    uint256 public immutable amountPerClaim;
    mapping(address => bool) public claimed;

    error NotVerifiedHuman();
    error AlreadyClaimed();
    error TransferFailed();

    constructor(IPactiqReputation _reputation, uint256 _minScore, uint256 _amountPerClaim) payable {
        reputation = _reputation;
        minScore = _minScore;
        amountPerClaim = _amountPerClaim;
    }

    function claim() external {
        if (claimed[msg.sender]) revert AlreadyClaimed();
        if (!reputation.isVerifiedHuman(msg.sender, minScore)) revert NotVerifiedHuman();
        claimed[msg.sender] = true;
        (bool ok,) = msg.sender.call{value: amountPerClaim}("");
        if (!ok) revert TransferFailed();
    }

    receive() external payable {}
}
