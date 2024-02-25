import { Player, world } from "@minecraft/server";
import { db, dbName } from "../../index";
import { CommandHandler, ICommandBase, ChatEventType } from "cmd_setup/setup";

enum REQUIRED_PARAMETER {
    SHOW = "show",
    RESET = "reset"
}

const details = {
    __name__: `database ${CommandHandler.addon}`,
    __description__: 'Inspects / Resets a database collection',
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
        > ${CommandHandler.prefix}${this.name} ${CommandHandler.addon.id} ${REQUIRED_PARAMETER.SHOW} = Display database content.
        > ${CommandHandler.prefix}${this.name} ${CommandHandler.addon.id} ${REQUIRED_PARAMETER.RESET} = Reset database content.
        `).replaceAll("        ", "");
    },
    execute(chat: ChatEventType, player: Player, args: string[]) {
        if(!player.isOp()) return;
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
            if(db.size === 0) {
                player.sendMessage(`§4No configuration record found in database.§r`); 
                return;
            }
            let collections: string = "";
            let i = 1;
            for(const key of db.keys()) {
                const t: string[] = (key as string).split("|");
                const player: Player = world.getEntity(t[1]) as Player;
                collections += `${i++}. ${player.nameTag}: ${t[2]}\n`;
            }
            player.sendMessage((`
            Database ID: §e${dbName}§r
            ${collections}
            `).replaceAll("            ", ""));
        } else {
            player.sendMessage(`§aThe database has been reset.§r`);
            db.clear();
            player.Configuration.reset(true);
        }
    }
};