// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PactiqCampaign} from "../src/PactiqCampaign.sol";

/**
 * Deploys a launch campaign. The contract starts empty: send the prize money to its address to fund it.
 *
 *   forge script script/DeployCampaign.s.sol --rpc-url qie_mainnet --broadcast
 *
 * Env:
 *   PRIVATE_KEY          deployer (becomes the owner, who can recover unclaimed funds afterwards)
 *   CAMPAIGN_VAULT       the PactiqVault whose streaks decide who qualifies
 *   CAMPAIGN_REWARD_WEI  QIE per winner, in wei          (default 20 QIE)
 *   CAMPAIGN_WINNERS     number of rewards               (default 10)
 *   CAMPAIGN_MIN_STREAK  consecutive days needed         (default 3)
 *   CAMPAIGN_STARTS_AT   unix time claims open           (default 27 Nov 2026 09:00 UTC)
 *   CAMPAIGN_ENDS_AT     unix time claims close          (default 30 Nov 2026 00:00 UTC)
 */
contract DeployCampaign is Script {
    function run() external returns (PactiqCampaign campaign) {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address vault = vm.envAddress("CAMPAIGN_VAULT");
        uint256 reward = vm.envOr("CAMPAIGN_REWARD_WEI", uint256(20 ether));
        uint256 winners = vm.envOr("CAMPAIGN_WINNERS", uint256(10));
        uint256 minStreak = vm.envOr("CAMPAIGN_MIN_STREAK", uint256(3));
        uint256 startsAt = vm.envOr("CAMPAIGN_STARTS_AT", uint256(1795770000));
        uint256 endsAt = vm.envOr("CAMPAIGN_ENDS_AT", uint256(1795996800));

        vm.startBroadcast(key);
        campaign = new PactiqCampaign(vault, reward, winners, minStreak, startsAt, endsAt);
        vm.stopBroadcast();

        console.log("PactiqCampaign:  ", address(campaign));
        console.log("Vault:           ", vault);
        console.log("Reward (wei):    ", reward);
        console.log("Winners:         ", winners);
        console.log("Min streak:      ", minStreak);
        console.log("Starts at:       ", startsAt);
        console.log("Ends at:         ", endsAt);
        console.log("Prize to send:   ", reward * winners);
    }
}
