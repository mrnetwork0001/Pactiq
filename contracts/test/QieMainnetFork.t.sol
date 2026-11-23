// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PactiqVault} from "../src/PactiqVault.sol";
import {QieNameVerifier} from "../src/QieNameVerifier.sol";
import {PactiqRouter} from "../src/PactiqRouter.sol";

interface IUniswapV2Router {
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory);

    function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory amounts);
}

/**
 * Runs against live QIE Mainnet state (no transactions are sent):
 *   QIE_FORK=1 forge test --match-contract QieMainnetFork -vv
 *
 * Checks the real QIE name service, the real QUSDC token, and a QIEDEX swap into a QUSDC pact.
 */
contract QieMainnetForkTest is Test {
    address internal constant QUSDC = 0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5;
    address internal constant WQIE = 0x0087904D95BEe9E5F24dc8852804b547981A9139;
    address internal constant QIEDEX_ROUTER = 0x08cd2e72e156D8563B4351eb4065C262A9f553Ef;
    address internal constant QIE_ORACLE = 0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17;
    address internal constant REGISTRY_A = 0x26cCB3fABd6db18834987134d715Ba2346CE7223;
    address internal constant REGISTRY_B = 0x1D69d75AD7b77b91C3760F84faC52E651710f62e;
    address internal constant REVERSE = 0x76ec8ed377cC0d36D1B48027ac7892Ec6799171E;
    // Public, on-chain facts: etherium.qie is a primary name; test.qie lives in the second registry.
    address internal constant ETHERIUM_QIE_OWNER = 0xE63A7e2C9B068056916d02807A976d42d460C92f;
    address internal constant TEST_QIE_OWNER = 0x2220541bC5506E01be95bdc82297Fbf061df132A;

    QieNameVerifier internal verifier;

    function setUp() public {
        if (!vm.envOr("QIE_FORK", false)) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(vm.rpcUrl("qie_mainnet"));
        verifier = new QieNameVerifier(REGISTRY_A, REGISTRY_B, REVERSE);
    }

    function test_Fork_RealQieNames() public view {
        assertTrue(verifier.owns(ETHERIUM_QIE_OWNER, "etherium.qie"));
        assertTrue(verifier.owns(TEST_QIE_OWNER, "test.qie"));
        assertEq(verifier.nameOf(ETHERIUM_QIE_OWNER), "etherium.qie");
        assertFalse(verifier.owns(TEST_QIE_OWNER, "etherium.qie"));
        assertFalse(verifier.owns(address(0xBEEF), "etherium.qie"));
        assertFalse(verifier.owns(ETHERIUM_QIE_OWNER, "ETHERIUM.qie")); // names are lowercase
    }

    /// PactiqRouter against the real QIEDEX pool: QIE to QUSDC and back, attributed and nothing left behind.
    function test_Fork_PactiqRouterSwapsBothWaysOnQiedex() public {
        PactiqRouter router = new PactiqRouter(QIEDEX_ROUTER, WQIE);
        address user = makeAddr("swapper");
        vm.deal(user, 100 ether);

        uint256 quoted = router.quote(address(0), QUSDC, 20 ether);
        assertGt(quoted, 0);

        vm.startPrank(user);
        uint256 got = router.swapQieForToken{value: 20 ether}(QUSDC, (quoted * 99) / 100, block.timestamp + 600);
        assertEq(got, quoted);
        assertEq(IERC20(QUSDC).balanceOf(user), got);

        uint256 qieBefore = user.balance;
        IERC20(QUSDC).approve(address(router), got);
        uint256 back = router.swapTokenForQie(QUSDC, got, 0, block.timestamp + 600);
        vm.stopPrank();

        assertEq(user.balance - qieBefore, back);
        assertLt(back, 20 ether); // two trades cost two pool fees
        assertGt(back, 19 ether);
        assertEq(IERC20(QUSDC).balanceOf(user), 0);
        assertEq(router.totalSwaps(), 2);
        assertEq(router.swapsOf(user), 2);
        assertEq(router.totalQieVolume(), 20 ether + back);
        assertEq(address(router).balance, 0);
        assertEq(IERC20(QUSDC).balanceOf(address(router)), 0);
    }

    function test_Fork_SwapOnQiedexThenStakeQusdc() public {
        PactiqVault vault = new PactiqVault(address(0x0AC1E), QIE_ORACLE);
        vault.setStakeAsset(QUSDC, 100_000);
        vault.setQieNames(address(verifier));

        address user = ETHERIUM_QIE_OWNER;
        vm.deal(user, 100 ether);
        address[] memory path = new address[](2);
        path[0] = WQIE;
        path[1] = QUSDC;
        uint256 quoted = IUniswapV2Router(QIEDEX_ROUTER).getAmountsOut(50 ether, path)[1];
        assertGt(quoted, 0);

        vm.startPrank(user);
        uint256 before = IERC20(QUSDC).balanceOf(user);
        IUniswapV2Router(QIEDEX_ROUTER).swapExactETHForTokens{value: 50 ether}(
            (quoted * 99) / 100, path, user, block.timestamp + 600
        );
        uint256 got = IERC20(QUSDC).balanceOf(user) - before;
        assertGe(got, (quoted * 99) / 100);

        IERC20(QUSDC).approve(address(vault), 3 * 1e6);
        uint256 id =
            vault.createPact("Walk 10k steps", PactiqVault.Category.FITNESS, QUSDC, 1e6, 3, "etherium.qie", address(0));
        vm.stopPrank();

        assertEq(IERC20(QUSDC).balanceOf(address(vault)), 3 * 1e6);
        assertEq(vault.getPact(id).qieId, "etherium.qie");
        assertEq(vault.getLedger(QUSDC).activeStake, 3 * 1e6);
    }
}
