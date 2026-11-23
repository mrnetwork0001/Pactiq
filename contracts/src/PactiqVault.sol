// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPactiqReputation} from "./IPactiqReputation.sol";
import {IQieNames} from "./IQieNames.sol";

/// @notice Minimal Chainlink-compatible interface implemented by the QIE Oracle price feeds.
interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface IPactiqBadges {
    function mint(address to, uint8 tier) external returns (uint256);
}

/**
 * @title PactiqVault
 * @notice Proof-of-Discipline staking on QIE.
 *
 *  Solo pacts   Lock QIE or QUSDC behind a daily habit, check in daily with an AI-verifier
 *               attestation, get verified days back. Missed days go to that asset's community
 *               bonus pool (95%) and protocol fees (5%) — or, in charity mode, 100% to a cause.
 *  Squads       Friends (or a sponsor's community) commit together with a shared start date.
 *               Members' missed stakes, plus any sponsor money, are split between the finishers.
 *  USD pacts    Commit "$1/day" in QIE: the amount is priced on-chain with the QIE Oracle.
 *               Or stake QUSDC, QIE's dollar stablecoin, and the stake never moves with the price.
 *  QIE ID       Names on pacts are checked against QIE's name service (IQieNames).
 *  Reputation   Verified check-ins, completions and streaks form one Proof-of-Human score across
 *               assets (IPactiqReputation) and mint soulbound streak badges.
 *
 * Every stake asset has its own ledger. Accounting invariant per asset (checked in tests):
 *   balance(asset) >= activeStake + rewardPool + protocolFees + squadEscrow + charityEscrow
 */
contract PactiqVault is IPactiqReputation, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

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
        uint256 dailyStake; // smallest unit of `asset` per day
        uint256 totalDays;
        uint256 startTime;
        uint256 checkInCount;
        uint256 lastCheckInDay;
        uint256 totalStaked;
        PactStatus status;
        string qieId;
        uint256 squadId; // 0 = solo pact
        address charity; // 0 = community pool (solo pacts only)
        uint256 bestStreak; // longest run of consecutive verified days in this pact
        address asset; // NATIVE (QIE) or an approved ERC-20 such as QUSDC
    }

    struct Squad {
        uint256 id;
        address creator;
        string title;
        Category category;
        uint256 dailyStake;
        uint256 totalDays;
        uint256 startTime;
        uint256 maxMembers;
        uint256 memberCount;
        string sponsor; // display name of the sponsor ("" for friend squads)
        uint256 sponsorPool; // sponsor funds, held until finalization
        uint256 pot; // after finalization: unpaid finisher bonuses
        uint256 finisherCount;
        uint256 bonusPerFinisher;
        bool finalized;
        address asset;
    }

    struct Charity {
        address account;
        string name;
        bool active;
        uint256 totalReceived; // in the asset getCharities was asked about
        uint256 pending;
    }

    /// @notice Per-asset accounting. Amounts are in the asset's smallest unit.
    struct Ledger {
        bool listed; // ever accepted; keeps funding and payouts working after it is disabled
        uint256 minStakePerDay; // 0 = closed to new pacts and squads
        uint256 activeStake;
        uint256 rewardPool;
        uint256 protocolFees;
        uint256 squadEscrow;
        uint256 charityEscrow;
        uint256 volume;
        uint256 slashed;
        uint256 bonusesPaid;
        uint256 donated;
        uint256 sponsored;
    }

    struct ProtocolStats {
        uint256 pactCount;
        uint256 squadCount;
        uint256 activeStake;
        uint256 rewardPool;
        uint256 volume;
        uint256 slashed;
        uint256 checkIns;
        uint256 completed;
        uint256 failed;
        uint256 bonusesPaid;
        uint256 donated;
        uint256 sponsored;
    }

    // --- Constants ---
    address public constant NATIVE = address(0);
    uint256 public constant MIN_DAYS = 3;
    uint256 public constant MAX_DAYS = 100;
    uint256 public constant MAX_TITLE_LENGTH = 80;
    uint256 public constant MAX_QIE_ID_LENGTH = 32;
    uint256 public constant MAX_SPONSOR_LENGTH = 40;
    uint256 public constant MAX_SQUAD_MEMBERS = 100;
    uint256 public constant MAX_SQUAD_START_DELAY = 14 days;
    uint256 public constant SQUAD_JOIN_GRACE = 12 hours; // late joiners can still make day 1
    uint256 public constant DAY_DURATION = 1 days;
    uint256 public constant GRACE_PERIOD = 12 hours;
    uint256 public constant PRICE_MAX_AGE = 1 days;
    uint256 public constant PROTOCOL_FEE_BPS = 500;
    uint256 public constant BASE_BONUS_BPS = 1500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // --- State ---
    uint256 public nextPactId = 1;
    uint256 public nextSquadId = 1;
    address public oracleSigner;
    IAggregatorV3 public priceFeed;
    IPactiqBadges public badges;
    IQieNames public qieNames;

    uint256 public totalCheckIns;
    uint256 public totalCompletedPacts;
    uint256 public totalFailedPacts;

    mapping(address => Ledger) private _ledgers;
    address[] private _assetList;

    mapping(uint256 => Pact) internal pacts;
    mapping(address => uint256[]) private _userPacts;
    mapping(uint256 => mapping(uint256 => bool)) public dayCheckedIn;
    mapping(bytes32 => bool) public usedProofHashes;

    mapping(uint256 => Squad) private _squads;
    mapping(uint256 => uint256[]) private _squadPacts;
    mapping(uint256 => mapping(address => uint256)) public squadPactOf; // squadId => member => pactId

    address[] private _charityList;
    mapping(address => Charity) private _charities; // account, name, active
    mapping(address => mapping(address => uint256)) public charityReceived; // charity => asset => amount
    mapping(address => mapping(address => uint256)) public charityPending; // charity => asset => amount

    mapping(address => uint256) public userTotalCheckIns;
    mapping(address => uint256) public userCompletedPacts;
    mapping(address => uint256) public userFailedPacts;
    mapping(address => mapping(address => uint256)) public userRewardsEarned; // user => asset => amount
    mapping(address => uint256) public userBestStreak;
    mapping(address => uint256) public userFirstActivity;
    mapping(address => uint8) public userBadges;
    mapping(address => string) public userQieId;

    // --- Events ---
    event PactCreated(
        uint256 indexed pactId,
        address indexed creator,
        string title,
        Category category,
        uint256 dailyStake,
        uint256 totalDays,
        string qieId,
        address asset
    );
    event PactPricedInUsd(uint256 indexed pactId, uint256 usdPerDay, uint256 qiePrice, uint8 priceDecimals);
    event CheckInVerified(uint256 indexed pactId, address indexed user, uint256 indexed dayIndex, bytes32 proofHash);
    event PactSettled(
        uint256 indexed pactId,
        address indexed user,
        uint256 refundedPrincipal,
        uint256 bonusReward,
        uint256 slashedAmount,
        PactStatus status
    );
    event SquadCreated(
        uint256 indexed squadId,
        address indexed creator,
        string title,
        uint256 dailyStake,
        uint256 totalDays,
        uint256 startTime,
        string sponsor,
        address asset
    );
    event SquadJoined(uint256 indexed squadId, uint256 indexed pactId, address indexed member);
    event SquadSponsored(uint256 indexed squadId, address indexed sponsor, uint256 amount);
    event SquadFinalized(uint256 indexed squadId, uint256 finishers, uint256 bonusPerFinisher, uint256 toCommunity);
    event BadgeEarned(address indexed user, uint8 tier, uint256 streak);
    event CharityUpdated(address indexed charity, string name, bool active);
    event CharityDonation(uint256 indexed pactId, address indexed charity, uint256 amount);
    event CharityReleased(address indexed charity, address indexed asset, uint256 amount);
    event RewardPoolFunded(address indexed from, address indexed asset, uint256 amount);
    event ProtocolFeesWithdrawn(address indexed to, address indexed asset, uint256 amount);
    event OracleSignerUpdated(address oldSigner, address newSigner);
    event PriceFeedUpdated(address oldFeed, address newFeed);
    event BadgesUpdated(address badges);
    event QieNamesUpdated(address qieNames);
    event StakeAssetUpdated(address indexed asset, uint256 minStakePerDay);

    // --- Errors ---
    error InvalidDuration();
    error InsufficientStake();
    error InvalidTitle();
    error InvalidQieId();
    error QieIdNotOwned();
    error PactNotFound();
    error PactNotActive();
    error Unauthorized();
    error DayAlreadyCheckedIn();
    error DayOutOfRange();
    error CheckInWindowClosed();
    error ProofAlreadyUsed();
    error InvalidOracleSignature();
    error PactStillInProgress();
    error TransferFailed();
    error ZeroAddress();
    error NothingToWithdraw();
    error PriceUnavailable();
    error InvalidCharity();
    error UnsupportedAsset();
    error SquadNotFound();
    error InvalidSquadConfig();
    error SquadClosed();
    error SquadFull();
    error AlreadyInSquad();
    error SquadStillRunning();
    error SquadAlreadyFinalized();

    constructor(address _oracleSigner, address _priceFeed) Ownable(msg.sender) {
        if (_oracleSigner == address(0)) revert ZeroAddress();
        oracleSigner = _oracleSigner;
        priceFeed = IAggregatorV3(_priceFeed);
        emit OracleSignerUpdated(address(0), _oracleSigner);
        emit PriceFeedUpdated(address(0), _priceFeed);
        _setStakeAsset(NATIVE, 0.01 ether);
    }

    // =====================================================================
    // Solo pacts
    // =====================================================================

    /// @notice Lock `dailyStake * totalDays` of `asset` behind a daily habit. Day 1 starts now.
    /// @param asset NATIVE (send QIE as value) or an approved token such as QUSDC (approve first).
    /// @param charity 0 for the community pool, or an approved charity to receive missed stakes.
    function createPact(
        string calldata title,
        Category category,
        address asset,
        uint256 dailyStake,
        uint256 totalDays,
        string calldata qieId,
        address charity
    ) external payable whenNotPaused nonReentrant returns (uint256 pactId) {
        _validatePactParams(title, asset, dailyStake, totalDays);
        _collect(asset, dailyStake * totalDays);
        pactId = _newPact(title, category, asset, dailyStake, totalDays, qieId, block.timestamp, 0, charity);
    }

    /**
     * @notice Commit a USD amount per day, paid in QIE priced on-chain with the QIE Oracle.
     * @param usdPerDay USD per day with 18 decimals (1e18 = $1).
     * Send at least the quoted amount (see quotePactUsd); any excess is refunded.
     */
    function createPactUsd(
        string calldata title,
        Category category,
        uint256 usdPerDay,
        uint256 totalDays,
        string calldata qieId,
        address charity
    ) external payable whenNotPaused nonReentrant returns (uint256 pactId) {
        (uint256 price, uint8 decimals) = _freshPrice();
        uint256 dailyStake = (usdPerDay * (10 ** decimals)) / price;
        uint256 required = dailyStake * totalDays;
        if (msg.value < required) revert InsufficientStake();
        _validatePactParams(title, NATIVE, dailyStake, totalDays);

        pactId = _newPact(title, category, NATIVE, dailyStake, totalDays, qieId, block.timestamp, 0, charity);
        emit PactPricedInUsd(pactId, usdPerDay, price, decimals);

        if (msg.value > required) _send(NATIVE, msg.sender, msg.value - required);
    }

    // =====================================================================
    // Squads & sponsored challenges
    // =====================================================================

    /**
     * @notice Create a squad: a shared challenge that friends join with an invite link.
     *         `sponsorAmount` (in the squad's asset) is split among the finishers.
     * @param startTime when day 1 opens for every member (now .. now + 14 days)
     * @param sponsor display name for sponsored challenges, "" for friend squads
     */
    function createSquad(
        string calldata title,
        Category category,
        address asset,
        uint256 dailyStake,
        uint256 totalDays,
        uint256 startTime,
        uint256 maxMembers,
        string calldata sponsor,
        uint256 sponsorAmount
    ) external payable whenNotPaused nonReentrant returns (uint256 squadId) {
        _validatePactParams(title, asset, dailyStake, totalDays);
        if (
            startTime < block.timestamp || startTime > block.timestamp + MAX_SQUAD_START_DELAY || maxMembers < 2
                || maxMembers > MAX_SQUAD_MEMBERS || bytes(sponsor).length > MAX_SPONSOR_LENGTH
        ) revert InvalidSquadConfig();
        _collect(asset, sponsorAmount);

        squadId = nextSquadId++;
        Squad storage s = _squads[squadId];
        s.id = squadId;
        s.creator = msg.sender;
        s.title = title;
        s.category = category;
        s.dailyStake = dailyStake;
        s.totalDays = totalDays;
        s.startTime = startTime;
        s.maxMembers = maxMembers;
        s.sponsor = sponsor;
        s.asset = asset;

        _emitSquadCreated(s);
        if (sponsorAmount > 0) _sponsor(s, sponsorAmount);
    }

    /// @notice Join a squad by staking its daily amount × days. Open until 12h after the start.
    function joinSquad(uint256 squadId, string calldata qieId)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256 pactId)
    {
        Squad storage s = _squads[squadId];
        if (s.creator == address(0)) revert SquadNotFound();
        if (s.finalized || block.timestamp > s.startTime + SQUAD_JOIN_GRACE) revert SquadClosed();
        if (s.memberCount >= s.maxMembers) revert SquadFull();
        if (squadPactOf[squadId][msg.sender] != 0) revert AlreadyInSquad();
        _collect(s.asset, s.dailyStake * s.totalDays);

        pactId =
            _newPact(s.title, s.category, s.asset, s.dailyStake, s.totalDays, qieId, s.startTime, squadId, address(0));
        squadPactOf[squadId][msg.sender] = pactId;
        _squadPacts[squadId].push(pactId);
        s.memberCount++;
        emit SquadJoined(squadId, pactId, msg.sender);
    }

    /// @notice Add sponsorship (in the squad's asset) to its finisher pot. Brands, DAOs, friends, anyone.
    function sponsorSquad(uint256 squadId, uint256 amount) external payable nonReentrant {
        Squad storage s = _squads[squadId];
        if (s.creator == address(0)) revert SquadNotFound();
        if (s.finalized || block.timestamp > squadEndsAt(squadId)) revert SquadClosed();
        if (amount == 0) revert InsufficientStake();
        _collect(s.asset, amount);
        _sponsor(s, amount);
    }

    /**
     * @notice After a squad ends (incl. grace), split members' slashed stake (minus the 5% fee)
     *         plus sponsorship equally among finishers. If nobody finished, it all goes to the
     *         community pool. Called automatically by the first settlePact of a member.
     */
    function finalizeSquad(uint256 squadId) public {
        Squad storage s = _squads[squadId];
        if (s.creator == address(0)) revert SquadNotFound();
        if (s.finalized) revert SquadAlreadyFinalized();
        if (block.timestamp <= squadEndsAt(squadId)) revert SquadStillRunning();
        Ledger storage L = _ledgers[s.asset];

        uint256[] storage members = _squadPacts[squadId];
        uint256 slashed;
        uint256 finishers;
        for (uint256 i = 0; i < members.length; i++) {
            Pact storage p = pacts[members[i]];
            slashed += p.totalStaked - p.checkInCount * p.dailyStake;
            if (p.checkInCount == p.totalDays) finishers++;
        }

        uint256 fee = (slashed * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 pot = slashed - fee + s.sponsorPool;
        L.activeStake -= slashed;
        L.slashed += slashed;
        L.protocolFees += fee;
        L.squadEscrow += slashed - fee; // sponsorPool is already in escrow

        uint256 toCommunity;
        if (finishers > 0) {
            s.bonusPerFinisher = pot / finishers;
            s.pot = s.bonusPerFinisher * finishers;
            toCommunity = pot - s.pot; // rounding dust
        } else {
            toCommunity = pot;
        }
        L.squadEscrow -= toCommunity;
        L.rewardPool += toCommunity;

        s.sponsorPool = 0;
        s.finisherCount = finishers;
        s.finalized = true;
        emit SquadFinalized(squadId, finishers, s.bonusPerFinisher, toCommunity);
    }

    // =====================================================================
    // Check-ins & settlement
    // =====================================================================

    /**
     * @notice Record a verified check-in for `dayIndex`.
     * @dev Day N's window opens at startTime + (N-1) days and closes GRACE_PERIOD after the day ends.
     */
    function checkIn(uint256 pactId, uint256 dayIndex, bytes32 proofHash, bytes calldata signature)
        external
        nonReentrant
    {
        Pact storage pact = pacts[pactId];
        if (pact.creator == address(0)) revert PactNotFound();
        if (pact.status != PactStatus.ACTIVE) revert PactNotActive();
        if (msg.sender != pact.creator) revert Unauthorized();
        if (dayIndex < 1 || dayIndex > pact.totalDays) revert DayOutOfRange();
        if (dayCheckedIn[pactId][dayIndex]) revert DayAlreadyCheckedIn();
        if (usedProofHashes[proofHash]) revert ProofAlreadyUsed();

        (uint256 opensAt, uint256 closesAt) = _dayWindow(pact, dayIndex);
        if (block.timestamp < opensAt || block.timestamp > closesAt) revert CheckInWindowClosed();

        _requireOracleSignature(checkInDigest(pactId, dayIndex, proofHash, msg.sender), signature);

        dayCheckedIn[pactId][dayIndex] = true;
        usedProofHashes[proofHash] = true;
        pact.checkInCount++;
        if (dayIndex > pact.lastCheckInDay) pact.lastCheckInDay = dayIndex;
        userTotalCheckIns[msg.sender]++;
        totalCheckIns++;

        _updateStreak(pact, dayIndex);

        emit CheckInVerified(pactId, msg.sender, dayIndex, proofHash);
    }

    /**
     * @notice Close a pact: refund verified days, slash missed days, pay any bonus.
     * @dev Anyone may call. Solo pacts that are fully checked in settle immediately; everything
     *      else waits until the last day's window (incl. grace) has closed. Squad pacts always
     *      wait for the squad to end so the finisher split is final.
     */
    function settlePact(uint256 pactId) external nonReentrant {
        Pact storage pact = pacts[pactId];
        if (pact.creator == address(0)) revert PactNotFound();
        if (pact.status != PactStatus.ACTIVE) revert PactNotActive();
        address asset = pact.asset;
        Ledger storage L = _ledgers[asset];

        bool fullyCompleted = pact.checkInCount == pact.totalDays;
        uint256 refundedPrincipal = pact.checkInCount * pact.dailyStake;
        uint256 slashedAmount = pact.totalStaked - refundedPrincipal;
        uint256 bonusReward;

        if (pact.squadId != 0) {
            Squad storage s = _squads[pact.squadId];
            if (!s.finalized) finalizeSquad(pact.squadId); // reverts while the squad is running
            L.activeStake -= refundedPrincipal; // slashed part moved to the pot in finalize
            if (fullyCompleted) {
                bonusReward = s.bonusPerFinisher;
                s.pot -= bonusReward;
                L.squadEscrow -= bonusReward;
            }
        } else {
            if (!fullyCompleted && block.timestamp <= settleableAt(pactId)) revert PactStillInProgress();
            L.activeStake -= pact.totalStaked;

            if (slashedAmount > 0) {
                L.slashed += slashedAmount;
                if (pact.charity != address(0)) {
                    charityPending[pact.charity][asset] += slashedAmount;
                    charityReceived[pact.charity][asset] += slashedAmount;
                    L.charityEscrow += slashedAmount;
                    L.donated += slashedAmount;
                    emit CharityDonation(pactId, pact.charity, slashedAmount);
                } else {
                    uint256 fee = (slashedAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
                    L.protocolFees += fee;
                    L.rewardPool += slashedAmount - fee;
                }
            }
            if (fullyCompleted) {
                bonusReward = _bonusFor(pact.creator, asset, refundedPrincipal);
                L.rewardPool -= bonusReward;
            }
        }

        if (fullyCompleted) {
            pact.status = PactStatus.COMPLETED;
            userCompletedPacts[pact.creator]++;
            totalCompletedPacts++;
            if (bonusReward > 0) {
                userRewardsEarned[pact.creator][asset] += bonusReward;
                L.bonusesPaid += bonusReward;
            }
        } else {
            pact.status = PactStatus.FAILED;
            userFailedPacts[pact.creator]++;
            totalFailedPacts++;
        }

        emit PactSettled(pactId, pact.creator, refundedPrincipal, bonusReward, slashedAmount, pact.status);

        uint256 payout = refundedPrincipal + bonusReward;
        if (payout > 0) _send(asset, pact.creator, payout);
    }

    /// @notice Send a charity its accumulated donations in `asset`. Anyone can trigger it.
    function releaseCharity(address charity, address asset) external nonReentrant {
        uint256 amount = charityPending[charity][asset];
        if (amount == 0) revert NothingToWithdraw();
        charityPending[charity][asset] = 0;
        _ledgers[asset].charityEscrow -= amount;
        emit CharityReleased(charity, asset, amount);
        _send(asset, charity, amount);
    }

    /// @notice Top up the completion-bonus pool of a listed asset.
    function fundRewardPool(address asset, uint256 amount) external payable nonReentrant {
        Ledger storage L = _ledgers[asset];
        if (!L.listed) revert UnsupportedAsset();
        if (amount == 0) revert InsufficientStake();
        _collect(asset, amount);
        L.rewardPool += amount;
        emit RewardPoolFunded(msg.sender, asset, amount);
    }

    receive() external payable {
        _ledgers[NATIVE].rewardPool += msg.value;
        emit RewardPoolFunded(msg.sender, NATIVE, msg.value);
    }

    // =====================================================================
    // Proof-of-Human reputation (IPactiqReputation)
    // =====================================================================

    function getHumanProfile(address user) public view returns (HumanProfile memory p) {
        p.checkIns = userTotalCheckIns[user];
        p.completedPacts = userCompletedPacts[user];
        p.failedPacts = userFailedPacts[user];
        p.bestStreak = userBestStreak[user];
        p.firstActivity = userFirstActivity[user];
        p.badges = userBadges[user];
        uint256 gross = p.checkIns * 10 + p.completedPacts * 100 + p.bestStreak * 20;
        uint256 penalty = p.failedPacts * 50;
        p.score = gross > penalty ? gross - penalty : 0;
    }

    function humanScore(address user) external view returns (uint256) {
        return getHumanProfile(user).score;
    }

    function isVerifiedHuman(address user, uint256 minScore) external view returns (bool) {
        return getHumanProfile(user).score >= minScore && userTotalCheckIns[user] > 0;
    }

    // =====================================================================
    // Views
    // =====================================================================

    function checkInDigest(uint256 pactId, uint256 dayIndex, bytes32 proofHash, address user)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(address(this), block.chainid, pactId, dayIndex, proofHash, user));
    }

    function getPact(uint256 pactId) external view returns (Pact memory) {
        return pacts[pactId];
    }

    function getUserPacts(address user) external view returns (uint256[] memory) {
        return _userPacts[user];
    }

    function getPactDays(uint256 pactId) external view returns (bool[] memory checked) {
        uint256 total = pacts[pactId].totalDays;
        checked = new bool[](total);
        for (uint256 i = 0; i < total; i++) {
            checked[i] = dayCheckedIn[pactId][i + 1];
        }
    }

    function getCurrentDayIndex(uint256 pactId) public view returns (uint256) {
        Pact storage pact = pacts[pactId];
        if (pact.creator == address(0) || block.timestamp < pact.startTime) return 0;
        uint256 day = (block.timestamp - pact.startTime) / DAY_DURATION + 1;
        return day > pact.totalDays ? pact.totalDays : day;
    }

    function getDayWindow(uint256 pactId, uint256 dayIndex) external view returns (uint256 opensAt, uint256 closesAt) {
        Pact storage pact = pacts[pactId];
        if (dayIndex < 1 || dayIndex > pact.totalDays) revert DayOutOfRange();
        return _dayWindow(pact, dayIndex);
    }

    function isCheckInEligible(uint256 pactId, uint256 dayIndex) external view returns (bool) {
        Pact storage pact = pacts[pactId];
        if (pact.creator == address(0) || pact.status != PactStatus.ACTIVE) return false;
        if (dayIndex < 1 || dayIndex > pact.totalDays) return false;
        if (dayCheckedIn[pactId][dayIndex]) return false;
        (uint256 opensAt, uint256 closesAt) = _dayWindow(pact, dayIndex);
        return block.timestamp >= opensAt && block.timestamp <= closesAt;
    }

    function settleableAt(uint256 pactId) public view returns (uint256) {
        Pact storage pact = pacts[pactId];
        return pact.startTime + pact.totalDays * DAY_DURATION + GRACE_PERIOD;
    }

    function estimateBonus(address user, address asset, uint256 principal) external view returns (uint256) {
        return _bonusFor(user, asset, principal);
    }

    function getSquad(uint256 squadId) external view returns (Squad memory) {
        return _squads[squadId];
    }

    function getSquadPacts(uint256 squadId) external view returns (uint256[] memory) {
        return _squadPacts[squadId];
    }

    function squadEndsAt(uint256 squadId) public view returns (uint256) {
        Squad storage s = _squads[squadId];
        return s.startTime + s.totalDays * DAY_DURATION + GRACE_PERIOD;
    }

    /// @notice All causes, with what each has received and holds pending in `asset`.
    function getCharities(address asset) external view returns (Charity[] memory list) {
        list = new Charity[](_charityList.length);
        for (uint256 i = 0; i < list.length; i++) {
            address a = _charityList[i];
            list[i] = _charities[a];
            list[i].totalReceived = charityReceived[a][asset];
            list[i].pending = charityPending[a][asset];
        }
    }

    /// @notice Every asset ever accepted for staking, QIE (NATIVE) first.
    function getStakeAssets() external view returns (address[] memory) {
        return _assetList;
    }

    function getLedger(address asset) external view returns (Ledger memory) {
        return _ledgers[asset];
    }

    /// @notice Latest QIE price from the QIE Oracle. Returns zeros if no feed is set or it fails.
    function getQiePrice() public view returns (uint256 price, uint8 decimals, uint256 updatedAt) {
        if (address(priceFeed) == address(0)) return (0, 0, 0);
        try priceFeed.latestRoundData() returns (uint80, int256 answer, uint256, uint256 _updatedAt, uint80) {
            if (answer <= 0) return (0, 0, 0);
            try priceFeed.decimals() returns (uint8 d) {
                // casting to 'uint256' is safe because answer > 0 was checked above
                // forge-lint: disable-next-line(unsafe-typecast)
                return (uint256(answer), d, _updatedAt);
            } catch {
                return (0, 0, 0);
            }
        } catch {
            return (0, 0, 0);
        }
    }

    /// @notice USD value (18 decimals) of an amount of QIE wei.
    function quoteUsd(uint256 qieAmount) external view returns (uint256) {
        (uint256 price, uint8 decimals,) = getQiePrice();
        if (price == 0) return 0;
        return (qieAmount * price) / (10 ** decimals);
    }

    /// @notice QIE wei needed for `usdPerDay` (18 decimals) over `totalDays`, as createPactUsd computes it.
    function quotePactUsd(uint256 usdPerDay, uint256 totalDays)
        external
        view
        returns (uint256 dailyStake, uint256 totalStake)
    {
        (uint256 price, uint8 decimals) = _freshPrice();
        dailyStake = (usdPerDay * (10 ** decimals)) / price;
        totalStake = dailyStake * totalDays;
    }

    /// @notice Protocol-wide counts plus the money totals of one asset.
    function getProtocolStats(address asset) external view returns (ProtocolStats memory) {
        Ledger storage L = _ledgers[asset];
        return ProtocolStats({
            pactCount: nextPactId - 1,
            squadCount: nextSquadId - 1,
            activeStake: L.activeStake,
            rewardPool: L.rewardPool,
            volume: L.volume,
            slashed: L.slashed,
            checkIns: totalCheckIns,
            completed: totalCompletedPacts,
            failed: totalFailedPacts,
            bonusesPaid: L.bonusesPaid,
            donated: L.donated,
            sponsored: L.sponsored
        });
    }

    // =====================================================================
    // Admin
    // =====================================================================

    function setOracleSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit OracleSignerUpdated(oracleSigner, newSigner);
        oracleSigner = newSigner;
    }

    function setPriceFeed(address newFeed) external onlyOwner {
        emit PriceFeedUpdated(address(priceFeed), newFeed);
        priceFeed = IAggregatorV3(newFeed);
    }

    function setBadges(address newBadges) external onlyOwner {
        badges = IPactiqBadges(newBadges);
        emit BadgesUpdated(newBadges);
    }

    /// @notice The QIE ID checker. While unset, pacts can't carry a name.
    function setQieNames(address newQieNames) external onlyOwner {
        qieNames = IQieNames(newQieNames);
        emit QieNamesUpdated(newQieNames);
    }

    /**
     * @notice Accept `asset` for new pacts and squads with a minimum daily stake (smallest units),
     *         or pass 0 to close it to new ones. Existing pacts, pools and payouts keep working.
     * @dev Only list plain ERC-20s: fee-on-transfer tokens are rejected at deposit time.
     */
    function setStakeAsset(address asset, uint256 minStakePerDay) external onlyOwner {
        _setStakeAsset(asset, minStakePerDay);
    }

    /// @notice Add or update a cause users can donate missed stakes to. Deactivating only blocks new pacts.
    function setCharity(address account, string calldata name, bool active) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        Charity storage c = _charities[account];
        if (c.account == address(0)) {
            c.account = account;
            _charityList.push(account);
        }
        c.name = name;
        c.active = active;
        emit CharityUpdated(account, name, active);
    }

    function withdrawProtocolFees(address asset, address payable to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        Ledger storage L = _ledgers[asset];
        uint256 amount = L.protocolFees;
        if (amount == 0) revert NothingToWithdraw();
        L.protocolFees = 0;
        emit ProtocolFeesWithdrawn(to, asset, amount);
        _send(asset, to, amount);
    }

    /// @notice Pausing only blocks new pacts and squads. Check-ins and settlements keep working.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =====================================================================
    // Internal
    // =====================================================================

    function _setStakeAsset(address asset, uint256 minStakePerDay) internal {
        Ledger storage L = _ledgers[asset];
        if (!L.listed) {
            L.listed = true;
            _assetList.push(asset);
        }
        L.minStakePerDay = minStakePerDay;
        emit StakeAssetUpdated(asset, minStakePerDay);
    }

    function _validatePactParams(string calldata title, address asset, uint256 dailyStake, uint256 totalDays)
        internal
        view
    {
        uint256 minStake = _ledgers[asset].minStakePerDay;
        if (minStake == 0) revert UnsupportedAsset();
        if (totalDays < MIN_DAYS || totalDays > MAX_DAYS) revert InvalidDuration();
        if (dailyStake < minStake) revert InsufficientStake();
        uint256 titleLength = bytes(title).length;
        if (titleLength == 0 || titleLength > MAX_TITLE_LENGTH) revert InvalidTitle();
    }

    function _newPact(
        string memory title,
        Category category,
        address asset,
        uint256 dailyStake,
        uint256 totalDays,
        string calldata qieId,
        uint256 startTime,
        uint256 squadId,
        address charity
    ) internal returns (uint256 pactId) {
        if (bytes(qieId).length > 0) {
            if (bytes(qieId).length > MAX_QIE_ID_LENGTH) revert InvalidQieId();
            if (address(qieNames) == address(0) || !qieNames.owns(msg.sender, qieId)) revert QieIdNotOwned();
        }
        if (charity != address(0) && !_charities[charity].active) revert InvalidCharity();

        pactId = nextPactId++;
        Pact storage p = pacts[pactId];
        p.id = pactId;
        p.creator = msg.sender;
        p.title = title;
        p.category = category;
        p.dailyStake = dailyStake;
        p.totalDays = totalDays;
        p.startTime = startTime;
        p.totalStaked = dailyStake * totalDays;
        p.qieId = qieId;
        p.squadId = squadId;
        p.charity = charity;
        p.asset = asset;
        if (bytes(qieId).length > 0) userQieId[msg.sender] = qieId;
        _recordNewPact(p);
    }

    /// @dev Ledger, user bookkeeping and the event for a freshly written pact (kept apart for stack depth).
    function _recordNewPact(Pact storage p) internal {
        Ledger storage L = _ledgers[p.asset];
        L.volume += p.totalStaked;
        L.activeStake += p.totalStaked;
        _userPacts[p.creator].push(p.id);
        if (userFirstActivity[p.creator] == 0) userFirstActivity[p.creator] = block.timestamp;
        emit PactCreated(p.id, p.creator, p.title, p.category, p.dailyStake, p.totalDays, p.qieId, p.asset);
    }

    function _emitSquadCreated(Squad storage s) internal {
        emit SquadCreated(s.id, s.creator, s.title, s.dailyStake, s.totalDays, s.startTime, s.sponsor, s.asset);
    }

    function _sponsor(Squad storage s, uint256 amount) internal {
        Ledger storage L = _ledgers[s.asset];
        s.sponsorPool += amount;
        L.squadEscrow += amount;
        L.sponsored += amount;
        emit SquadSponsored(s.id, msg.sender, amount);
    }

    /// @dev Length of the consecutive run containing `dayIndex`; updates bests and awards badges.
    function _updateStreak(Pact storage pact, uint256 dayIndex) internal {
        uint256 run = 1;
        for (uint256 d = dayIndex; d > 1 && dayCheckedIn[pact.id][d - 1]; d--) {
            run++;
        }
        for (uint256 d = dayIndex + 1; d <= pact.totalDays && dayCheckedIn[pact.id][d]; d++) {
            run++;
        }
        if (run > pact.bestStreak) pact.bestStreak = run;

        address user = pact.creator;
        if (run <= userBestStreak[user]) return;
        userBestStreak[user] = run;

        uint8[3] memory thresholds = [7, 30, 100];
        for (uint8 tier = 0; tier < 3; tier++) {
            uint8 bit = uint8(1 << tier);
            if (run >= thresholds[tier] && userBadges[user] & bit == 0) {
                userBadges[user] |= bit;
                emit BadgeEarned(user, tier, run);
                if (address(badges) != address(0)) {
                    // A badge problem must never block a check-in.
                    try badges.mint(user, tier) {} catch {}
                }
            }
        }
    }

    function _freshPrice() internal view returns (uint256 price, uint8 decimals) {
        uint256 updatedAt;
        (price, decimals, updatedAt) = getQiePrice();
        if (price == 0 || block.timestamp > updatedAt + PRICE_MAX_AGE) revert PriceUnavailable();
    }

    function _dayWindow(Pact storage pact, uint256 dayIndex) internal view returns (uint256 opensAt, uint256 closesAt) {
        opensAt = pact.startTime + (dayIndex - 1) * DAY_DURATION;
        closesAt = opensAt + DAY_DURATION + GRACE_PERIOD;
    }

    function _bonusFor(address, address asset, uint256 principal) internal view returns (uint256) {
        uint256 maxReward = (principal * BASE_BONUS_BPS) / BPS_DENOMINATOR;
        uint256 pool = _ledgers[asset].rewardPool;
        return pool < maxReward ? pool : maxReward;
    }

    function _requireOracleSignature(bytes32 digest, bytes calldata signature) internal view {
        bytes32 ethDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(ethDigest, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != oracleSigner) revert InvalidOracleSignature();
    }

    /// @dev Take `amount` of `asset` from the caller: exact msg.value for QIE, transferFrom for tokens.
    function _collect(address asset, uint256 amount) internal {
        if (asset == NATIVE) {
            if (msg.value != amount) revert InsufficientStake();
            return;
        }
        if (msg.value != 0) revert InsufficientStake();
        if (amount == 0) return;
        IERC20 token = IERC20(asset);
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert UnsupportedAsset(); // fee-on-transfer
    }

    function _send(address asset, address to, uint256 amount) internal {
        if (asset == NATIVE) {
            (bool ok,) = payable(to).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            IERC20(asset).safeTransfer(to, amount);
        }
    }
}
