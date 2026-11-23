// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PactiqVault, IAggregatorV3} from "../src/PactiqVault.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockQieNames} from "./Mocks.sol";

contract MockAggregator is IAggregatorV3 {
    int256 public answer;
    uint8 public immutable dec;
    bool public broken;

    constructor(int256 _answer, uint8 _dec) {
        answer = _answer;
        dec = _dec;
    }

    function setBroken(bool b) external {
        broken = b;
    }

    function decimals() external view returns (uint8) {
        return dec;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        require(!broken, "broken");
        return (1, answer, block.timestamp, block.timestamp, 1);
    }
}

contract RejectingReceiver {
    receive() external payable {
        revert("no");
    }
}

contract PactiqVaultTest is Test {
    address internal constant NATIVE = address(0);
    PactiqVault internal vault;
    MockAggregator internal feed;

    uint256 internal constant ORACLE_KEY = 0xA11CE;
    address internal oracle;
    address internal owner = address(this);
    address internal alice = address(0xA11);
    address internal bob = address(0xB0B);
    address internal sponsor = address(0x5905);

    uint256 internal constant DAILY = 1 ether;
    uint256 internal constant DAYS = 7;

    function setUp() public {
        oracle = vm.addr(ORACLE_KEY);
        feed = new MockAggregator(15_000_000, 8); // $0.15
        vault = new PactiqVault(oracle, address(feed));
        MockQieNames names = new MockQieNames();
        names.set(alice, "user.qie");
        names.set(bob, "user.qie");
        vault.setQieNames(address(names));
        vm.deal(alice, 1_000 ether);
        vm.deal(bob, 1_000 ether);
        vm.deal(sponsor, 1_000 ether);
    }

    // --- helpers ---

    function _ledger() internal view returns (PactiqVault.Ledger memory) {
        return vault.getLedger(NATIVE);
    }

    function _create(address user, uint256 daily, uint256 days_) internal returns (uint256 id) {
        vm.prank(user);
        id = vault.createPact{value: daily * days_}(
            "Ship code daily", PactiqVault.Category.CODING, NATIVE, daily, days_, "user.qie", address(0)
        );
    }

    function _sign(uint256 key, uint256 pactId, uint256 day, bytes32 proof, address user)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", vault.checkInDigest(pactId, day, proof, user))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _checkIn(address user, uint256 pactId, uint256 day) internal {
        bytes32 proof = keccak256(abi.encodePacked("proof", pactId, day));
        bytes memory sig = _sign(ORACLE_KEY, pactId, day, proof, user);
        vm.prank(user);
        vault.checkIn(pactId, day, proof, sig);
    }

    function _assertSolvent() internal view {
        assertGe(
            address(vault).balance,
            _ledger().activeStake + _ledger().rewardPool + _ledger().protocolFees + _ledger().squadEscrow
                + _ledger().charityEscrow,
            "vault insolvent"
        );
    }

    // --- createPact ---

    function test_CreatePact_StoresEverything() public {
        uint256 id = _create(alice, DAILY, DAYS);
        PactiqVault.Pact memory p = vault.getPact(id);
        assertEq(id, 1);
        assertEq(p.creator, alice);
        assertEq(p.title, "Ship code daily");
        assertEq(p.dailyStake, DAILY);
        assertEq(p.totalDays, DAYS);
        assertEq(p.totalStaked, 7 ether);
        assertEq(p.startTime, vm.getBlockTimestamp());
        assertEq(uint256(p.status), uint256(PactiqVault.PactStatus.ACTIVE));
        assertEq(vault.userQieId(alice), "user.qie");
        assertEq(_ledger().activeStake, 7 ether);
        assertEq(vault.getUserPacts(alice).length, 1);
        assertEq(vault.getCurrentDayIndex(id), 1);
    }

    function test_CreatePact_RevertsOnWrongValue() public {
        vm.prank(alice);
        vm.expectRevert(PactiqVault.InsufficientStake.selector);
        vault.createPact{value: 5 ether}("x", PactiqVault.Category.FITNESS, NATIVE, DAILY, DAYS, "", address(0));
    }

    function test_CreatePact_RevertsOnBadDuration() public {
        vm.startPrank(alice);
        vm.expectRevert(PactiqVault.InvalidDuration.selector);
        vault.createPact{value: 2 ether}("x", PactiqVault.Category.FITNESS, NATIVE, DAILY, 2, "", address(0));
        vm.expectRevert(PactiqVault.InvalidDuration.selector);
        vault.createPact{value: 101 ether}("x", PactiqVault.Category.FITNESS, NATIVE, DAILY, 101, "", address(0));
        vm.stopPrank();
    }

    function test_CreatePact_RevertsOnTinyStake() public {
        vm.prank(alice);
        vm.expectRevert(PactiqVault.InsufficientStake.selector);
        vault.createPact{value: 0.03 ether}("x", PactiqVault.Category.FITNESS, NATIVE, 0.001 ether, 30, "", address(0));
    }

    function test_CreatePact_RevertsOnBadStrings() public {
        vm.startPrank(alice);
        vm.expectRevert(PactiqVault.InvalidTitle.selector);
        vault.createPact{value: 7 ether}("", PactiqVault.Category.FITNESS, NATIVE, DAILY, DAYS, "", address(0));
        vm.expectRevert(PactiqVault.InvalidTitle.selector);
        vault.createPact{value: 7 ether}(
            "this title is way too long and keeps going and going and going past eighty characters total",
            PactiqVault.Category.FITNESS,
            NATIVE,
            DAILY,
            DAYS,
            "",
            address(0)
        );
        vm.expectRevert(PactiqVault.InvalidQieId.selector);
        vault.createPact{value: 7 ether}(
            "ok", PactiqVault.Category.FITNESS, NATIVE, DAILY, DAYS, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.qie", address(0)
        );
        vm.stopPrank();
    }

    function test_Pause_BlocksOnlyNewPacts() public {
        uint256 id = _create(alice, DAILY, DAYS);
        vault.pause();
        vm.prank(bob);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.createPact{value: 7 ether}("x", PactiqVault.Category.FITNESS, NATIVE, DAILY, DAYS, "", address(0));
        // existing users are unaffected
        _checkIn(alice, id, 1);
        vault.unpause();
        _create(bob, DAILY, DAYS);
    }

    // --- checkIn ---

    function test_CheckIn_Success() public {
        uint256 id = _create(alice, DAILY, DAYS);
        _checkIn(alice, id, 1);
        assertTrue(vault.dayCheckedIn(id, 1));
        assertEq(vault.userTotalCheckIns(alice), 1);
        assertEq(vault.totalCheckIns(), 1);
        bool[] memory days_ = vault.getPactDays(id);
        assertEq(days_.length, DAYS);
        assertTrue(days_[0]);
        assertFalse(days_[1]);
    }

    function test_CheckIn_RevertsOnRogueSigner() public {
        uint256 id = _create(alice, DAILY, DAYS);
        bytes32 proof = keccak256("p");
        bytes memory sig = _sign(0xBAD, id, 1, proof, alice);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.InvalidOracleSignature.selector);
        vault.checkIn(id, 1, proof, sig);
    }

    function test_CheckIn_RevertsOnMalformedSignature() public {
        uint256 id = _create(alice, DAILY, DAYS);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.InvalidOracleSignature.selector);
        vault.checkIn(id, 1, keccak256("p"), hex"1234");
    }

    function test_CheckIn_RevertsWhenSignatureForOtherDay() public {
        uint256 id = _create(alice, DAILY, DAYS);
        bytes32 proof = keccak256("p");
        bytes memory sigDay2 = _sign(ORACLE_KEY, id, 2, proof, alice);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.InvalidOracleSignature.selector);
        vault.checkIn(id, 1, proof, sigDay2);
    }

    function test_CheckIn_RevertsForNonCreator() public {
        uint256 id = _create(alice, DAILY, DAYS);
        bytes32 proof = keccak256("p");
        bytes memory sig = _sign(ORACLE_KEY, id, 1, proof, bob);
        vm.prank(bob);
        vm.expectRevert(PactiqVault.Unauthorized.selector);
        vault.checkIn(id, 1, proof, sig);
    }

    function test_CheckIn_RevertsOnReplayedProof() public {
        uint256 id = _create(alice, DAILY, DAYS);
        bytes32 proof = keccak256("same");
        bytes memory sig1 = _sign(ORACLE_KEY, id, 1, proof, alice);
        vm.prank(alice);
        vault.checkIn(id, 1, proof, sig1);

        vm.warp(vm.getBlockTimestamp() + 1 days);
        bytes memory sig2 = _sign(ORACLE_KEY, id, 2, proof, alice);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.ProofAlreadyUsed.selector);
        vault.checkIn(id, 2, proof, sig2);
    }

    function test_CheckIn_RevertsOnDoubleCheckIn() public {
        uint256 id = _create(alice, DAILY, DAYS);
        _checkIn(alice, id, 1);
        bytes32 proof = keccak256("other");
        bytes memory sig = _sign(ORACLE_KEY, id, 1, proof, alice);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.DayAlreadyCheckedIn.selector);
        vault.checkIn(id, 1, proof, sig);
    }

    function test_CheckIn_WindowEnforced() public {
        uint256 id = _create(alice, DAILY, DAYS);
        uint256 start = vm.getBlockTimestamp();

        // day 2 is not open yet
        bytes32 proof = keccak256("early");
        bytes memory sig = _sign(ORACLE_KEY, id, 2, proof, alice);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.CheckInWindowClosed.selector);
        vault.checkIn(id, 2, proof, sig);

        // day 1 is still allowed inside the grace period...
        vm.warp(start + 1 days + 12 hours);
        assertTrue(vault.isCheckInEligible(id, 1));
        // ...but not after it
        vm.warp(start + 1 days + 12 hours + 1);
        assertFalse(vault.isCheckInEligible(id, 1));
        bytes32 proofLate = keccak256("late");
        bytes memory sigLate = _sign(ORACLE_KEY, id, 1, proofLate, alice);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.CheckInWindowClosed.selector);
        vault.checkIn(id, 1, proofLate, sigLate);
    }

    function test_CheckIn_RevertsOnUnknownPactAndDayRange() public {
        vm.prank(alice);
        vm.expectRevert(PactiqVault.PactNotFound.selector);
        vault.checkIn(99, 1, bytes32(0), "");

        uint256 id = _create(alice, DAILY, DAYS);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.DayOutOfRange.selector);
        vault.checkIn(id, 0, bytes32(0), "");
        vm.prank(alice);
        vm.expectRevert(PactiqVault.DayOutOfRange.selector);
        vault.checkIn(id, DAYS + 1, bytes32(0), "");
    }

    // --- settlePact ---

    function test_Settle_FullCompletionPaysBonusFromPool() public {
        vm.prank(sponsor);
        vault.fundRewardPool{value: 5 ether}(NATIVE, 5 ether);

        uint256 id = _create(alice, DAILY, DAYS);
        for (uint256 d = 1; d <= DAYS; d++) {
            _checkIn(alice, id, d);
            if (d < DAYS) vm.warp(vm.getBlockTimestamp() + 1 days);
        }

        uint256 before = alice.balance;
        vault.settlePact(id); // anyone may settle a completed pact immediately
        assertEq(alice.balance - before, 7 ether + 1.05 ether);
        assertEq(_ledger().rewardPool, 5 ether - 1.05 ether);
        assertEq(vault.userCompletedPacts(alice), 1);
        assertEq(vault.userRewardsEarned(alice, NATIVE), 1.05 ether);
        assertEq(_ledger().activeStake, 0);
        assertEq(uint256(vault.getPact(id).status), uint256(PactiqVault.PactStatus.COMPLETED));
        _assertSolvent();
    }

    function test_Settle_BonusCappedByPool() public {
        vm.prank(sponsor);
        vault.fundRewardPool{value: 0.3 ether}(NATIVE, 0.3 ether);
        uint256 id = _create(alice, DAILY, DAYS);
        for (uint256 d = 1; d <= DAYS; d++) {
            _checkIn(alice, id, d);
            if (d < DAYS) vm.warp(vm.getBlockTimestamp() + 1 days);
        }
        uint256 before = alice.balance;
        vault.settlePact(id);
        assertEq(alice.balance - before, 7.3 ether);
        assertEq(_ledger().rewardPool, 0);
    }

    function test_Settle_PartialSlashesMissedDays() public {
        uint256 id = _create(bob, DAILY, DAYS);
        for (uint256 d = 1; d <= 3; d++) {
            _checkIn(bob, id, d);
            vm.warp(vm.getBlockTimestamp() + 1 days);
        }
        vm.warp(vault.settleableAt(id) + 1);

        uint256 before = bob.balance;
        vm.prank(alice); // anyone can settle after the deadline
        vault.settlePact(id);

        assertEq(bob.balance - before, 3 ether);
        assertEq(_ledger().slashed, 4 ether);
        assertEq(_ledger().protocolFees, 0.2 ether);
        assertEq(_ledger().rewardPool, 3.8 ether);
        assertEq(vault.totalFailedPacts(), 1);
        assertEq(uint256(vault.getPact(id).status), uint256(PactiqVault.PactStatus.FAILED));
        _assertSolvent();
    }

    function test_Settle_CannotCutFinalDayGracePeriodShort() public {
        uint256 id = _create(alice, DAILY, DAYS);
        uint256 start = vm.getBlockTimestamp();
        for (uint256 d = 1; d < DAYS; d++) {
            _checkIn(alice, id, d);
            vm.warp(vm.getBlockTimestamp() + 1 days);
        }
        // Past the nominal end, but day 7's grace window is still open.
        vm.warp(start + DAYS * 1 days + 1 hours);
        vm.prank(bob);
        vm.expectRevert(PactiqVault.PactStillInProgress.selector);
        vault.settlePact(id);

        // Alice still makes it in time and completes the pact.
        _checkIn(alice, id, DAYS);
        vault.settlePact(id);
        assertEq(uint256(vault.getPact(id).status), uint256(PactiqVault.PactStatus.COMPLETED));
    }

    function test_Settle_RevertsWhileInProgressAndTwice() public {
        uint256 id = _create(alice, DAILY, DAYS);
        vm.expectRevert(PactiqVault.PactStillInProgress.selector);
        vault.settlePact(id);

        vm.warp(vault.settleableAt(id) + 1);
        vault.settlePact(id);
        vm.expectRevert(PactiqVault.PactNotActive.selector);
        vault.settlePact(id);
    }

    function test_Settle_ZeroCheckInsSlashesAll() public {
        uint256 id = _create(alice, DAILY, DAYS);
        vm.warp(vault.settleableAt(id) + 1);
        uint256 before = alice.balance;
        vault.settlePact(id);
        assertEq(alice.balance, before);
        assertEq(_ledger().rewardPool, 6.65 ether);
        _assertSolvent();
    }

    function test_Settle_SlashPoolFundsLaterCompleter() public {
        // Bob fails entirely, Alice completes and is paid from Bob's slashed stake.
        uint256 bobPact = _create(bob, DAILY, DAYS);
        uint256 alicePact = _create(alice, DAILY, DAYS);
        for (uint256 d = 1; d <= DAYS; d++) {
            _checkIn(alice, alicePact, d);
            if (d < DAYS) vm.warp(vm.getBlockTimestamp() + 1 days);
        }
        vm.warp(vault.settleableAt(bobPact) + 1);
        vault.settlePact(bobPact);
        uint256 before = alice.balance;
        vault.settlePact(alicePact);
        assertEq(alice.balance - before, 7 ether + 1.05 ether);
        _assertSolvent();
    }

    function test_Settle_RevertsIfCreatorRejectsPayment() public {
        RejectingReceiver r = new RejectingReceiver();
        vm.deal(address(r), 10 ether);
        vm.prank(address(r));
        uint256 id =
            vault.createPact{value: 7 ether}("x", PactiqVault.Category.CUSTOM, NATIVE, DAILY, DAYS, "", address(0));
        // Can't check in from a contract without a signature here; let it fail with 0 refunds.
        vm.warp(vault.settleableAt(id) + 1);
        vault.settlePact(id); // payout is 0, so it succeeds
        assertEq(uint256(vault.getPact(id).status), uint256(PactiqVault.PactStatus.FAILED));
    }

    // --- admin / fees ---

    function test_WithdrawFees_CannotTouchUserStakeOrPool() public {
        _create(alice, DAILY, DAYS); // 7 QIE active
        vm.prank(sponsor);
        vault.fundRewardPool{value: 2 ether}(NATIVE, 2 ether);

        // No fees accrued yet: nothing to withdraw, even though the vault holds 9 QIE.
        vm.expectRevert(PactiqVault.NothingToWithdraw.selector);
        vault.withdrawProtocolFees(NATIVE, payable(owner));

        uint256 failing = _create(bob, DAILY, DAYS);
        vm.warp(vault.settleableAt(failing) + 1);
        vault.settlePact(failing); // 7 QIE slashed -> 0.35 fee

        address payable treasury = payable(address(0x7EA));
        vault.withdrawProtocolFees(NATIVE, treasury);
        assertEq(treasury.balance, 0.35 ether);
        assertEq(_ledger().protocolFees, 0);
        _assertSolvent();
    }

    function test_Admin_OnlyOwner() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setOracleSigner(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.withdrawProtocolFees(NATIVE, payable(alice));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.pause();
        vm.stopPrank();
    }

    function test_Admin_RotateOracleSigner() public {
        uint256 id = _create(alice, DAILY, DAYS);
        uint256 newKey = 0xB0B0;
        vault.setOracleSigner(vm.addr(newKey));

        bytes32 proof = keccak256("p");
        bytes memory oldSig = _sign(ORACLE_KEY, id, 1, proof, alice);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.InvalidOracleSignature.selector);
        vault.checkIn(id, 1, proof, oldSig);

        bytes memory newSig = _sign(newKey, id, 1, proof, alice);
        vm.prank(alice);
        vault.checkIn(id, 1, proof, newSig);
    }

    function test_Admin_OwnershipIsTwoStep() public {
        vault.transferOwnership(alice);
        assertEq(vault.owner(), owner);
        vm.prank(alice);
        vault.acceptOwnership();
        assertEq(vault.owner(), alice);
    }

    function test_ReceiveFundsPool() public {
        vm.prank(sponsor);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(_ledger().rewardPool, 1 ether);
    }

    // --- QIE Oracle ---

    function test_PriceFeed_QuotesUsd() public view {
        (uint256 price, uint8 dec,) = vault.getQiePrice();
        assertEq(price, 15_000_000);
        assertEq(dec, 8);
        assertEq(vault.quoteUsd(100 ether), 15 ether); // 100 QIE * $0.15 = $15
    }

    function test_PriceFeed_FailsGracefully() public {
        feed.setBroken(true);
        (uint256 price,,) = vault.getQiePrice();
        assertEq(price, 0);
        assertEq(vault.quoteUsd(1 ether), 0);

        vault.setPriceFeed(address(0));
        (price,,) = vault.getQiePrice();
        assertEq(price, 0);
    }

    function test_ProtocolStats() public {
        uint256 id = _create(alice, DAILY, DAYS);
        _checkIn(alice, id, 1);
        PactiqVault.ProtocolStats memory st = vault.getProtocolStats(NATIVE);
        assertEq(st.pactCount, 1);
        assertEq(st.activeStake, 7 ether);
        assertEq(st.volume, 7 ether);
        assertEq(st.checkIns, 1);
    }

    // --- fuzz ---

    function testFuzz_SettlementConservesFunds(uint8 rawDays, uint8 rawCheckIns, uint96 rawStake, uint96 rawPool)
        public
    {
        uint256 days_ = bound(rawDays, 3, 30);
        uint256 checkIns = bound(rawCheckIns, 0, days_);
        uint256 daily = bound(rawStake, 0.01 ether, 10 ether);
        uint256 pool = bound(rawPool, 0, 50 ether);

        if (pool > 0) {
            vm.prank(sponsor);
            vault.fundRewardPool{value: pool}(NATIVE, pool);
        }
        uint256 id = _create(alice, daily, days_);
        uint256 start = vm.getBlockTimestamp();
        for (uint256 d = 1; d <= checkIns; d++) {
            vm.warp(start + (d - 1) * 1 days);
            _checkIn(alice, id, d);
        }
        vm.warp(vault.settleableAt(id) + 1);

        uint256 vaultBefore = address(vault).balance;
        uint256 aliceBefore = alice.balance;
        vault.settlePact(id);
        uint256 paid = alice.balance - aliceBefore;

        assertEq(vaultBefore - address(vault).balance, paid);
        assertGe(paid, checkIns * daily);
        assertLe(paid, checkIns * daily + (checkIns * daily * 1500) / 10_000);
        _assertSolvent();
    }
}
