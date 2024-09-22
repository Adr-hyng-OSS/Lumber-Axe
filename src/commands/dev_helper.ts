import { EntityComponentTypes, EntityInventoryComponent, ItemStack, MolangVariableMap } from "@minecraft/server";
import { CommandHandler } from "commands/command_handler";
import { ICommandBase} from "./ICommandBase";
import { SendMessageTo} from "utils/utilities";
import { axeEquipments, originalDatabase, resetOriginalDatabase, visitedLogs } from "constant";

// Automate this, the values should be the description.
enum REQUIRED_PARAMETER {
    GET = "get",
    TEST = "test",
    RELOAD = "reload",
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
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.RELOAD} = Reloads the addon.
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
                console.warn(originalDatabase.size, visitedLogs.length);
                break;
            case REQUIRED_PARAMETER.RELOAD:
                originalDatabase.clear();
                resetOriginalDatabase();
                console.warn(originalDatabase.isValid(), originalDatabase.size);
                break;
            default:
                break;
        }
    }
};
export default command