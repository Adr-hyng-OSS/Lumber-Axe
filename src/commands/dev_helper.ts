import { EntityComponentTypes, EntityInventoryComponent, ItemStack } from "@minecraft/server";
import { CommandHandler } from "commands/command_handler";
import { ICommandBase} from "./ICommandBase";
import { SendMessageTo} from "utils/utilities";
import { axeEquipments } from "constant";
import { InteractedTreeResult } from "index";
import { Logger } from "utils/logger";
import { OverTakes } from "classes/partial_overtakes";

// Automate this, the values should be the description.
enum REQUIRED_PARAMETER {
    GET = "get",
    TEST = "test",
}

const command: ICommandBase = {
    name: 'dev_helper',
    description: 'Developer Utility Command',
    format: `[${Object.values(REQUIRED_PARAMETER).join('|')}]`,
    usage() {
        //? It should be Automatic
        return (`
        Format:
        > ${CommandHandler.prefix}${this.name} ${this.format}
        Usage:
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.GET} = GETS an enchanted fishing rod for development.
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.TEST} = TEST a Working-in-progress features.
        `).replaceAll("        ", "");
    },
    execute(player, args) {
        if (!(args && args.length)) return;
        const requiredParams: string[] = (`[${Object.values(REQUIRED_PARAMETER).join('|')}]`).slice(1, -1).split('|').map(command => command.trim()); 
        const selectedReqParam: string = args[0].toLowerCase();
        if(!requiredParams.includes(selectedReqParam)) return SendMessageTo(
            player, {
                rawtext: [
                    {
                        translate: "LumberAxe.on_caught_invalid_command",
                        with: [command.usage()]   
                    },
                ]
            }
        );
        switch(selectedReqParam) {
            case REQUIRED_PARAMETER.GET:
                for(const axe of axeEquipments) {
                  (player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent).container.addItem(new ItemStack(axe, 1));
                }
                break;
            case REQUIRED_PARAMETER.TEST:

                // Need to check if this neighbor is a neighbor from another node.
                let inspectedTree: InteractedTreeResult;
                let blockInteracted = player.getBlockFromViewDirection({maxDistance: 50}).block;
                // if(!player.visitedLogs.length) return;
                // for(const visitedLogsGraph of player.visitedLogs) {
                //     const interactedNode = visitedLogsGraph.InteractedVisitedBlocks.graph.getNode(blockInteracted.location);
                //     if(!interactedNode) continue; 
                //     const index = player.visitedLogs.indexOf(visitedLogsGraph);
                //     console.warn(index);
                //     if(index === -1) continue;
                //     inspectedTree = player.visitedLogs[index];
                //     break;
                // }
                const outline = player.dimension.getEntities({closest: 1, maxDistance: 1, type: "yn:block_outline", location: blockInteracted.bottomCenter()})[0]
                console.warn("PRE': ", outline.getProperty("yn:stay_persistent"));
                outline.setProperty("yn:stay_persistent", !outline.getProperty("yn:stay_persistent"));
                console.warn("POST: ", outline.getProperty("yn:stay_persistent"));
                if(!inspectedTree) return;

                
                break;
            default:
                break;
        }
    }
};
export default command