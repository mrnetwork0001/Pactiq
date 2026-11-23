// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IQiedexRouter {
    function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
}

/**
 * @title PactiqRouter
 * @notice Puts every swap made inside Pactiq on the record.
 *
 * Pactiq's swap screen and stake top-ups trade on QIEDEX. Sent straight to QIEDEX, those trades
 * would look like any other. Sent through this contract they are attributable: each one emits
 * `PactiqSwap`, and the running totals are readable on-chain.
 *
 * The contract holds nothing between calls and takes no fee. What the user sends is swapped on
 * QIEDEX in the same transaction and the proceeds go straight to the user's wallet. It has no
 * owner and no settings.
 */
contract PactiqRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The QIEDEX router every trade is executed on.
    IQiedexRouter public immutable qiedex;
    /// @notice Wrapped QIE, the pool-side form of the native coin.
    address public immutable wqie;

    /// @notice Number of swaps made through Pactiq.
    uint256 public totalSwaps;
    /// @notice QIE moved through Pactiq swaps: QIE sold plus QIE bought, in wei.
    uint256 public totalQieVolume;
    /// @notice Swaps made by each wallet.
    mapping(address => uint256) public swapsOf;

    /// @param tokenIn  what the user sold; the zero address means native QIE
    /// @param tokenOut what the user received; the zero address means native QIE
    event PactiqSwap(
        address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut
    );

    error ZeroAddress();
    error ZeroAmount();

    constructor(address _qiedex, address _wqie) {
        if (_qiedex == address(0) || _wqie == address(0)) revert ZeroAddress();
        qiedex = IQiedexRouter(_qiedex);
        wqie = _wqie;
    }

    /// @notice Sell the QIE sent with the call for `tokenOut`. Reverts if it buys less than `minOut`.
    function swapQieForToken(address tokenOut, uint256 minOut, uint256 deadline)
        external
        payable
        nonReentrant
        returns (uint256 amountOut)
    {
        if (msg.value == 0) revert ZeroAmount();
        address[] memory path = new address[](2);
        path[0] = wqie;
        path[1] = tokenOut;

        uint256[] memory amounts = qiedex.swapExactETHForTokens{value: msg.value}(minOut, path, msg.sender, deadline);
        amountOut = amounts[amounts.length - 1];
        _record(address(0), tokenOut, msg.value, amountOut, msg.value);
    }

    /// @notice Sell `amountIn` of `tokenIn` for QIE. Needs an allowance for this contract first.
    function swapTokenForQie(address tokenIn, uint256 amountIn, uint256 minOut, uint256 deadline)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert ZeroAmount();
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = wqie;

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(address(qiedex), amountIn);
        uint256[] memory amounts = qiedex.swapExactTokensForETH(amountIn, minOut, path, msg.sender, deadline);
        amountOut = amounts[amounts.length - 1];
        _record(tokenIn, address(0), amountIn, amountOut, amountOut);
    }

    /// @notice What `amountIn` of `tokenIn` buys on QIEDEX right now. Use the zero address for QIE.
    function quote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn == address(0) ? wqie : tokenIn;
        path[1] = tokenOut == address(0) ? wqie : tokenOut;
        uint256[] memory amounts = qiedex.getAmountsOut(amountIn, path);
        return amounts[amounts.length - 1];
    }

    function _record(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 qieMoved) private {
        unchecked {
            ++totalSwaps;
            ++swapsOf[msg.sender];
        }
        totalQieVolume += qieMoved;
        emit PactiqSwap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }
}
