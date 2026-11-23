// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IQieNames} from "../../src/IQieNames.sol";

interface IQieNamesReader is IQieNames {
    function nameOf(address user) external view returns (string memory);
}

/**
 * LOCAL DEMO ONLY. Never deploy this to a real network.
 *
 * The demo replays activity from anvil's test accounts, which own no real .qie names. This
 * checker answers from QIE's real name service first (the fork has it, via QieNameVerifier),
 * then from demo names the seed script assigns to those test accounts.
 */
contract LocalQieNames is IQieNames {
    IQieNamesReader public immutable real;
    address public immutable deployer;
    mapping(address => string) internal _demo;

    constructor(address _real) {
        real = IQieNamesReader(_real);
        deployer = msg.sender;
    }

    function set(address user, string calldata name) external {
        require(msg.sender == deployer, "only deployer");
        _demo[user] = name;
    }

    function owns(address user, string calldata name) external view returns (bool) {
        if (bytes(name).length > 0 && keccak256(bytes(_demo[user])) == keccak256(bytes(name))) return true;
        return address(real) != address(0) && real.owns(user, name);
    }

    function nameOf(address user) external view returns (string memory) {
        if (bytes(_demo[user]).length > 0) return _demo[user];
        return address(real) == address(0) ? "" : real.nameOf(user);
    }
}
