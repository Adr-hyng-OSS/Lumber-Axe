import { EntityComponentTypes, ItemStack } from "@minecraft/server";
import { CommandHandler } from "commands/command_handler";
import { SendMessageTo } from "utils/utilities";
import { axeEquipments } from "constant";
import { Vec3 } from "utils/VectorUtils";
var REQUIRED_PARAMETER;
(function (REQUIRED_PARAMETER) {
    REQUIRED_PARAMETER["GET"] = "get";
    REQUIRED_PARAMETER["TEST"] = "test";
})(REQUIRED_PARAMETER || (REQUIRED_PARAMETER = {}));
const command = {
    name: 'dev_helper',
    description: 'Developer Utility Command',
    format: `[${Object.values(REQUIRED_PARAMETER).join('|')}]`,
    usage() {
        return (`
        Format:
        > ${CommandHandler.prefix}${this.name} ${this.format}
        Usage:
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.GET} = GETS an enchanted fishing rod for development.
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.TEST} = TEST a Working-in-progress features.
        `).replaceAll("        ", "");
    },
    execute(player, args) {
        if (!(args && args.length))
            return;
        const requiredParams = (`[${Object.values(REQUIRED_PARAMETER).join('|')}]`).slice(1, -1).split('|').map(command => command.trim());
        const selectedReqParam = args[0].toLowerCase();
        if (!requiredParams.includes(selectedReqParam))
            return SendMessageTo(player, {
                rawtext: [
                    {
                        translate: "LumberAxe.on_caught_invalid_command",
                        with: [command.usage()]
                    },
                ]
            });
        switch (selectedReqParam) {
            case REQUIRED_PARAMETER.GET:
                for (const axe of axeEquipments) {
                    player.getComponent(EntityComponentTypes.Inventory).container.addItem(new ItemStack(axe, 1));
                }
                break;
            case REQUIRED_PARAMETER.TEST:
                let inspectedTree;
                let blockInteracted = player.getBlockFromViewDirection({ maxDistance: 50 }).block;
                if (!player.visitedLogs.length)
                    return;
                for (const visitedLogsGraph of player.visitedLogs) {
                    const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                    if (!interactedNode)
                        continue;
                    const index = player.visitedLogs.indexOf(visitedLogsGraph);
                    console.warn(index);
                    if (index === -1)
                        continue;
                    inspectedTree = player.visitedLogs[index];
                    break;
                }
                if (!inspectedTree)
                    return;
                inspectedTree.visitedLogs.source.traverse((blockInteracted.location), "BFS", (node) => {
                    console.info(`Root: ${(JSON.stringify(node.location))} ->`);
                    node.neighbors.forEach((n) => {
                        const d = Vec3.distance(node.location, n.location);
                        console.info(`Neigbor: ${(JSON.stringify(n.location))}`);
                    });
                    console.info("\n");
                });
                break;
            default:
                break;
        }
    }
};
export default command;
