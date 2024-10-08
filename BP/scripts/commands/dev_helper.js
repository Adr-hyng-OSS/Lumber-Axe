import { EntityComponentTypes, ItemStack } from "@minecraft/server";
import { CommandHandler } from "commands/command_handler";
import { SendMessageTo } from "utils/utilities";
import { axeEquipments, originalDatabase, resetOriginalDatabase, visitedLogs } from "constant";
var REQUIRED_PARAMETER;
(function (REQUIRED_PARAMETER) {
    REQUIRED_PARAMETER["GET"] = "get";
    REQUIRED_PARAMETER["TEST"] = "test";
    REQUIRED_PARAMETER["RELOAD"] = "reload";
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
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.RELOAD} = Reloads the addon.
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
export default command;
