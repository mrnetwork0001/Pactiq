// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PactiqVault} from "../src/PactiqVault.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract PactiqVaultTest is Test {
    PactiqVault public vault;

    uint256 internal oraclePrivateKey = 0xA11CE;
    address internal oracleAddress;
    address internal user = address(0xBEEF);
    address internal user2 = address(0xCAFE);

    uint256 internal dailyStake = 1 ether; // 1 QIE
    uint256 internal totalDays = 7;        // 7-day pact

    function setUp() public {
        oracleAddress = vm.addr(oraclePrivateKey);
        vault = new PactiqVault(oracleAddress);

        vm.deal(user, 100 ether);
        vm.deal(user2, 100 ether);
    }

    function test_CreatePact_Success() public {
        vm.startPrank(user);
        uint256 requiredStake = dailyStake * totalDays;

        uint256 pactId = vault.createPact{value: requiredStake}(
            "Daily 30m Workout",
            PactiqVault.Category.FITNESS,
            dailyStake,
            totalDays,
            "beef.qie"
        );

        assertEq(pactId, 1);
        assertEq(vault.userQieId(user), "beef.qie");
        assertEq(vault.totalProtocolVolume(), requiredStake);

        (
            uint256 id,
            address creator,
            string memory title,
            PactiqVault.Category category,
            uint256 stake,
            uint256 daysCount,
            uint256 startTime,
            uint256 checkInCount,
            uint256 lastCheckInDay,
            uint256 totalStaked,
            PactiqVault.PactStatus status,
            string memory qieId
        ) = vault.pacts(pactId);

        assertEq(id, 1);
        assertEq(creator, user);
        assertEq(title, "Daily 30m Workout");
        assertEq(uint256(category), uint256(PactiqVault.Category.FITNESS));
        assertEq(stake, dailyStake);
        assertEq(daysCount, totalDays);
        assertEq(checkInCount, 0);
        assertEq(totalStaked, requiredStake);
        assertEq(uint256(status), uint256(PactiqVault.PactStatus.ACTIVE));
        assertEq(qieId, "beef.qie");
        vm.stopPrank();
    }

    function test_CreatePact_RevertInsufficientStake() public {
        vm.startPrank(user);
        // Sending less than dailyStake * totalDays
        vm.expectRevert(PactiqVault.InsufficientStake.selector);
        vault.createPact{value: 5 ether}(
            "Daily 30m Workout",
            PactiqVault.Category.FITNESS,
            dailyStake,
            totalDays,
            "beef.qie"
        );
        vm.stopPrank();
    }

    function _signCheckIn(
        uint256 pactId,
        uint256 dayIndex,
        bytes32 proofHash,
        address userAddr
    ) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(vault),
                block.chainid,
                pactId,
                dayIndex,
                proofHash,
                userAddr
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    function test_CheckIn_Success() public {
        vm.startPrank(user);
        uint256 pactId = vault.createPact{value: dailyStake * totalDays}(
            "Code 1h Daily",
            PactiqVault.Category.CODING,
            dailyStake,
            totalDays,
            "beef.qie"
        );

        bytes32 proofHash = keccak256("gym_photo_proof_hash_1");
        bytes memory sig = _signCheckIn(pactId, 1, proofHash, user);

        vault.checkIn(pactId, 1, proofHash, sig);

        assertTrue(vault.dayCheckedIn(pactId, 1));
        assertTrue(vault.usedProofHashes(proofHash));
        assertEq(vault.userTotalCheckIns(user), 1);
        vm.stopPrank();
    }

    function test_CheckIn_RevertInvalidSignature() public {
        vm.startPrank(user);
        uint256 pactId = vault.createPact{value: dailyStake * totalDays}(
            "Code 1h Daily",
            PactiqVault.Category.CODING,
            dailyStake,
            totalDays,
            "beef.qie"
        );

        bytes32 proofHash = keccak256("faked_proof");
        // Rogue signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(vault),
                block.chainid,
                pactId,
                uint256(1),
                proofHash,
                user
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, ethSignedHash);
        bytes memory rogueSig = abi.encodePacked(r, s, v);

        vm.expectRevert(PactiqVault.InvalidOracleSignature.selector);
        vault.checkIn(pactId, 1, proofHash, rogueSig);
        vm.stopPrank();
    }

    function test_CheckIn_RevertReplayProof() public {
        vm.startPrank(user);
        uint256 pactId = vault.createPact{value: dailyStake * totalDays}(
            "Code 1h Daily",
            PactiqVault.Category.CODING,
            dailyStake,
            totalDays,
            "beef.qie"
        );

        bytes32 proofHash = keccak256("gym_photo_proof_hash_1");
        bytes memory sig1 = _signCheckIn(pactId, 1, proofHash, user);
        vault.checkIn(pactId, 1, proofHash, sig1);

        // Try reusing the exact same proofHash for day 2
        vm.warp(block.timestamp + 1 days);
        bytes memory sig2 = _signCheckIn(pactId, 2, proofHash, user);

        vm.expectRevert(PactiqVault.ProofAlreadyUsed.selector);
        vault.checkIn(pactId, 2, proofHash, sig2);
        vm.stopPrank();
    }

    function test_FullCompletion_YieldFromSlashPool() public {
        // Pre-fund the reward pool with some slashed stakes
        vm.deal(address(this), 10 ether);
        vault.fundRewardPool{value: 5 ether}();
        assertEq(vault.communityRewardPool(), 5 ether);

        vm.startPrank(user);
        uint256 pactId = vault.createPact{value: dailyStake * totalDays}(
            "Fitness Legend",
            PactiqVault.Category.FITNESS,
            dailyStake,
            totalDays,
            "champion.qie"
        );

        // Check in for all 7 days
        for (uint256 i = 1; i <= totalDays; i++) {
            bytes32 proof = keccak256(abi.encodePacked("proof_day_", i));
            bytes memory sig = _signCheckIn(pactId, i, proof, user);

            vault.checkIn(pactId, i, proof, sig);
            if (i < totalDays) {
                vm.warp(block.timestamp + 1 days);
            }
        }

        uint256 balanceBefore = user.balance;

        // Settle pact
        vault.settlePact(pactId);

        uint256 balanceAfter = user.balance;
        uint256 payout = balanceAfter - balanceBefore;

        // Principal was 7 ether. Plus 15% yield bonus = 1.05 ether => 8.05 ether total!
        uint256 expectedBonus = (7 ether * 1500) / 10000;
        assertEq(payout, 7 ether + expectedBonus);
        assertEq(vault.userCompletedPacts(user), 1);
        vm.stopPrank();
    }

    function test_PartialCompletion_SlashedStake() public {
        vm.startPrank(user2);
        uint256 pactId = vault.createPact{value: dailyStake * totalDays}(
            "Partial Effort",
            PactiqVault.Category.LEARNING,
            dailyStake,
            totalDays,
            "slacker.qie"
        );

        // Check in for only 3 days out of 7
        for (uint256 i = 1; i <= 3; i++) {
            bytes32 proof = keccak256(abi.encodePacked("study_proof_", i));
            bytes memory sig = _signCheckIn(pactId, i, proof, user2);

            vault.checkIn(pactId, i, proof, sig);
            if (i < 3) {
                vm.warp(block.timestamp + 1 days);
            }
        }

        // Fast-forward past totalDays
        vm.warp(block.timestamp + 5 days);

        uint256 balanceBefore = user2.balance;
        vault.settlePact(pactId);
        uint256 balanceAfter = user2.balance;

        // 3 days checked in => refunded 3 ether out of 7
        assertEq(balanceAfter - balanceBefore, 3 ether);

        // 4 ether was slashed. Protocol fee 5% = 0.2 ether. Slash pool receives 3.8 ether!
        assertEq(vault.communityRewardPool(), 3.8 ether);
        assertEq(vault.totalSlashedVolume(), 4 ether);
        vm.stopPrank();
    }
}
