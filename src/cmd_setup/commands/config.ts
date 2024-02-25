import { Player, system } from "@minecraft/server";
import { ChatEventType, CommandHandler, ICommandBase } from "../setup";
import { db } from "index";


enum REQUIRED_PARAMETER {
    SHOW = "show",
    RESET = "reset"
}

const details = {
    __name__: `config ${CommandHandler.addon}`,
    __description__: 'Shows Configuration Settings.',
    __format__: `[${Object.values(REQUIRED_PARAMETER).join('|')}]`,
}
export const command: ICommandBase = {
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
    execute(chat: ChatEventType, player: Player, args: string[]) {
        if (!args || args.length === 0) return;
        if(!args.map(c => c.toLowerCase()).includes(CommandHandler.addon.id)) return;
        if(args.length === 1) {
            player.sendMessage(`\n§e${CommandHandler.prefix}${details.__name__}: \n${details.__description__}§r ${this.usage()}`);
            return;
        }
        const requiredParams: string[] = (`[${Object.values(REQUIRED_PARAMETER).join('|')}]`).slice(1, -1).split('|').map(command => command.trim()); 
        const selectedReqParam: string = args[1].toLowerCase();
        const isShow: boolean = REQUIRED_PARAMETER.SHOW === selectedReqParam;
        if(!requiredParams.includes(selectedReqParam)) return;
        if(isShow) {
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
