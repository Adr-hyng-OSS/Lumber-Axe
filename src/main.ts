import { world, PlayerLeaveAfterEvent, ItemTypes, ScriptEventCommandMessageAfterEvent, system, ScriptEventSource, Player } from '@minecraft/server';
import { ADDON_IDENTIFIER, InteractedTreeResult, playerInteractionMap, SendMessageTo, serverConfigurationCopy, VisitedBlockResult} from "./index"
import { Logger } from 'utils/logger';
import './items/axes';
import { Graph } from 'utils/graph';

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

world.beforeEvents.playerBreakBlock.subscribe((e) => {
  const player = e.player;
  const blockInteracted = e.block;
  const location = JSON.parse(JSON.stringify(e.block.location));
  let inspectedTree: InteractedTreeResult;
  let index = 0;
  console.warn(JSON.stringify(blockInteracted.bottomCenter()));
  for(const visitedLogsGraph of player.visitedLogs) {
      const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
      if(!interactedNode) continue; 
      index = player.visitedLogs.indexOf(visitedLogsGraph);
      if(index === -1) continue;
      inspectedTree = player.visitedLogs[index];
      break;
  }
  if(!inspectedTree) return;
  // for(const blockOutline of inspectedTree.visitedLogs.blockOutlines) {
  //   if(blockOutline?.isValid()) continue;
  //   let {x, y, z} = blockOutline.lastLocation;
  //   x -= 0.5;
  //   z -= 0.5;
  //   console.warn(JSON.stringify({x, y, z}));
  //   console.warn(JSON.stringify(inspectedTree.visitedLogs.source.getNode({x, y, z}).location))
  //   inspectedTree.visitedLogs.source.removeNode({x, y, z});
  // }

  // const tempResult: VisitedBlockResult = {blockOutlines: [], source: new Graph()};

  //! It doesn't work when you inspect from a specific location, and break the location, and inspect to others.

  // Traverse the interacted block to validate the remaining nodes, if something was removed.
  console.warn("BEFORE: ", inspectedTree.visitedLogs.source.getSize());
  inspectedTree.visitedLogs.source.removeNode(location); // with 0.5 deducted
  console.warn("AFTER: ", inspectedTree.visitedLogs.source.getSize(), player.visitedLogs[index].visitedLogs.source.getSize());
  inspectedTree.visitedLogs.source.traverse({x: -3124, y: 63, z: 1750}, "BFS", (node) => {
      if(node) {
          console.warn(JSON.stringify(node.location));
      } 
  });
  // system.runTimeout(() => {
  // }, 10);
});

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