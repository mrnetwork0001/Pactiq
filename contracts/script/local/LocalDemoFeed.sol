// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * LOCAL DEMO ONLY — never deploy to a real network.
 *
 * The seed script fast-forwards a mainnet fork by several days, which makes the real QIE Oracle
 * answer look stale to PactiqVault (PRICE_MAX_AGE = 1 day). This shim re-serves the real oracle's
 * price with a fresh timestamp so USD-denominated pacts keep working on the fork.
 */
interface IFeed {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

contract LocalDemoFeed {
    IFeed public immutable source;

    constructor(address source_) {
        source = IFeed(source_);
    }

    function decimals() external view returns (uint8) {
        return source.decimals();
    }

    function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256, uint256, uint80) {
        (roundId, answer,,,) = source.latestRoundData();
        return (roundId, answer, block.timestamp, block.timestamp, roundId);
    }
}
