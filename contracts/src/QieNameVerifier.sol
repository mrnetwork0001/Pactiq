// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IQieNames} from "./IQieNames.sol";

/// @notice QIE's forward name registries: `resolver("alice.qie")` returns the name's node and owner.
interface IQieNameRegistry {
    function resolver(string calldata name) external view returns (bytes32 node, address owner);
}

/// @notice QIE's reverse resolver: a wallet's primary .qie name, or "" when none is set.
interface IQieReverseResolver {
    function resolve(address addr) external view returns (string memory);
}

/**
 * @title QieNameVerifier
 * @notice Checks a .qie name against QIE's live name service, so the names Pactiq shows on
 *         pacts, squads and the register are ones the wallet really holds.
 *
 *  QIE runs two forward registries (a name lives in exactly one of them) and one reverse
 *  resolver for primary names. A wallet owns a name if either registry says it is the
 *  owner, or the reverse resolver returns that name as its primary name.
 *
 *  QIE Mainnet (chain 1990):
 *    registries        0x26cCB3fABd6db18834987134d715Ba2346CE7223, 0x1D69d75AD7b77b91C3760F84faC52E651710f62e
 *    reverse resolver  0x76ec8ed377cC0d36D1B48027ac7892Ec6799171E
 *
 *  Every lookup is wrapped in try/catch: a registry that reverts or disappears just answers "no".
 */
contract QieNameVerifier is IQieNames {
    IQieNameRegistry public immutable registryA;
    IQieNameRegistry public immutable registryB;
    IQieReverseResolver public immutable reverseResolver;

    constructor(address _registryA, address _registryB, address _reverseResolver) {
        registryA = IQieNameRegistry(_registryA);
        registryB = IQieNameRegistry(_registryB);
        reverseResolver = IQieReverseResolver(_reverseResolver);
    }

    function owns(address user, string calldata name) external view returns (bool) {
        if (user == address(0) || bytes(name).length == 0) return false;
        if (_forwardOwner(registryA, name) == user || _forwardOwner(registryB, name) == user) return true;
        return keccak256(bytes(nameOf(user))) == keccak256(bytes(name));
    }

    /// @notice The wallet's primary .qie name, or "" when it has none (or the resolver fails).
    function nameOf(address user) public view returns (string memory) {
        if (address(reverseResolver) == address(0)) return "";
        try reverseResolver.resolve(user) returns (string memory name) {
            return name;
        } catch {
            return "";
        }
    }

    function _forwardOwner(IQieNameRegistry registry, string calldata name) internal view returns (address) {
        if (address(registry) == address(0)) return address(0);
        try registry.resolver(name) returns (bytes32, address owner) {
            return owner;
        } catch {
            return address(0);
        }
    }
}
