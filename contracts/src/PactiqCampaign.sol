// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPactiqReputation} from "./IPactiqReputation.sol";

/**
 * @title PactiqCampaign
 * @notice A first-come, first-served reward for keeping a streak on Pactiq.
 *
 * The sponsor funds the contract with QIE. While the campaign is open, any wallet whose best
 * streak in the Pactiq vault has reached `minStreak` days can claim one fixed reward, until
 * `maxWinners` rewards are gone. Anyone may take part; only the first to qualify AND claim are paid.
 *
 * The streak is read from the vault, so it can only come from AI-witnessed daily check-ins on a
 * staked pact. Every term is fixed at deployment and cannot be changed. The owner's only power is
 * to take back what was never claimed, once the campaign has ended or every reward has been paid.
 */
contract PactiqCampaign is Ownable2Step, ReentrancyGuard {
    /// @notice Why a wallet can or cannot claim right now.
    enum Status {
        Eligible,
        NotStarted,
        Ended,
        AllClaimed,
        AlreadyClaimed,
        StreakTooShort,
        NotFunded
    }

    /// @notice The Pactiq vault whose streak record decides who qualifies.
    IPactiqReputation public immutable vault;
    /// @notice QIE paid to each winner, in wei.
    uint256 public immutable reward;
    /// @notice How many rewards there are.
    uint256 public immutable maxWinners;
    /// @notice Consecutive verified days, on one pact, needed to qualify.
    uint256 public immutable minStreak;
    /// @notice Claims open at this time.
    uint256 public immutable startsAt;
    /// @notice Claims close at this time, if rewards are still left.
    uint256 public immutable endsAt;

    /// @notice Whether a wallet has been paid.
    mapping(address => bool) public claimed;
    address[] private _winners;

    event Funded(address indexed from, uint256 amount);
    event Claimed(address indexed winner, uint256 indexed place, uint256 amount);
    event UnclaimedWithdrawn(address indexed to, uint256 amount);

    error ZeroAddress();
    error BadTerms();
    error CannotClaim(Status status);
    error StillRunning();
    error TransferFailed();

    constructor(
        address _vault,
        uint256 _reward,
        uint256 _maxWinners,
        uint256 _minStreak,
        uint256 _startsAt,
        uint256 _endsAt
    ) Ownable(msg.sender) {
        if (_vault == address(0)) revert ZeroAddress();
        if (_reward == 0 || _maxWinners == 0 || _minStreak == 0 || _endsAt <= _startsAt) revert BadTerms();
        vault = IPactiqReputation(_vault);
        reward = _reward;
        maxWinners = _maxWinners;
        minStreak = _minStreak;
        startsAt = _startsAt;
        endsAt = _endsAt;
    }

    /// @notice Anyone can add to the prize money.
    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Claim one reward. Reverts with the reason if the caller cannot claim right now.
    function claim() external nonReentrant {
        Status status = statusOf(msg.sender);
        if (status != Status.Eligible) revert CannotClaim(status);

        claimed[msg.sender] = true;
        _winners.push(msg.sender);
        emit Claimed(msg.sender, _winners.length, reward);

        (bool ok,) = msg.sender.call{value: reward}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Take back unclaimed prize money, once the campaign is over or every reward is paid.
    function withdrawUnclaimed(address payable to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (block.timestamp < endsAt && _winners.length < maxWinners) revert StillRunning();
        uint256 amount = address(this).balance;
        emit UnclaimedWithdrawn(to, amount);
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Whether `user` could claim right now, and if not, the first reason why.
    function statusOf(address user) public view returns (Status) {
        if (claimed[user]) return Status.AlreadyClaimed;
        if (_winners.length >= maxWinners) return Status.AllClaimed;
        if (block.timestamp < startsAt) return Status.NotStarted;
        if (block.timestamp >= endsAt) return Status.Ended;
        if (vault.getHumanProfile(user).bestStreak < minStreak) return Status.StreakTooShort;
        if (address(this).balance < reward) return Status.NotFunded;
        return Status.Eligible;
    }

    /// @notice The winners so far, in the order they claimed.
    function winners() external view returns (address[] memory) {
        return _winners;
    }

    function winnersCount() external view returns (uint256) {
        return _winners.length;
    }

    /// @notice Rewards still available.
    function rewardsLeft() external view returns (uint256) {
        return maxWinners - _winners.length;
    }

    /// @notice Whether the contract holds enough QIE to pay every reward that is left.
    function fullyFunded() external view returns (bool) {
        return address(this).balance >= (maxWinners - _winners.length) * reward;
    }
}
