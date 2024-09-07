import { world, system, ScriptEventSource, Player } from '@minecraft/server';
import { ADDON_IDENTIFIER, playerInteractionMap, SendMessageTo, serverConfigurationCopy } from "./index";
import { Logger } from 'utils/logger';
import './items/axes';
world.beforeEvents.playerBreakBlock.subscribe((e) => {
    const player = e.player;
    const blockInteracted = e.block;
    const location = JSON.parse(JSON.stringify(e.block.location));
    let inspectedTree;
    let index = 0;
    console.warn(JSON.stringify(blockInteracted.bottomCenter()));
    for (const visitedLogsGraph of player.visitedLogs) {
        const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
        if (!interactedNode)
            continue;
        index = player.visitedLogs.indexOf(visitedLogsGraph);
        if (index === -1)
            continue;
        inspectedTree = player.visitedLogs[index];
        break;
    }
    if (!inspectedTree)
        return;
    console.warn("BEFORE: ", inspectedTree.visitedLogs.source.getSize());
    inspectedTree.visitedLogs.source.removeNode(location);
    console.warn("AFTER: ", inspectedTree.visitedLogs.source.getSize(), player.visitedLogs[index].visitedLogs.source.getSize());
    inspectedTree.visitedLogs.source.traverse({ x: -3124, y: 63, z: 1750 }, "BFS", (node) => {
        if (node) {
            console.warn(JSON.stringify(node.location));
        }
    });
});
world.afterEvents.playerSpawn.subscribe((e) => {
    if (!e.initialSpawn)
        return;
    if (!serverConfigurationCopy.ShowMessageUponJoin.defaultValue)
        return;
    SendMessageTo(e.player, {
        rawtext: [
            {
                translate: "LumberAxe.on_load_message"
            }
        ]
    });
});
world.afterEvents.playerLeave.subscribe((e) => {
    playerInteractionMap.set(e.playerId, false);
});
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.sourceType !== ScriptEventSource.Entity)
        return;
    if (!(event.sourceEntity instanceof Player))
        return;
    if (event.id !== ADDON_IDENTIFIER)
        return;
    const player = event.sourceEntity;
    const message = event.message;
    const args = message.trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();
    system.run(async () => {
        try {
            const { default: CommandObject } = await import(`./commands/${cmd}.js`);
            CommandObject.execute(player, args);
        }
        catch (err) {
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
            }
            else {
                Logger.error(err, err.stack);
            }
        }
    });
});
