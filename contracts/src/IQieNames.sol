// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Answers whether a wallet holds a QIE ID (.qie name). Implemented on mainnet by
///         QieNameVerifier, which reads QIE's own name registries.
interface IQieNames {
    function owns(address user, string calldata name) external view returns (bool);
}
