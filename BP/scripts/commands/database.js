import { world } from "@minecraft/server";
import { CommandHandler } from "commands/command_handler";
import { originalDatabase, ADDON_NAME } from "constant";
import { SendMessageTo } from "utils/utilities";
var REQUIRED_PARAMETER;
(function (REQUIRED_PARAMETER) {
    REQUIRED_PARAMETER["SHOW"] = "show";
    REQUIRED_PARAMETER["RESET"] = "reset";
})(REQUIRED_PARAMETER || (REQUIRED_PARAMETER = {}));
const command = {
    name: 'database',
    description: 'Inspect or reset a database.',
    format: `[${Object.values(REQUIRED_PARAMETER).join('|')}]`,
    usage() {
        return (`
        Format:
        > ${CommandHandler.prefix}${this.name} ${this.format}
        Usage:
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.SHOW} = Display database content.
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.RESET} = Reset database content.
        `).replaceAll("        ", "");
    },
    execute(player, args) {
        if (args && args.length) {
            const requiredParams = (`[${Object.values(REQUIRED_PARAMETER).join('|')}]`).slice(1, -1).split('|').map(command => command.trim());
            const selectedReqParam = args[0].toLowerCase();
            const isShow = REQUIRED_PARAMETER.SHOW === selectedReqParam;
            if (!requiredParams.includes(selectedReqParam))
                return SendMessageTo(player, {
                    rawtext: [
                        {
                            translate: "LumberAxe.on_caught_invalid_command",
                            with: [command.usage()]
                        },
                    ]
                });
            if (isShow) {
                if (originalDatabase.size === 0)
                    return SendMessageTo(player, {
                        rawtext: [
                            {
                                translate: "LumberAxe.on_database_empty"
                            },
                        ]
                    });
                let collections = "";
                let i = 1;
                for (const key of originalDatabase.keys()) {
                    const t = key.split("|");
                    const player = world.getEntity(t[1]);
                    collections += `${i++}. ${player.nameTag}: ${JSON.stringify(t)}\n`;
                }
                SendMessageTo(player, {
                    rawtext: [
                        {
                            translate: "LumberAxe.show_database",
                            with: [ADDON_NAME, "\n", collections]
                        },
                    ]
                });
            }
            else {
                SendMessageTo(player, {
                    rawtext: [
                        {
                            translate: "LumberAxe.on_database_reset"
                        },
                    ]
                });
                player.configuration.reset("CLIENT");
                player.configuration.reset("SERVER");
                originalDatabase.clear();
                if (!originalDatabase.isDisposed)
                    originalDatabase.dispose();
            }
        }
    }
};
export default command;