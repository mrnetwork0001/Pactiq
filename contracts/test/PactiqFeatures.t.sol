// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PactiqVault, IAggregatorV3} from "../src/PactiqVault.sol";
import {PactiqBadges} from "../src/PactiqBadges.sol";
import {IPactiqReputation} from "../src/IPactiqReputation.sol";
import {HumanGatedAirdrop} from "../src/examples/HumanGatedAirdrop.sol";

contract StaleableFeed is IAggregatorV3 {
    int256 public answer = 15_000_000; // $0.15, 8 decimals
    uint256 public updatedAt;

    constructor() {
        updatedAt = block.timestamp;
    }

    function set(int256 a, uint256 t) external {
        answer = a;
        updatedAt = t;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

contract PactiqFeaturesTest is Test {
    address internal constant NATIVE = address(0);
    PactiqVault internal vault;
    PactiqBadges internal badges;
    StaleableFeed internal feed;

    uint256 internal constant ORACLE_KEY = 0xA11CE;
    address internal alice = address(0xA11);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA201);
    address internal brand = address(0xB8A2D);
    address internal charity = address(0xC4A817);

    uint256 internal constant DAILY = 1 ether;

    function setUp() public {
        feed = new StaleableFeed();
        vault = new PactiqVault(vm.addr(ORACLE_KEY), address(feed));
        badges = new PactiqBadges("https://pactiq.app/api/badge/");
        badges.setMinter(address(vault));
        vault.setBadges(address(badges));
        vault.setCharity(charity, "Community Fund", true);
        address[5] memory users = [alice, bob, carol, brand, address(this)];
        for (uint256 i = 0; i < users.length; i++) {
            vm.deal(users[i], 1_000 ether);
        }
    }

    // --- helpers ---

    function _ledger() internal view returns (PactiqVault.Ledger memory) {
        return vault.getLedger(NATIVE);
    }

    function _checkIn(address user, uint256 pactId, uint256 day) internal {
        bytes32 proof = keccak256(abi.encodePacked("proof", pactId, day));
        bytes32 digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", vault.checkInDigest(pactId, day, proof, user))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ORACLE_KEY, digest);
        vm.prank(user);
        vault.checkIn(pactId, day, proof, abi.encodePacked(r, s, v));
    }

    function _checkInDays(address user, uint256 pactId, uint256 fromDay, uint256 toDay) internal {
        uint256 start = vault.getPact(pactId).startTime;
        for (uint256 d = fromDay; d <= toDay; d++) {
            vm.warp(start + (d - 1) * 1 days + 1 hours);
            _checkIn(user, pactId, d);
        }
    }

    function _solo(address user, uint256 days_, address charity_) internal returns (uint256 id) {
        vm.prank(user);
        id = vault.createPact{value: DAILY * days_}(
            "Solo", PactiqVault.Category.FITNESS, NATIVE, DAILY, days_, "", charity_
        );
    }

    function _assertSolvent() internal view {
        assertGe(
            address(vault).balance,
            _ledger().activeStake + _ledger().rewardPool + _ledger().protocolFees + _ledger().squadEscrow
                + _ledger().charityEscrow,
            "insolvent"
        );
    }

    // =====================================================================
    // Squads & sponsored challenges
    // =====================================================================

    function _squad(uint256 sponsorship) internal returns (uint256 id) {
        vm.prank(brand);
        id = vault.createSquad{value: sponsorship}(
            "Builder Sprint",
            PactiqVault.Category.CODING,
            NATIVE,
            DAILY,
            5,
            vm.getBlockTimestamp() + 1 days,
            10,
            "QIE Labs",
            sponsorship
        );
    }

    function _join(uint256 squadId, address user) internal returns (uint256 pactId) {
        vm.prank(user);
        pactId = vault.joinSquad{value: 5 ether}(squadId, "");
    }

    function test_Squad_SplitsSlashAndSponsorshipAmongFinishers() public {
        uint256 squadId = _squad(10 ether);
        uint256 pa = _join(squadId, alice);
        uint256 pb = _join(squadId, bob);
        uint256 pc = _join(squadId, carol);
        _assertSolvent();

        PactiqVault.Squad memory s = vault.getSquad(squadId);
        assertEq(s.memberCount, 3);
        assertEq(s.sponsorPool, 10 ether);
        assertEq(vault.getPact(pa).startTime, s.startTime);
        assertEq(vault.getPact(pa).squadId, squadId);

        _checkInDays(alice, pa, 1, 5);
        _checkInDays(bob, pb, 1, 5);
        _checkInDays(carol, pc, 1, 2); // carol quits after day 2 → 3 QIE slashed

        // Finishers cannot settle before the squad ends.
        vm.expectRevert(PactiqVault.SquadStillRunning.selector);
        vault.settlePact(pa);

        vm.warp(vault.squadEndsAt(squadId) + 1);
        uint256 aliceBefore = alice.balance;
        vault.settlePact(pa); // auto-finalizes
        // pot = 3 * 95% + 10 = 12.85 → 6.425 each
        assertEq(alice.balance - aliceBefore, 5 ether + 6.425 ether);

        s = vault.getSquad(squadId);
        assertTrue(s.finalized);
        assertEq(s.finisherCount, 2);
        assertEq(s.bonusPerFinisher, 6.425 ether);
        assertEq(_ledger().protocolFees, 0.15 ether);

        uint256 bobBefore = bob.balance;
        vm.prank(carol);
        vault.settlePact(pb); // anyone can settle for bob
        assertEq(bob.balance - bobBefore, 11.425 ether);

        uint256 carolBefore = carol.balance;
        vault.settlePact(pc);
        assertEq(carol.balance - carolBefore, 2 ether);

        assertEq(_ledger().squadEscrow, 0);
        assertEq(_ledger().activeStake, 0);
        assertEq(_ledger().sponsored, 10 ether);
        _assertSolvent();
    }

    function test_Squad_NoFinishersSendsPotToCommunity() public {
        uint256 squadId = _squad(2 ether);
        uint256 pa = _join(squadId, alice);
        _checkInDays(alice, pa, 1, 1);
        vm.warp(vault.squadEndsAt(squadId) + 1);
        vault.finalizeSquad(squadId);
        // 4 slashed → 3.8 to pot + 2 sponsor = 5.8 to community
        assertEq(_ledger().rewardPool, 5.8 ether);
        assertEq(_ledger().squadEscrow, 0);
        vault.settlePact(pa);
        _assertSolvent();
    }

    function test_Squad_JoinRules() public {
        vm.prank(brand);
        uint256 squadId = vault.createSquad(
            "Duo", PactiqVault.Category.FITNESS, NATIVE, DAILY, 5, vm.getBlockTimestamp() + 1 hours, 2, "", 0
        );

        vm.prank(alice);
        vm.expectRevert(PactiqVault.InsufficientStake.selector);
        vault.joinSquad{value: 4 ether}(squadId, "");

        _join(squadId, alice);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.AlreadyInSquad.selector);
        vault.joinSquad{value: 5 ether}(squadId, "");

        _join(squadId, bob);
        vm.prank(carol);
        vm.expectRevert(PactiqVault.SquadFull.selector);
        vault.joinSquad{value: 5 ether}(squadId, "");

        vm.prank(carol);
        vm.expectRevert(PactiqVault.SquadNotFound.selector);
        vault.joinSquad{value: 5 ether}(99, "");
    }

    function test_Squad_LateJoinWindowAndStartGate() public {
        uint256 squadId = _squad(0);
        uint256 pa = _join(squadId, alice);
        uint256 start = vault.getSquad(squadId).startTime;

        // Day 1 isn't open before the squad starts.
        bytes32 proof = keccak256("early");
        bytes32 digest =
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", vault.checkInDigest(pa, 1, proof, alice)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ORACLE_KEY, digest);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.CheckInWindowClosed.selector);
        vault.checkIn(pa, 1, proof, abi.encodePacked(r, s, v));
        assertEq(vault.getCurrentDayIndex(pa), 0);

        vm.warp(start + 12 hours);
        _join(squadId, bob); // still allowed

        vm.warp(start + 12 hours + 1);
        vm.prank(carol);
        vm.expectRevert(PactiqVault.SquadClosed.selector);
        vault.joinSquad{value: 5 ether}(squadId, "");
    }

    function test_Squad_ConfigValidation() public {
        uint256 t = vm.getBlockTimestamp();
        vm.startPrank(brand);
        vm.expectRevert(PactiqVault.InvalidSquadConfig.selector);
        vault.createSquad("x", PactiqVault.Category.CODING, NATIVE, DAILY, 5, t + 15 days, 10, "", 0);
        vm.expectRevert(PactiqVault.InvalidSquadConfig.selector);
        vault.createSquad("x", PactiqVault.Category.CODING, NATIVE, DAILY, 5, t, 1, "", 0);
        vm.expectRevert(PactiqVault.InvalidSquadConfig.selector);
        vault.createSquad("x", PactiqVault.Category.CODING, NATIVE, DAILY, 5, t, 101, "", 0);
        vm.expectRevert(PactiqVault.InvalidDuration.selector);
        vault.createSquad("x", PactiqVault.Category.CODING, NATIVE, DAILY, 2, t, 10, "", 0);
        vm.stopPrank();
    }

    function test_Squad_SponsorshipWindow() public {
        uint256 squadId = _squad(0);
        vm.prank(alice);
        vault.sponsorSquad{value: 1 ether}(squadId, 1 ether);
        assertEq(vault.getSquad(squadId).sponsorPool, 1 ether);

        vm.warp(vault.squadEndsAt(squadId) + 1);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.SquadClosed.selector);
        vault.sponsorSquad{value: 1 ether}(squadId, 1 ether);

        vault.finalizeSquad(squadId);
        vm.expectRevert(PactiqVault.SquadAlreadyFinalized.selector);
        vault.finalizeSquad(squadId);
    }

    // =====================================================================
    // Charity mode
    // =====================================================================

    function test_Charity_ReceivesAllMissedStakeWithoutFee() public {
        uint256 id = _solo(alice, 5, charity);
        _checkInDays(alice, id, 1, 2);
        vm.warp(vault.settleableAt(id) + 1);
        vault.settlePact(id);

        PactiqVault.Charity[] memory list = vault.getCharities(NATIVE);
        assertEq(list.length, 1);
        assertEq(list[0].pending, 3 ether);
        assertEq(list[0].totalReceived, 3 ether);
        assertEq(_ledger().protocolFees, 0);
        assertEq(_ledger().rewardPool, 0);
        assertEq(_ledger().donated, 3 ether);
        _assertSolvent();

        vm.prank(bob); // anyone can push the donation out
        vault.releaseCharity(charity, NATIVE);
        assertEq(charity.balance, 3 ether);
        assertEq(_ledger().charityEscrow, 0);

        vm.expectRevert(PactiqVault.NothingToWithdraw.selector);
        vault.releaseCharity(charity, NATIVE);
    }

    function test_Charity_OnlyActiveCuratedCauses() public {
        vm.prank(alice);
        vm.expectRevert(PactiqVault.InvalidCharity.selector);
        vault.createPact{value: 5 ether}("x", PactiqVault.Category.FITNESS, NATIVE, DAILY, 5, "", bob);

        vault.setCharity(charity, "Community Fund", false);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.InvalidCharity.selector);
        vault.createPact{value: 5 ether}("x", PactiqVault.Category.FITNESS, NATIVE, DAILY, 5, "", charity);

        vm.prank(alice);
        vm.expectRevert();
        vault.setCharity(alice, "me", true);
    }

    // =====================================================================
    // USD-denominated stakes (QIE Oracle)
    // =====================================================================

    function test_Usd_PricesStakeOnChainAndRefundsExcess() public {
        (uint256 daily, uint256 total) = vault.quotePactUsd(1 ether, 7); // $1/day
        assertEq(daily, uint256(1 ether) * 1e8 / 15_000_000);
        assertEq(total, daily * 7);

        uint256 before = alice.balance;
        vm.prank(alice);
        uint256 id = vault.createPactUsd{value: total + 3 ether}(
            "Run", PactiqVault.Category.FITNESS, 1 ether, 7, "", address(0)
        );
        assertEq(before - alice.balance, total, "excess refunded");
        assertEq(vault.getPact(id).dailyStake, daily);
        assertEq(vault.getPact(id).totalStaked, total);
        _assertSolvent();
    }

    function test_Usd_RejectsUnderpaymentAndStalePrice() public {
        (, uint256 total) = vault.quotePactUsd(1 ether, 7);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.InsufficientStake.selector);
        vault.createPactUsd{value: total - 1}("Run", PactiqVault.Category.FITNESS, 1 ether, 7, "", address(0));

        vm.warp(vm.getBlockTimestamp() + 1 days + 1);
        vm.prank(alice);
        vm.expectRevert(PactiqVault.PriceUnavailable.selector);
        vault.createPactUsd{value: 100 ether}("Run", PactiqVault.Category.FITNESS, 1 ether, 7, "", address(0));

        feed.set(0, vm.getBlockTimestamp());
        vm.expectRevert(PactiqVault.PriceUnavailable.selector);
        vault.quotePactUsd(1 ether, 7);
    }

    // =====================================================================
    // Streaks, soulbound badges, Proof-of-Human score
    // =====================================================================

    function test_Badges_SevenDayStreakMintsSoulboundBadge() public {
        uint256 id = _solo(alice, 7, address(0));
        _checkInDays(alice, id, 1, 6);
        assertEq(badges.totalSupply(), 0);
        _checkInDays(alice, id, 7, 7);

        assertEq(vault.userBestStreak(alice), 7);
        assertEq(vault.userBadges(alice), 1);
        assertEq(badges.totalSupply(), 1);
        assertEq(badges.ownerOf(1), alice);
        assertEq(badges.balanceOf(alice), 1);
        assertEq(badges.tierOf(1), 0);
        assertEq(badges.badgeOf(alice, 0), 1);
        assertTrue(badges.locked(1));
        assertEq(badges.tokenURI(1), "https://pactiq.app/api/badge/1");
        assertTrue(badges.supportsInterface(0xb45a3c0e));
        assertTrue(badges.supportsInterface(0x80ac58cd));

        vm.startPrank(alice);
        vm.expectRevert(PactiqBadges.Soulbound.selector);
        badges.transferFrom(alice, bob, 1);
        vm.expectRevert(PactiqBadges.Soulbound.selector);
        badges.safeTransferFrom(alice, bob, 1);
        vm.expectRevert(PactiqBadges.Soulbound.selector);
        badges.approve(bob, 1);
        vm.stopPrank();
    }

    function test_Badges_OnlyVaultCanMint() public {
        vm.prank(alice);
        vm.expectRevert(PactiqBadges.NotMinter.selector);
        badges.mint(alice, 0);
    }

    function test_Badges_BrokenBadgeContractNeverBlocksCheckIn() public {
        badges.setMinter(address(0)); // every mint will revert
        uint256 id = _solo(alice, 7, address(0));
        _checkInDays(alice, id, 1, 7);
        assertEq(vault.userBadges(alice), 1); // tracked in the vault regardless
        assertEq(badges.totalSupply(), 0);
    }

    function test_Streak_CountsConsecutiveRunAcrossGraceOrder() public {
        uint256 id = _solo(alice, 5, address(0));
        uint256 start = vault.getPact(id).startTime;
        vm.warp(start + 1 days + 2 hours); // day 2 open, day 1 still in grace
        _checkIn(alice, id, 2);
        _checkIn(alice, id, 1);
        assertEq(vault.getPact(id).bestStreak, 2);
        // skip day 3, then do 4 and 5
        _checkInDays(alice, id, 4, 5);
        assertEq(vault.getPact(id).bestStreak, 2);
        assertEq(vault.userBestStreak(alice), 2);
    }

    function test_Reputation_ScoreRewardsDisciplineAndPenalisesFailure() public {
        uint256 id = _solo(alice, 7, address(0));
        _checkInDays(alice, id, 1, 7);
        IPactiqReputation.HumanProfile memory p = vault.getHumanProfile(alice);
        assertEq(p.checkIns, 7);
        assertEq(p.bestStreak, 7);
        assertEq(p.score, 7 * 10 + 7 * 20);
        assertEq(p.badges, 1);
        assertGt(p.firstActivity, 0);

        vault.settlePact(id);
        assertEq(vault.humanScore(alice), 210 + 100);

        // Bob signs up, checks in once and fails.
        uint256 bid = _solo(bob, 5, address(0));
        _checkInDays(bob, bid, 1, 1);
        vm.warp(vault.settleableAt(bid) + 1);
        vault.settlePact(bid);
        assertEq(vault.humanScore(bob), 0); // 10 + 20 - 50 → floored

        assertTrue(vault.isVerifiedHuman(alice, 300));
        assertFalse(vault.isVerifiedHuman(alice, 1000));
        assertFalse(vault.isVerifiedHuman(carol, 0)); // never checked in
    }

    function test_Reputation_GatesAnExampleAirdrop() public {
        HumanGatedAirdrop drop = new HumanGatedAirdrop{value: 10 ether}(vault, 200, 1 ether);
        vm.prank(alice);
        vm.expectRevert(HumanGatedAirdrop.NotVerifiedHuman.selector);
        drop.claim();

        uint256 id = _solo(alice, 7, address(0));
        _checkInDays(alice, id, 1, 7); // score 210
        uint256 before = alice.balance;
        vm.prank(alice);
        drop.claim();
        assertEq(alice.balance - before, 1 ether);

        vm.prank(alice);
        vm.expectRevert(HumanGatedAirdrop.AlreadyClaimed.selector);
        drop.claim();
    }

    // =====================================================================
    // Fuzz: squads always conserve funds
    // =====================================================================

    function testFuzz_SquadConservesFunds(uint8 a, uint8 b, uint8 c, uint96 sponsorship) public {
        uint256 sp = bound(sponsorship, 0, 100 ether);
        uint256 squadId = _squad(sp);
        address[3] memory members = [alice, bob, carol];
        uint8[3] memory raw = [a, b, c];
        uint256[3] memory ids;
        for (uint256 i = 0; i < 3; i++) {
            ids[i] = _join(squadId, members[i]);
        }
        for (uint256 i = 0; i < 3; i++) {
            uint256 n = bound(raw[i], 0, 5);
            if (n > 0) _checkInDays(members[i], ids[i], 1, n);
        }
        vm.warp(vault.squadEndsAt(squadId) + 1);
        uint256 vaultBefore = address(vault).balance;
        uint256 paid;
        for (uint256 i = 0; i < 3; i++) {
            uint256 before = members[i].balance;
            vault.settlePact(ids[i]);
            paid += members[i].balance - before;
        }
        assertEq(vaultBefore - address(vault).balance, paid);
        assertLe(_ledger().squadEscrow, 2); // only rounding dust can remain
        _assertSolvent();
    }
}
