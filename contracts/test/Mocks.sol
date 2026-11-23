// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IQieNames} from "../src/IQieNames.sol";

/// @notice 6-decimal stablecoin standing in for QUSDC.
contract MockUSDC is ERC20 {
    constructor() ERC20("QUSDC", "QUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Takes a 1% cut on every transfer, which the vault must refuse.
contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0xdead), fee);
            value -= fee;
        }
        super._update(from, to, value);
    }
}

/// @notice Stand-in for QieNameVerifier: names are whatever the test assigns.
contract MockQieNames is IQieNames {
    mapping(address => string) public nameOf;

    function set(address user, string calldata name) external {
        nameOf[user] = name;
    }

    function owns(address user, string calldata name) external view returns (bool) {
        return bytes(name).length > 0 && keccak256(bytes(nameOf[user])) == keccak256(bytes(name));
    }
}

/// @notice Mimics one of QIE's forward registries: resolver(name) -> (node, owner).
contract MockQieRegistry {
    mapping(bytes32 => address) internal _owner;
    bool public broken;

    function register(string calldata name, address owner) external {
        _owner[keccak256(bytes(name))] = owner;
    }

    function setBroken(bool b) external {
        broken = b;
    }

    function resolver(string calldata name) external view returns (bytes32 node, address owner) {
        require(!broken, "registry down");
        owner = _owner[keccak256(bytes(name))];
        node = owner == address(0) ? bytes32(0) : keccak256(bytes(name));
    }
}

/// @notice Mimics QIE's reverse resolver: resolve(address) -> primary name.
contract MockQieReverse {
    mapping(address => string) internal _primary;

    function setPrimary(address user, string calldata name) external {
        _primary[user] = name;
    }

    function resolve(address addr) external view returns (string memory) {
        return _primary[addr];
    }
}
