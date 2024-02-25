import { system } from "@minecraft/server";
import { CommandHandler } from "../setup";
import { db } from "index";
var REQUIRED_PARAMETER;
(function (REQUIRED_PARAMETER) {
    REQUIRED_PARAMETER["SHOW"] = "show";
    REQUIRED_PARAMETER["RESET"] = "reset";
})(REQUIRED_PARAMETER || (REQUIRED_PARAMETER = {}));
const details = {
    __name__: `config ${CommandHandler.addon}`,
    __description__: 'Shows Configuration Settings.',
    __format__: `[${Object.values(REQUIRED_PARAMETER).join('|')}]`,
};
export const command = {
    name: details.__name__,
    description: details.__description__,
    format: details.__format__,
    usage() {
        return (`
        Format:
        > ${CommandHandler.prefix}${this.name} ${this.format}
        Usage:
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.SHOW} = Shows config
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.RESET} = Reset Server config
        `).replaceAll("        ", "");
    },
    execute(chat, player, args) {
        if (!args || args.length === 0)
            return;
        if (!args.map(c => c.toLowerCase()).includes(CommandHandler.addon.id))
            return;
        if (args.length === 1) {
            player.sendMessage(`\n§e${CommandHandler.prefix}${details.__name__}: \n${details.__description__}§r ${this.usage()}`);
            return;
        }
        const requiredParams = (`[${Object.values(REQUIRED_PARAMETER).join('|')}]`).slice(1, -1).split('|').map(command => command.trim());
        const selectedReqParam = args[1].toLowerCase();
        const isShow = REQUIRED_PARAMETER.SHOW === selectedReqParam;
        if (!requiredParams.includes(selectedReqParam))
            return;
        if (isShow) {
            player.sendMessage(`Configuration: Please close chat screen immediately to open configuration.`);
            system.run(() => player.Configuration.showMainScreen());
        }
        else {
            player.Configuration.reset(true);
            db.delete(player.Configuration.id);
            player.sendMessage(`Server Settings successfully reset.`);
        }
    }
};
