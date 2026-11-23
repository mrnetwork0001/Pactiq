// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PactiqRouter} from "../src/PactiqRouter.sol";
import {MockUSDC} from "./Mocks.sol";

/// A stand-in QIEDEX router that trades at a fixed price: 1 QIE = 0.15 QUSDC.
contract FixedPriceDex {
    MockUSDC public immutable usdc;
    address public immutable wqie;
    uint256 internal constant QUSDC_PER_QIE = 150_000; // 6 decimals

    constructor(MockUSDC _usdc, address _wqie) payable {
        usdc = _usdc;
        wqie = _wqie;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path) public view returns (uint256[] memory amounts) {
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = path[0] == wqie ? (amountIn * QUSDC_PER_QIE) / 1e18 : (amountIn * 1e18) / QUSDC_PER_QIE;
    }

    function swapExactETHForTokens(uint256 minOut, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory amounts)
    {
        require(block.timestamp <= deadline, "EXPIRED");
        amounts = getAmountsOut(msg.value, path);
        require(amounts[1] >= minOut, "INSUFFICIENT_OUTPUT_AMOUNT");
        usdc.mint(to, amounts[1]);
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 minOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "EXPIRED");
        amounts = getAmountsOut(amountIn, path);
        require(amounts[1] >= minOut, "INSUFFICIENT_OUTPUT_AMOUNT");
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        (bool ok,) = to.call{value: amounts[1]}("");
        require(ok, "ETH_TRANSFER_FAILED");
    }
}

contract PactiqRouterTest is Test {
    event PactiqSwap(
        address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut
    );

    address internal constant WQIE = address(0xBEEF);
    MockUSDC internal usdc;
    FixedPriceDex internal dex;
    PactiqRouter internal router;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockUSDC();
        dex = new FixedPriceDex{value: 1_000 ether}(usdc, WQIE);
        router = new PactiqRouter(address(dex), WQIE);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function _deadline() internal view returns (uint256) {
        return block.timestamp + 600;
    }

    function test_SellQie_PaysTheUserAndIsRecorded() public {
        vm.expectEmit(true, true, true, true, address(router));
        emit PactiqSwap(alice, address(0), address(usdc), 10 ether, 1_500_000);

        vm.prank(alice);
        uint256 out = router.swapQieForToken{value: 10 ether}(address(usdc), 1_400_000, _deadline());

        assertEq(out, 1_500_000);
        assertEq(usdc.balanceOf(alice), 1_500_000);
        assertEq(alice.balance, 90 ether);
        assertEq(router.totalSwaps(), 1);
        assertEq(router.swapsOf(alice), 1);
        assertEq(router.totalQieVolume(), 10 ether);
    }

    function test_SellToken_PaysTheUserAndIsRecorded() public {
        usdc.mint(alice, 3_000_000);
        vm.startPrank(alice);
        usdc.approve(address(router), 3_000_000);

        vm.expectEmit(true, true, true, true, address(router));
        emit PactiqSwap(alice, address(usdc), address(0), 3_000_000, 20 ether);
        uint256 out = router.swapTokenForQie(address(usdc), 3_000_000, 19 ether, _deadline());
        vm.stopPrank();

        assertEq(out, 20 ether);
        assertEq(alice.balance, 120 ether);
        assertEq(usdc.balanceOf(alice), 0);
        assertEq(router.totalQieVolume(), 20 ether);
    }

    function test_RouterNeverKeepsFundsOrAllowance() public {
        vm.prank(alice);
        router.swapQieForToken{value: 4 ether}(address(usdc), 0, _deadline());
        vm.startPrank(alice);
        usdc.approve(address(router), 600_000);
        router.swapTokenForQie(address(usdc), 600_000, 0, _deadline());
        vm.stopPrank();

        assertEq(address(router).balance, 0);
        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(usdc.allowance(address(router), address(dex)), 0);
    }

    function test_SlippageAndDeadlineAreEnforcedByTheDex() public {
        vm.startPrank(alice);
        vm.expectRevert(bytes("INSUFFICIENT_OUTPUT_AMOUNT"));
        router.swapQieForToken{value: 1 ether}(address(usdc), 150_001, _deadline());
        vm.expectRevert(bytes("EXPIRED"));
        router.swapQieForToken{value: 1 ether}(address(usdc), 0, block.timestamp - 1);
        vm.stopPrank();
        assertEq(router.totalSwaps(), 0);
    }

    function test_RejectsEmptySwapsAndMissingAllowance() public {
        vm.startPrank(alice);
        vm.expectRevert(PactiqRouter.ZeroAmount.selector);
        router.swapQieForToken(address(usdc), 0, _deadline());
        vm.expectRevert(PactiqRouter.ZeroAmount.selector);
        router.swapTokenForQie(address(usdc), 0, 0, _deadline());

        usdc.mint(alice, 1_000_000);
        vm.expectRevert(); // no allowance given to the router
        router.swapTokenForQie(address(usdc), 1_000_000, 0, _deadline());
        vm.stopPrank();
    }

    function test_CountsPerWalletAndQuotes() public {
        vm.prank(alice);
        router.swapQieForToken{value: 1 ether}(address(usdc), 0, _deadline());
        vm.prank(bob);
        router.swapQieForToken{value: 2 ether}(address(usdc), 0, _deadline());
        vm.prank(bob);
        router.swapQieForToken{value: 3 ether}(address(usdc), 0, _deadline());

        assertEq(router.totalSwaps(), 3);
        assertEq(router.swapsOf(alice), 1);
        assertEq(router.swapsOf(bob), 2);
        assertEq(router.totalQieVolume(), 6 ether);
        assertEq(router.quote(address(0), address(usdc), 2 ether), 300_000);
        assertEq(router.quote(address(usdc), address(0), 300_000), 2 ether);
    }

    function test_Constructor_RejectsZeroAddresses() public {
        vm.expectRevert(PactiqRouter.ZeroAddress.selector);
        new PactiqRouter(address(0), WQIE);
        vm.expectRevert(PactiqRouter.ZeroAddress.selector);
        new PactiqRouter(address(dex), address(0));
    }
}
