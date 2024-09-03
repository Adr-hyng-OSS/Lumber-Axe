import { world, ItemStack, Block, Player, ItemDurabilityComponent, ItemEnchantableComponent, ItemUseOnBeforeEvent, PlayerLeaveAfterEvent } from '@minecraft/server';
import { FormCancelationReason, ActionFormData, ActionFormResponse} from "@minecraft/server-ui";
import { durabilityDamagePerBlock ,axeEquipments, forceShow, getTreeLogs, isLogIncluded, playerInteractionMap} from "./index"
import { MinecraftEnchantmentTypes } from './modules/vanilla-types/index';

// system.beforeEvents.watchdogTerminate.subscribe((e: WatchdogTerminateBeforeEvent) => {
//     e.cancel = true;
//     if(e.terminateReason === WatchdogTerminateReason.Hang){
//         for(const key of playerInteractionMap.keys()) {
//             playerInteractionMap.set(key, false);
//         }
//         if(!disableWatchDogTerminateLog) world.sendMessage({
//             rawtext: [
//             {
//                 translate: "LumberAxe.watchdogError.hang.text"
//             }
//         ]});
//         if(disableWatchDogTerminateLog) console.warn(`Scripting Error: Try chopping or inspecting smaller trees or different angle.`);
//     }
//     console.warn(`Watchdog Error: ${(e.terminateReason as WatchdogTerminateReason)}`)
// });

world.afterEvents.playerLeave.subscribe((e: PlayerLeaveAfterEvent) => {
    playerInteractionMap.set(e.playerId, false);
});
