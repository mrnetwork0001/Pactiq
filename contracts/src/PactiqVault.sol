// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title PactiqVault
 * @notice Proof-of-Discipline Staking & Habit Commitment Protocol on QIE Mainnet.
 * Users stake QIE on daily commitments, verified via AI multimodal oracle attestations.
 * Successful users reclaim their principal plus a yield share from defaulters' slashed stakes.
 */
contract PactiqVault is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    enum Category {
        FITNESS,
        CODING,
        LEARNING,
        MEDITATION,
        CUSTOM
    }

    enum PactStatus {
        ACTIVE,
        COMPLETED,
        FAILED
    }

    struct Pact {
        uint256 id;
        address creator;
        string title;
        Category category;
        uint256 dailyStake;       // Amount staked per day in wei
        uint256 totalDays;        // Total duration in days (e.g. 7, 14, 21, 30)
        uint256 startTime;        // Timestamp when the pact starts
        uint256 checkInCount;     // Number of verified daily check-ins
        uint256 lastCheckInDay;   // 1-based index of last check-in
        uint256 totalStaked;      // dailyStake * totalDays
        PactStatus status;
        string qieId;             // User's .qie handle (e.g. "satoshi.qie")
    }

    // --- State Variables ---
    uint256 public nextPactId = 1;
    address public oracleSigner;              // AI verification signer
    uint256 public communityRewardPool;       // Slashed stakes available for completers
    uint256 public totalProtocolVolume;       // Cumulative QIE staked
    uint256 public totalSlashedVolume;        // Cumulative QIE slashed

    // Pact mappings
    mapping(uint256 => Pact) public pacts;
    mapping(address => uint256[]) private _userPacts;
    mapping(uint256 => mapping(uint256 => bool)) public dayCheckedIn; // pactId => dayIndex => verified
    mapping(bytes32 => bool) public usedProofHashes;                 // Replay attack prevention

    // User statistics (for leaderboard & reputation)
    mapping(address => uint256) public userTotalCheckIns;
    mapping(address => uint256) public userCompletedPacts;
    mapping(address => uint256) public userTotalRewardsEarned;
    mapping(address => string) public userQieId;
    mapping(address => bool) public qiePassVerified;                  // QIE Pass KYC verified status

    // Protocol constants
    uint256 public constant MIN_STAKE_PER_DAY = 0.01 ether;          // 0.01 QIE
    uint256 public constant PROTOCOL_FEE_BPS = 500;                  // 5% protocol maintenance fee
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant DAY_DURATION = 1 days;

    // --- Events ---
    event PactCreated(
        uint256 indexed pactId,
        address indexed creator,
        string title,
        Category category,
        uint256 dailyStake,
        uint256 totalDays,
        string qieId
    );

    event CheckInVerified(
        uint256 indexed pactId,
        address indexed user,
        uint256 indexed dayIndex,
        bytes32 proofHash
    );

    event PactSettled(
        uint256 indexed pactId,
        address indexed user,
        uint256 refundedPrincipal,
        uint256 bonusReward,
        uint256 slashedAmount,
        PactStatus status
    );

    event RewardPoolFunded(uint256 amount);
    event OracleSignerUpdated(address oldSigner, address newSigner);
    event QiePassStatusUpdated(address indexed user, bool isVerified);

    // --- Errors ---
    error InvalidDuration();
    error InsufficientStake();
    error PactNotActive();
    error Unauthorized();
    error DayAlreadyCheckedIn();
    error DayOutOfRange();
    error ProofAlreadyUsed();
    error InvalidOracleSignature();
    error PactStillInProgress();
    error TransferFailed();

    constructor(address _oracleSigner) Ownable(msg.sender) {
        require(_oracleSigner != address(0), "Invalid oracle address");
        oracleSigner = _oracleSigner;
    }

    /**
     * @notice Create and fund a new commitment pact with native QIE
     * @param title Title or description of the habit
     * @param category Category of the discipline
     * @param dailyStake Stake in wei per day
     * @param totalDays Number of days (between 3 and 100)
     * @param qieId Optional .qie username
     */
    function createPact(
        string calldata title,
        Category category,
        uint256 dailyStake,
        uint256 totalDays,
        string calldata qieId
    ) external payable nonReentrant returns (uint256 pactId) {
        if (totalDays < 3 || totalDays > 100) revert InvalidDuration();
        if (dailyStake < MIN_STAKE_PER_DAY) revert InsufficientStake();

        uint256 requiredStake = dailyStake * totalDays;
        if (msg.value != requiredStake) revert InsufficientStake();

        pactId = nextPactId++;

        pacts[pactId] = Pact({
            id: pactId,
            creator: msg.sender,
            title: title,
            category: category,
            dailyStake: dailyStake,
            totalDays: totalDays,
            startTime: block.timestamp,
            checkInCount: 0,
            lastCheckInDay: 0,
            totalStaked: requiredStake,
            status: PactStatus.ACTIVE,
            qieId: qieId
        });

        _userPacts[msg.sender].push(pactId);
        totalProtocolVolume += requiredStake;

        if (bytes(qieId).length > 0) {
            userQieId[msg.sender] = qieId;
        }

        emit PactCreated(pactId, msg.sender, title, category, dailyStake, totalDays, qieId);
    }

    /**
     * @notice Check in for a specific day with a cryptographic attestation signed by the AI Verifier
     * @param pactId ID of the pact
     * @param dayIndex 1-based day index (1 .. totalDays)
     * @param proofHash Keccak256 hash of the verified evidence media / data
     * @param signature Oracle signature attesting validity
     */
    function checkIn(
        uint256 pactId,
        uint256 dayIndex,
        bytes32 proofHash,
        bytes calldata signature
    ) external nonReentrant {
        Pact storage pact = pacts[pactId];

        if (pact.status != PactStatus.ACTIVE) revert PactNotActive();
        if (msg.sender != pact.creator) revert Unauthorized();
        if (dayIndex < 1 || dayIndex > pact.totalDays) revert DayOutOfRange();
        if (dayCheckedIn[pactId][dayIndex]) revert DayAlreadyCheckedIn();
        if (usedProofHashes[proofHash]) revert ProofAlreadyUsed();

        // Ensure the check-in is submitted within the allowed window for that day
        // Day 1 starts at startTime, ends at startTime + 1 days + 12h grace period
        uint256 dayStartTime = pact.startTime + ((dayIndex - 1) * DAY_DURATION);
        uint256 dayEndTime = dayStartTime + DAY_DURATION + 12 hours; // 12h grace period for timezone variance

        if (block.timestamp < dayStartTime || block.timestamp > dayEndTime) {
            revert DayOutOfRange();
        }

        // Verify Oracle Attestation
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(this),
                block.chainid,
                pactId,
                dayIndex,
                proofHash,
                msg.sender
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);

        address recovered = ethSignedHash.recover(signature);
        if (recovered != oracleSigner) revert InvalidOracleSignature();

        // Record check-in
        dayCheckedIn[pactId][dayIndex] = true;
        usedProofHashes[proofHash] = true;
        pact.checkInCount++;
        pact.lastCheckInDay = dayIndex;
        userTotalCheckIns[msg.sender]++;

        emit CheckInVerified(pactId, msg.sender, dayIndex, proofHash);
    }

    /**
     * @notice Settle a finished pact, refunding successful days and slashing missed days
     * @param pactId ID of the pact to settle
     */
    function settlePact(uint256 pactId) external nonReentrant {
        Pact storage pact = pacts[pactId];

        if (pact.status != PactStatus.ACTIVE) revert PactNotActive();
        
        // Must either be past the final deadline OR all days have already been successfully checked in
        uint256 finalDeadline = pact.startTime + (pact.totalDays * DAY_DURATION);
        if (block.timestamp < finalDeadline && pact.checkInCount < pact.totalDays) {
            revert PactStillInProgress();
        }

        uint256 successfulDays = pact.checkInCount;
        uint256 missedDays = pact.totalDays > successfulDays ? pact.totalDays - successfulDays : 0;

        uint256 refundedPrincipal = successfulDays * pact.dailyStake;
        uint256 slashedAmount = missedDays * pact.dailyStake;
        uint256 bonusReward = 0;

        if (slashedAmount > 0) {
            totalSlashedVolume += slashedAmount;
            uint256 protocolFee = (slashedAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 poolAddition = slashedAmount - protocolFee;
            communityRewardPool += poolAddition;
        }

        // If user completed 100% of their pact, they earn a share of the community slash pool!
        if (successfulDays == pact.totalDays) {
            pact.status = PactStatus.COMPLETED;
            userCompletedPacts[pact.creator]++;

            if (communityRewardPool > 0) {
                // Base reward: up to 15% of staked principal as discipline yield
                uint256 maxReward = (refundedPrincipal * 1500) / BPS_DENOMINATOR;
                
                // QIE Pass verified users get a 20% bonus boost
                if (qiePassVerified[pact.creator]) {
                    maxReward = (refundedPrincipal * 1800) / BPS_DENOMINATOR;
                }

                bonusReward = communityRewardPool > maxReward ? maxReward : communityRewardPool;
                communityRewardPool -= bonusReward;
                userTotalRewardsEarned[pact.creator] += bonusReward;
            }
        } else {
            pact.status = PactStatus.FAILED;
        }

        uint256 totalPayout = refundedPrincipal + bonusReward;
        emit PactSettled(
            pactId,
            pact.creator,
            refundedPrincipal,
            bonusReward,
            slashedAmount,
            pact.status
        );

        if (totalPayout > 0) {
            (bool success, ) = payable(pact.creator).call{value: totalPayout}("");
            if (!success) revert TransferFailed();
        }
    }

    // --- View Functions ---

    /**
     * @notice Get all pact IDs created by a user
     */
    function getUserPacts(address user) external view returns (uint256[] memory) {
        return _userPacts[user];
    }

    /**
     * @notice Check if a pact is eligible for check-in on a given day index
     */
    function isCheckInEligible(uint256 pactId, uint256 dayIndex) external view returns (bool) {
        Pact storage pact = pacts[pactId];
        if (pact.status != PactStatus.ACTIVE) return false;
        if (dayIndex < 1 || dayIndex > pact.totalDays) return false;
        if (dayCheckedIn[pactId][dayIndex]) return false;

        uint256 dayStartTime = pact.startTime + ((dayIndex - 1) * DAY_DURATION);
        uint256 dayEndTime = dayStartTime + DAY_DURATION + 12 hours;
        return (block.timestamp >= dayStartTime && block.timestamp <= dayEndTime);
    }

    /**
     * @notice Get current day index (1-based) for an active pact
     */
    function getCurrentDayIndex(uint256 pactId) external view returns (uint256) {
        Pact storage pact = pacts[pactId];
        if (block.timestamp < pact.startTime) return 0;
        uint256 elapsed = block.timestamp - pact.startTime;
        uint256 day = (elapsed / DAY_DURATION) + 1;
        return day > pact.totalDays ? pact.totalDays : day;
    }

    // --- Admin Functions ---

    function setOracleSigner(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid address");
        emit OracleSignerUpdated(oracleSigner, _newOracle);
        oracleSigner = _newOracle;
    }

    function setQiePassVerified(address user, bool status) external onlyOwner {
        qiePassVerified[user] = status;
        emit QiePassStatusUpdated(user, status);
    }

    function fundRewardPool() external payable {
        communityRewardPool += msg.value;
        emit RewardPoolFunded(msg.value);
    }

    function withdrawProtocolFees(address payable to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        uint256 currentBalance = address(this).balance;
        // Ensure community pool is not drained
        uint256 available = currentBalance > communityRewardPool ? currentBalance - communityRewardPool : 0;
        (bool success, ) = to.call{value: available}("");
        require(success, "Withdrawal failed");
    }

    receive() external payable {
        communityRewardPool += msg.value;
        emit RewardPoolFunded(msg.value);
    }
}
