// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PactiqVault} from "../src/PactiqVault.sol";
import {PactiqCampaign} from "../src/PactiqCampaign.sol";

/// A wallet that refuses incoming QIE, to prove a failed payout can't leave a claim half-recorded.
contract RejectsPayment {
    function tryClaim(PactiqCampaign c) external {
        c.claim();
    }
}

contract PactiqCampaignTest is Test {
    event Claimed(address indexed winner, uint256 indexed place, uint256 amount);

    uint256 internal constant ORACLE_KEY = 0xA11CE;
    uint256 internal constant REWARD = 20 ether;
    uint256 internal constant WINNERS = 3;
    uint256 internal constant STREAK = 3;

    PactiqVault internal vault;
    PactiqCampaign internal campaign;
    uint256 internal startsAt;
    uint256 internal endsAt;
    address internal sponsor = makeAddr("sponsor");

    function setUp() public {
        vm.warp(1_800_000_000);
        vault = new PactiqVault(vm.addr(ORACLE_KEY), address(0));
        startsAt = block.timestamp + 1 days;
        endsAt = startsAt + 5 days;
        campaign = new PactiqCampaign(address(vault), REWARD, WINNERS, STREAK, startsAt, endsAt);
        vm.deal(sponsor, 1_000 ether);
        vm.prank(sponsor);
        (bool ok,) = address(campaign).call{value: REWARD * WINNERS}("");
        assertTrue(ok);
    }

    /// Sign a pact for `user` and check in on its first `days_` days, ending at the time of the last check-in.
    function _streak(address user, uint256 days_) internal {
        vm.deal(user, 10 ether);
        vm.prank(user);
        uint256 id = vault.createPact{value: 0.07 ether}(
            "Habit", PactiqVault.Category.CUSTOM, address(0), 0.01 ether, 7, "", address(0)
        );
        uint256 start = vault.getPact(id).startTime;
        for (uint256 d = 1; d <= days_; d++) {
            if (block.timestamp < start + (d - 1) * 1 days + 1 hours) vm.warp(start + (d - 1) * 1 days + 1 hours);
            bytes32 proof = keccak256(abi.encodePacked("proof", id, d));
            bytes32 digest = keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", vault.checkInDigest(id, d, proof, user))
            );
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(ORACLE_KEY, digest);
            vm.prank(user);
            vault.checkIn(id, d, proof, abi.encodePacked(r, s, v));
        }
    }

    function _status(address user) internal view returns (uint8) {
        return uint8(campaign.statusOf(user));
    }

    function test_ClaimPaysARealStreakOnce() public {
        address alice = makeAddr("alice");
        _streak(alice, 3); // day 3 lands two days after signing, inside the campaign
        assertEq(_status(alice), uint8(PactiqCampaign.Status.Eligible));

        uint256 before = alice.balance;
        vm.expectEmit(true, true, true, true, address(campaign));
        emit Claimed(alice, 1, REWARD);
        vm.prank(alice);
        campaign.claim();

        assertEq(alice.balance - before, REWARD);
        assertTrue(campaign.claimed(alice));
        assertEq(campaign.winnersCount(), 1);
        assertEq(campaign.winners()[0], alice);
        assertEq(campaign.rewardsLeft(), WINNERS - 1);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(PactiqCampaign.CannotClaim.selector, PactiqCampaign.Status.AlreadyClaimed)
        );
        campaign.claim();
    }

    function test_TwoDaysIsNotEnough() public {
        address bob = makeAddr("bob");
        _streak(bob, 2);
        vm.warp(startsAt + 1);
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(PactiqCampaign.CannotClaim.selector, PactiqCampaign.Status.StreakTooShort)
        );
        campaign.claim();
    }

    function test_NoClaimsBeforeItOpensOrAfterItCloses() public {
        address early = makeAddr("early");
        // A streak finished early still can't be claimed until the campaign opens.
        _streak(early, 3);
        vm.warp(startsAt - 1);
        assertEq(_status(early), uint8(PactiqCampaign.Status.NotStarted));
        vm.prank(early);
        vm.expectRevert(abi.encodeWithSelector(PactiqCampaign.CannotClaim.selector, PactiqCampaign.Status.NotStarted));
        campaign.claim();

        vm.warp(endsAt);
        vm.prank(early);
        vm.expectRevert(abi.encodeWithSelector(PactiqCampaign.CannotClaim.selector, PactiqCampaign.Status.Ended));
        campaign.claim();
    }

    function test_OnlyTheFirstWinnersArePaid() public {
        address[4] memory people = [makeAddr("p1"), makeAddr("p2"), makeAddr("p3"), makeAddr("p4")];
        for (uint256 i = 0; i < 4; i++) {
            _streak(people[i], 3);
        }
        vm.warp(startsAt + 3 days);
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(people[i]);
            campaign.claim();
        }
        assertEq(campaign.rewardsLeft(), 0);
        assertEq(address(campaign).balance, 0);

        // The fourth finished too, but the rewards are gone.
        vm.prank(people[3]);
        vm.expectRevert(abi.encodeWithSelector(PactiqCampaign.CannotClaim.selector, PactiqCampaign.Status.AllClaimed));
        campaign.claim();
    }

    function test_UnfundedCampaignCannotBeClaimed() public {
        PactiqCampaign empty = new PactiqCampaign(address(vault), REWARD, WINNERS, STREAK, startsAt, endsAt);
        address carol = makeAddr("carol");
        _streak(carol, 3);
        assertFalse(empty.fullyFunded());
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(PactiqCampaign.CannotClaim.selector, PactiqCampaign.Status.NotFunded));
        empty.claim();
    }

    function test_WalletThatRefusesPaymentIsNotRecorded() public {
        RejectsPayment stubborn = new RejectsPayment();
        _streak(address(stubborn), 3);
        vm.expectRevert(PactiqCampaign.TransferFailed.selector);
        stubborn.tryClaim(campaign);
        assertFalse(campaign.claimed(address(stubborn)));
        assertEq(campaign.winnersCount(), 0);
    }

    function test_OwnerRecoversUnclaimedOnlyWhenItIsOver() public {
        address alice = makeAddr("alice");
        _streak(alice, 3);
        vm.prank(alice);
        campaign.claim();

        vm.expectRevert(PactiqCampaign.StillRunning.selector);
        campaign.withdrawUnclaimed(payable(sponsor));

        vm.warp(endsAt);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        campaign.withdrawUnclaimed(payable(alice));

        uint256 before = sponsor.balance;
        campaign.withdrawUnclaimed(payable(sponsor));
        assertEq(sponsor.balance - before, REWARD * (WINNERS - 1));
        assertEq(address(campaign).balance, 0);
    }

    function test_Constructor_RejectsBadTerms() public {
        vm.expectRevert(PactiqCampaign.ZeroAddress.selector);
        new PactiqCampaign(address(0), REWARD, WINNERS, STREAK, startsAt, endsAt);
        vm.expectRevert(PactiqCampaign.BadTerms.selector);
        new PactiqCampaign(address(vault), 0, WINNERS, STREAK, startsAt, endsAt);
        vm.expectRevert(PactiqCampaign.BadTerms.selector);
        new PactiqCampaign(address(vault), REWARD, WINNERS, STREAK, endsAt, startsAt);
    }
}
