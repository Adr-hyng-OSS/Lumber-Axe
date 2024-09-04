import { world, PlayerLeaveAfterEvent, ItemTypes, ScriptEventCommandMessageAfterEvent, system, ScriptEventSource, Player } from '@minecraft/server';
import { ADDON_IDENTIFIER, playerInteractionMap, SendMessageTo, serverConfigurationCopy} from "./index"
import { Logger } from 'utils/logger';
import { MinecraftEffectTypes } from 'modules/vanilla-types/index';
import './items/axes';

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

// world.beforeEvents.playerBreakBlock.subscribe((e) => {
//   const player = e.player;
//   const blockInteracted = e.block;
//   const blockOutlines = player.dimension.getEntities({closest: 1, maxDistance: 1, type: "yn:block_outline", location: blockInteracted.bottomCenter()});
//   if(blockOutlines.length && blockOutlines[0]?.isValid()) {
//     system.runTimeout(() => {
//       blockOutlines[0].addEffect(MinecraftEffectTypes.Invisibility, 2);
//       blockOutlines[0].triggerEvent('despawn');
//     }, 0);
//   }
// });

world.afterEvents.playerSpawn.subscribe((e) => {
    if(!e.initialSpawn) return;
    if(!serverConfigurationCopy.ShowMessageUponJoin.defaultValue) return; 
    SendMessageTo(e.player, {
        rawtext: [
        {
            translate: "LumberAxe.on_load_message"
        }
        ]
    });
});

world.afterEvents.playerLeave.subscribe((e: PlayerLeaveAfterEvent) => {
    playerInteractionMap.set(e.playerId, false);
});

system.afterEvents.scriptEventReceive.subscribe((event: ScriptEventCommandMessageAfterEvent) => {
    if(event.sourceType !== ScriptEventSource.Entity) return;
    if(!(event.sourceEntity instanceof Player)) return;
    if(event.id !== ADDON_IDENTIFIER) return;
    const player = event.sourceEntity as Player;
    const message = event.message;
    const args = message.trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();
    system.run(async () => {
      try {
          const {
            default: CommandObject
          } = await import(`./commands/${cmd}.js`);
          CommandObject.execute(player, args);
      } catch (err) {
        if (err instanceof ReferenceError) {
          SendMessageTo(player, {
            rawtext: [
              {
                translate: "yn:fishing_got_reel.on_caught_main_command_not_found",
                with: [
                  cmd,
                  "\n",
                  ADDON_IDENTIFIER
                ]
              }
            ]
          });
        } else {
          Logger.error(err, err.stack);
        }
      }
    });
  });