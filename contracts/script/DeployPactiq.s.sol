// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PactiqVault} from "../src/PactiqVault.sol";

contract DeployPactiq is Script {
    function run() external returns (PactiqVault vault) {
        uint256 deployerPrivateKey = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address oracleSigner = vm.envOr(
            "ORACLE_SIGNER_ADDRESS",
            vm.addr(deployerPrivateKey)
        );

        vm.startBroadcast(deployerPrivateKey);

        vault = new PactiqVault(oracleSigner);
        console.log("PactiqVault deployed at:", address(vault));
        console.log("Oracle Signer configured as:", oracleSigner);

        vm.stopBroadcast();
    }
}
