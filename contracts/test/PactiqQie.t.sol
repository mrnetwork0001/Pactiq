// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PactiqVault} from "../src/PactiqVault.sol";
import {QieNameVerifier} from "../src/QieNameVerifier.sol";
import {MockUSDC, FeeOnTransferToken, MockQieNames, MockQieRegistry, MockQieReverse} from "./Mocks.sol";

/// QIE ecosystem integrations: QUSDC staking and QIE ID ownership.
contract PactiqQieTest is Test {
    address internal constant NATIVE = address(0);
    uint256 internal constant ORACLE_KEY = 0xA11CE;
    uint256 internal constant USD = 1e6; // 1 QUSDC
    uint256 internal constant DAILY = 2 * USD;

    PactiqVault internal vault;
    MockUSDC internal usdc;
    MockQieNames internal names;

    address internal alice = address(0xA11);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA201);
    address internal brand = address(0xB8A2D);
    address internal charity = address(0xC4A817);

    function setUp() public {
        vault = new PactiqVault(vm.addr(ORACLE_KEY), address(0));
        usdc = new MockUSDC();
        vault.setStakeAsset(address(usdc), USD / 10); // 0.10 QUSDC minimum per day
        names = new MockQieNames();
        vault.setQieNames(address(names));
        vault.setCharity(charity, "Community Fund", true);

        address[4] memory users = [alice, bob, carol, brand];
        for (uint256 i = 0; i < users.length; i++) {
            usdc.mint(users[i], 1_000 * USD);
            vm.deal(users[i], 1_000 ether);
            vm.prank(users[i]);
            usdc.approve(address(vault), type(uint256).max);
        }
    }

    // --- helpers ---

    function _sign(bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(ORACLE_KEY, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)));
        return abi.encodePacked(r, s, v);
    }

    function _checkInDays(address user, uint256 pactId, uint256 fromDay, uint256 toDay) internal {
        uint256 start = vault.getPact(pactId).startTime;
        for (uint256 d = fromDay; d <= toDay; d++) {
            vm.warp(start + (d - 1) * 1 days + 1 hours);
            bytes32 proof = keccak256(abi.encodePacked("proof", pactId, d));
            bytes memory sig = _sign(vault.checkInDigest(pactId, d, proof, user));
            vm.prank(user);
            vault.checkIn(pactId, d, proof, sig);
        }
    }

    function _usdcPact(address user, uint256 days_, address charity_) internal returns (uint256 id) {
        vm.prank(user);
        id = vault.createPact("Ship daily", PactiqVault.Category.CODING, address(usdc), DAILY, days_, "", charity_);
    }

    function _assertSolvent(address asset) internal view {
        PactiqVault.Ledger memory L = vault.getLedger(asset);
        uint256 bal = asset == NATIVE ? address(vault).balance : usdc.balanceOf(address(vault));
        assertGe(bal, L.activeStake + L.rewardPool + L.protocolFees + L.squadEscrow + L.charityEscrow, "insolvent");
    }

    // =====================================================================
    // QUSDC staking
    // =====================================================================

    function test_Qusdc_ListedNextToQie() public view {
        address[] memory assets = vault.getStakeAssets();
        assertEq(assets.length, 2);
        assertEq(assets[0], NATIVE);
        assertEq(assets[1], address(usdc));
        assertEq(vault.getLedger(address(usdc)).minStakePerDay, USD / 10);
        assertEq(vault.getLedger(NATIVE).minStakePerDay, 0.01 ether);
    }

    function test_Qusdc_FullPactRefundsAndPaysBonusFromItsOwnPool() public {
        vm.prank(brand);
        vault.fundRewardPool(address(usdc), 50 * USD);
        vm.prank(brand);
        vault.fundRewardPool{value: 5 ether}(NATIVE, 5 ether);

        uint256 id = _usdcPact(alice, 7, address(0));
        assertEq(usdc.balanceOf(address(vault)), 50 * USD + 14 * USD);
        PactiqVault.Pact memory p = vault.getPact(id);
        assertEq(p.asset, address(usdc));
        assertEq(p.totalStaked, 14 * USD);
        assertEq(vault.getLedger(address(usdc)).activeStake, 14 * USD);
        assertEq(vault.getLedger(NATIVE).activeStake, 0);

        _checkInDays(alice, id, 1, 7);
        uint256 before = usdc.balanceOf(alice);
        vault.settlePact(id);
        // 14 QUSDC back + 15% bonus (2.1 QUSDC) from the QUSDC pool; the QIE pool is untouched.
        assertEq(usdc.balanceOf(alice) - before, 14 * USD + 2_100_000);
        assertEq(vault.getLedger(address(usdc)).rewardPool, 50 * USD - 2_100_000);
        assertEq(vault.getLedger(NATIVE).rewardPool, 5 ether);
        assertEq(vault.userRewardsEarned(alice, address(usdc)), 2_100_000);
        assertEq(vault.userRewardsEarned(alice, NATIVE), 0);
        _assertSolvent(address(usdc));
        _assertSolvent(NATIVE);
    }

    function test_Qusdc_MissedDaysFeedPoolAndFeesInQusdc() public {
        uint256 id = _usdcPact(bob, 5, address(0));
        _checkInDays(bob, id, 1, 2);
        vm.warp(vault.settleableAt(id) + 1);
        uint256 before = usdc.balanceOf(bob);
        vault.settlePact(id);
        assertEq(usdc.balanceOf(bob) - before, 4 * USD);

        PactiqVault.Ledger memory L = vault.getLedger(address(usdc));
        assertEq(L.slashed, 6 * USD);
        assertEq(L.protocolFees, 300_000); // 5%
        assertEq(L.rewardPool, 5_700_000);
        assertEq(vault.getProtocolStats(address(usdc)).slashed, 6 * USD);

        address payable treasury = payable(address(0x7EA));
        vault.withdrawProtocolFees(address(usdc), treasury);
        assertEq(usdc.balanceOf(treasury), 300_000);
        vm.expectRevert(PactiqVault.NothingToWithdraw.selector);
        vault.withdrawProtocolFees(NATIVE, treasury);
        _assertSolvent(address(usdc));
    }

    function test_Qusdc_RejectsValueBelowMinimumAndUnlistedTokens() public {
        vm.startPrank(alice);
        vm.expectRevert(PactiqVault.InsufficientStake.selector);
        vault.createPact{value: 1 ether}("x", PactiqVault.Category.FITNESS, address(usdc), DAILY, 5, "", address(0));
        vm.expectRevert(PactiqVault.InsufficientStake.selector);
        vault.createPact("x", PactiqVault.Category.FITNESS, address(usdc), USD / 20, 5, "", address(0));

        MockUSDC other = new MockUSDC();
        vm.expectRevert(PactiqVault.UnsupportedAsset.selector);
        vault.createPact("x", PactiqVault.Category.FITNESS, address(other), DAILY, 5, "", address(0));
        vm.expectRevert(PactiqVault.UnsupportedAsset.selector);
        vault.fundRewardPool(address(other), USD);
        vm.stopPrank();
    }

    function test_Qusdc_NeedsAllowance() public {
        vm.prank(carol);
        usdc.approve(address(vault), 0);
        vm.prank(carol);
        vm.expectRevert(); // ERC20InsufficientAllowance
        vault.createPact("x", PactiqVault.Category.FITNESS, address(usdc), DAILY, 5, "", address(0));
    }

    function test_Qusdc_DisablingOnlyBlocksNewPacts() public {
        uint256 id = _usdcPact(alice, 3, address(0));
        vault.setStakeAsset(address(usdc), 0);
        vm.prank(bob);
        vm.expectRevert(PactiqVault.UnsupportedAsset.selector);
        vault.createPact("x", PactiqVault.Category.FITNESS, address(usdc), DAILY, 3, "", address(0));

        // Existing pacts keep checking in and settling; the pool can still be topped up.
        _checkInDays(alice, id, 1, 3);
        vm.prank(brand);
        vault.fundRewardPool(address(usdc), USD);
        uint256 before = usdc.balanceOf(alice);
        vault.settlePact(id);
        assertEq(usdc.balanceOf(alice) - before, 6 * USD + 900_000);
        assertEq(vault.getStakeAssets().length, 2); // still listed
    }

    function test_Qusdc_RefusesFeeOnTransferTokens() public {
        FeeOnTransferToken fee = new FeeOnTransferToken();
        vault.setStakeAsset(address(fee), 1);
        fee.mint(alice, 100 ether);
        vm.startPrank(alice);
        fee.approve(address(vault), type(uint256).max);
        vm.expectRevert(PactiqVault.UnsupportedAsset.selector);
        vault.createPact("x", PactiqVault.Category.FITNESS, address(fee), 1 ether, 3, "", address(0));
        vm.stopPrank();
    }

    function test_Qusdc_SquadSplitsSlashAndSponsorship() public {
        vm.prank(brand);
        uint256 squadId = vault.createSquad(
            "Stable Sprint",
            PactiqVault.Category.FITNESS,
            address(usdc),
            USD,
            5,
            vm.getBlockTimestamp() + 1 hours,
            10,
            "QIE Labs",
            20 * USD
        );
        assertEq(vault.getSquad(squadId).asset, address(usdc));
        assertEq(vault.getSquad(squadId).sponsorPool, 20 * USD);

        vm.prank(alice);
        uint256 pa = vault.joinSquad(squadId, "");
        vm.prank(bob);
        uint256 pb = vault.joinSquad(squadId, "");
        vm.prank(carol);
        vault.sponsorSquad(squadId, 5 * USD);
        vm.prank(carol);
        vm.expectRevert(PactiqVault.InsufficientStake.selector);
        vault.sponsorSquad{value: 1 ether}(squadId, 1 ether); // QIE can't sponsor a QUSDC squad

        _checkInDays(alice, pa, 1, 5);
        _checkInDays(bob, pb, 1, 1); // bob quits: 4 QUSDC slashed
        vm.warp(vault.squadEndsAt(squadId) + 1);

        uint256 before = usdc.balanceOf(alice);
        vault.settlePact(pa);
        // pot = 4 * 95% + 25 sponsorship = 28.8, one finisher
        assertEq(usdc.balanceOf(alice) - before, 5 * USD + 28_800_000);
        vault.settlePact(pb);
        assertEq(vault.getLedger(address(usdc)).squadEscrow, 0);
        assertEq(vault.getLedger(address(usdc)).sponsored, 25 * USD);
        assertEq(address(vault).balance, 0);
        _assertSolvent(address(usdc));
    }

    function test_Qusdc_CharityReceivesQusdcSeparately() public {
        uint256 id = _usdcPact(alice, 5, charity);
        _checkInDays(alice, id, 1, 3);
        vm.warp(vault.settleableAt(id) + 1);
        vault.settlePact(id);

        PactiqVault.Charity[] memory inUsdc = vault.getCharities(address(usdc));
        assertEq(inUsdc[0].pending, 4 * USD);
        assertEq(vault.getCharities(NATIVE)[0].pending, 0);
        vm.expectRevert(PactiqVault.NothingToWithdraw.selector);
        vault.releaseCharity(charity, NATIVE);
        vault.releaseCharity(charity, address(usdc));
        assertEq(usdc.balanceOf(charity), 4 * USD);
        assertEq(vault.getLedger(address(usdc)).charityEscrow, 0);
    }

    function test_Qusdc_ReputationIsSharedAcrossAssets() public {
        uint256 a = _usdcPact(alice, 3, address(0));
        _checkInDays(alice, a, 1, 3);
        vm.prank(alice);
        uint256 b = vault.createPact{value: 3 ether}(
            "QIE one", PactiqVault.Category.FITNESS, NATIVE, 1 ether, 3, "", address(0)
        );
        _checkInDays(alice, b, 1, 2);
        assertEq(vault.userTotalCheckIns(alice), 5);
        assertEq(vault.totalCheckIns(), 5);
        assertEq(vault.getProtocolStats(NATIVE).checkIns, 5);
        assertEq(vault.getProtocolStats(address(usdc)).pactCount, 2);
    }

    function test_Admin_StakeAssetIsOwnerOnly() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setStakeAsset(address(usdc), 0);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setQieNames(address(0));
    }

    function testFuzz_MixedAssetsConserveFunds(uint8 rawDays, uint8 rawA, uint8 rawB, uint96 rawStake) public {
        uint256 days_ = bound(rawDays, 3, 20);
        uint256 checksA = bound(rawA, 0, days_);
        uint256 checksB = bound(rawB, 0, days_);
        uint256 daily = bound(rawStake, USD / 10, 20 * USD);
        vm.prank(brand);
        vault.fundRewardPool(address(usdc), 10 * USD);

        vm.prank(alice);
        uint256 a = vault.createPact("A", PactiqVault.Category.FITNESS, address(usdc), daily, days_, "", address(0));
        vm.prank(bob);
        uint256 b = vault.createPact{value: 1 ether * days_}(
            "B", PactiqVault.Category.FITNESS, NATIVE, 1 ether, days_, "", charity
        );
        if (checksA > 0) _checkInDays(alice, a, 1, checksA);
        if (checksB > 0) _checkInDays(bob, b, 1, checksB);
        vm.warp(vault.settleableAt(a) + 1);

        uint256 usdcBefore = usdc.balanceOf(alice);
        vault.settlePact(a);
        uint256 paid = usdc.balanceOf(alice) - usdcBefore;
        assertGe(paid, checksA * daily);
        assertLe(paid, checksA * daily + (checksA * daily * 1500) / 10_000);
        uint256 qieBefore = bob.balance;
        vault.settlePact(b);
        assertEq(bob.balance - qieBefore, checksB * 1 ether);
        _assertSolvent(address(usdc));
        _assertSolvent(NATIVE);
    }

    // =====================================================================
    // QIE ID (.qie names)
    // =====================================================================

    function test_QieId_OnlyNamesTheWalletHolds() public {
        names.set(alice, "alice.qie");
        vm.prank(alice);
        uint256 id =
            vault.createPact("Run", PactiqVault.Category.FITNESS, address(usdc), DAILY, 3, "alice.qie", address(0));
        assertEq(vault.getPact(id).qieId, "alice.qie");
        assertEq(vault.userQieId(alice), "alice.qie");

        vm.prank(bob); // bob can't borrow alice's name
        vm.expectRevert(PactiqVault.QieIdNotOwned.selector);
        vault.createPact("Run", PactiqVault.Category.FITNESS, address(usdc), DAILY, 3, "alice.qie", address(0));

        // Squad joins are checked too.
        vm.prank(brand);
        uint256 squadId = vault.createSquad(
            "S", PactiqVault.Category.FITNESS, address(usdc), USD, 3, vm.getBlockTimestamp() + 1 hours, 5, "", 0
        );
        vm.prank(bob);
        vm.expectRevert(PactiqVault.QieIdNotOwned.selector);
        vault.joinSquad(squadId, "alice.qie");
        vm.prank(alice);
        vault.joinSquad(squadId, "alice.qie");
    }

    function test_QieId_NoCheckerMeansNoNames() public {
        vault.setQieNames(address(0));
        vm.prank(alice);
        vm.expectRevert(PactiqVault.QieIdNotOwned.selector);
        vault.createPact("Run", PactiqVault.Category.FITNESS, address(usdc), DAILY, 3, "alice.qie", address(0));
        vm.prank(alice); // pacts without a name still work
        vault.createPact("Run", PactiqVault.Category.FITNESS, address(usdc), DAILY, 3, "", address(0));
    }

    function test_NameVerifier_ReadsBothRegistriesAndReverseResolver() public {
        MockQieRegistry a = new MockQieRegistry();
        MockQieRegistry b = new MockQieRegistry();
        MockQieReverse rev = new MockQieReverse();
        QieNameVerifier v = new QieNameVerifier(address(a), address(b), address(rev));

        a.register("alice.qie", alice);
        b.register("bob.qie", bob);
        rev.setPrimary(carol, "carol.qie");

        assertTrue(v.owns(alice, "alice.qie"));
        assertTrue(v.owns(bob, "bob.qie")); // second registry
        assertTrue(v.owns(carol, "carol.qie")); // primary name only
        assertFalse(v.owns(bob, "alice.qie"));
        assertFalse(v.owns(alice, ""));
        assertFalse(v.owns(address(0), "nobody.qie"));
        assertEq(v.nameOf(carol), "carol.qie");

        // A registry that reverts just answers "no"; the other one still counts.
        a.setBroken(true);
        assertFalse(v.owns(alice, "alice.qie"));
        assertTrue(v.owns(bob, "bob.qie"));

        // End to end through the vault.
        vault.setQieNames(address(v));
        vm.prank(bob);
        vault.createPact("Run", PactiqVault.Category.FITNESS, address(usdc), DAILY, 3, "bob.qie", address(0));
        vm.prank(alice);
        vm.expectRevert(PactiqVault.QieIdNotOwned.selector);
        vault.createPact("Run", PactiqVault.Category.FITNESS, address(usdc), DAILY, 3, "alice.qie", address(0));
    }
}
