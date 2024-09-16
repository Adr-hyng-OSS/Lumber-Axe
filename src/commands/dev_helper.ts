import { EntityComponentTypes, EntityInventoryComponent, ItemStack, MolangVariableMap } from "@minecraft/server";
import { CommandHandler } from "commands/command_handler";
import { ICommandBase} from "./ICommandBase";
import { SendMessageTo} from "utils/utilities";
import { axeEquipments } from "constant";

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
                const molangVariable = new MolangVariableMap();
                molangVariable.setFloat('radius', 1);
                molangVariable.setFloat('depth', -5);
                molangVariable.setColorRGB('color', {red: 1.0, green: 1.0, blue: 1.0});
                player.dimension.spawnParticle('yn:inspecting_indicator', {x: parseFloat(args[1] + ""), y: parseFloat(args[2] + ""), z: parseFloat(args[3] + "")}, molangVariable);
                // let inspectedTree: InteractedTreeResult;
                // const topMostBlock = player.dimension.getTopmostBlock({x: blockInteracted.x, z: blockInteracted.z});
                // let blockInteracted = player.getBlockFromViewDirection({maxDistance: 50}).block;
                // const topMostBlockRay = player.dimension.getBlockFromRay(blockInteracted.location, {x: 0, y: 1, z: 0}, {
                //     excludeTypes: [
                //         MinecraftBlockTypes.JungleLog.id
                //     ]
                // }) ?? undefined;
                // if(!topMostBlockRay) return;
                // const topMostBlock = topMostBlockRay.block;
                // console.warn("Height: ", (topMostBlock.location.y - blockInteracted.location.y) + 1, "\nID: ", topMostBlock.typeId);
                // const outline = player.dimension.getEntities({closest: 1, maxDistance: 1, type: "yn:block_outline", location: blockInteracted.bottomCenter()})[0];
                // if(!outline?.isValid()) return;
                // outline.playAnimation('animation.block_outline.spawn_particle');
                // if(!player.visitedLogs.length) return;
                // for(const visitedLogsGraph of player.visitedLogs) {
                //     const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                //     if(!interactedNode) continue; 
                //     const index = player.visitedLogs.indexOf(visitedLogsGraph);
                //     console.warn(index);
                //     if(index === -1) continue;
                //     inspectedTree = player.visitedLogs[index];
                //     break;
                // }
                // if(!inspectedTree) return;

                
                // inspectedTree.visitedLogs.source.traverse((blockInteracted.location), "BFS", (node) =>{
                //     console.info(`Root: ${(JSON.stringify(node.location))} ->`);
                //     node.neighbors.forEach((n) => {
                //         console.info(`Neigbor: ${(JSON.stringify(n.location))}`);
                //     });
                //     console.info("\n");
                // });
                break;
            default:
                break;
        }
    }
};
export default command