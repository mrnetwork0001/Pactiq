// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PactiqVault} from "../src/PactiqVault.sol";
import {PactiqBadges} from "../src/PactiqBadges.sol";
import {QieNameVerifier} from "../src/QieNameVerifier.sol";
import {PactiqRouter} from "../src/PactiqRouter.sol";

/**
 * Deploy PactiqVault + PactiqBadges (+ QieNameVerifier on mainnet) and wire them together.
 *
 * Required env:
 *   PRIVATE_KEY            deployer key (becomes owner of both contracts)
 *   ORACLE_SIGNER_ADDRESS  address of the verifier key used by the frontend (/api/verify-proof, /api/qie-pass)
 * Optional env:
 *   BADGE_BASE_URI         e.g. https://your-app.vercel.app/api/badge/  (token id is appended)
 *   PRICE_FEED_ADDRESS     QIE Oracle feed; defaults to the official QIE/USDT feed on mainnet (1990)
 *   STABLECOIN_ADDRESS     stake asset next to QIE; defaults to QUSDC on mainnet
 *   STABLECOIN_MIN_PER_DAY minimum daily stake in the stablecoin's smallest unit (default 100000 = 0.10 QUSDC)
 *   QIE_NAMES_ADDRESS      an existing IQieNames checker; on mainnet a QieNameVerifier is deployed by default
 *   SEED_REWARD_POOL_WEI   QIE (wei) donated to the QIE completion-bonus pool at launch
 *   CHARITY_ADDRESS + CHARITY_NAME   first cause for charity mode
 *
 *   forge script script/DeployPactiq.s.sol --rpc-url qie_mainnet --broadcast
 */
contract DeployPactiq is Script {
    uint256 internal constant QIE_MAINNET = 1990;
    address internal constant QIE_ORACLE_QIE_USD = 0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17;
    address internal constant QUSDC = 0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5;
    // QIE's name service (QIE ID): two forward registries and the reverse resolver for primary names.
    address internal constant QIE_NAME_REGISTRY_A = 0x26cCB3fABd6db18834987134d715Ba2346CE7223;
    address internal constant QIE_NAME_REGISTRY_B = 0x1D69d75AD7b77b91C3760F84faC52E651710f62e;
    address internal constant QIE_REVERSE_RESOLVER = 0x76ec8ed377cC0d36D1B48027ac7892Ec6799171E;
    address internal constant QIEDEX_ROUTER = 0x08cd2e72e156D8563B4351eb4065C262A9f553Ef;
    address internal constant WQIE = 0x0087904D95BEe9E5F24dc8852804b547981A9139;

    function run() external returns (PactiqVault vault, PactiqBadges badges, PactiqRouter router) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address oracleSigner = vm.envAddress("ORACLE_SIGNER_ADDRESS");
        address deployer = vm.addr(deployerKey);
        bool mainnet = block.chainid == QIE_MAINNET;

        address priceFeed = vm.envOr("PRICE_FEED_ADDRESS", mainnet ? QIE_ORACLE_QIE_USD : address(0));
        address stablecoin = vm.envOr("STABLECOIN_ADDRESS", mainnet ? QUSDC : address(0));
        uint256 stableMin = vm.envOr("STABLECOIN_MIN_PER_DAY", uint256(100_000));
        address qieNames = vm.envOr("QIE_NAMES_ADDRESS", address(0));
        uint256 seed = vm.envOr("SEED_REWARD_POOL_WEI", uint256(0));
        string memory baseURI = vm.envOr("BADGE_BASE_URI", string(""));
        address charity = vm.envOr("CHARITY_ADDRESS", address(0));
        string memory charityName = vm.envOr("CHARITY_NAME", string(""));

        if (oracleSigner == deployer) {
            console.log("WARNING: oracle signer == deployer. Use a separate key for the verifier.");
        }

        vm.startBroadcast(deployerKey);
        vault = new PactiqVault(oracleSigner, priceFeed);
        badges = new PactiqBadges(baseURI);
        badges.setMinter(address(vault));
        vault.setBadges(address(badges));
        if (qieNames == address(0) && mainnet) {
            qieNames = address(new QieNameVerifier(QIE_NAME_REGISTRY_A, QIE_NAME_REGISTRY_B, QIE_REVERSE_RESOLVER));
        }
        if (qieNames != address(0)) vault.setQieNames(qieNames);
        if (stablecoin != address(0)) vault.setStakeAsset(stablecoin, stableMin);
        if (charity != address(0)) vault.setCharity(charity, charityName, true);
        if (seed > 0) vault.fundRewardPool{value: seed}(address(0), seed);
        // Swaps made inside Pactiq go through this router so they are attributed on-chain.
        if (mainnet) router = new PactiqRouter(QIEDEX_ROUTER, WQIE);
        vm.stopBroadcast();

        console.log("Chain ID:            ", block.chainid);
        console.log("PactiqVault:         ", address(vault));
        console.log("PactiqBadges:        ", address(badges));
        console.log("PactiqRouter:        ", address(router));
        console.log("QIE ID verifier:     ", qieNames);
        console.log("Stablecoin (QUSDC):  ", stablecoin);
        console.log("Owner:               ", deployer);
        console.log("Oracle signer:       ", oracleSigner);
        console.log("Price feed:          ", priceFeed);
        console.log("Seeded reward pool:  ", seed);
        console.log("Badge base URI:      ", baseURI);
        console.log("Charity:             ", charity);
    }
}
