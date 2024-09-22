import { system } from "@minecraft/server";
import { CommandHandler } from "commands/command_handler";
import { ICommandBase} from "./ICommandBase";
import { SendMessageTo } from "utils/utilities";
import "classes/player";

enum REQUIRED_PARAMETER {
    SHOW = "show",
    RESET = "reset"
}
enum OPTIONAL_PARAMETER {
    CLIENT = "client",
    SERVER = "server"
}

const command: ICommandBase = {
    name: 'config',
    description: 'Show or reset configuration settings.',
    format: `[${Object.values(REQUIRED_PARAMETER).join('|')}] [<${Object.values(OPTIONAL_PARAMETER).join('|')}>?]`,
    usage() {
    return (`
        Format:
        > ${CommandHandler.prefix}${this.name} ${this.format}
        Usage:
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.SHOW} = Shows config
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.RESET} ${OPTIONAL_PARAMETER.CLIENT} = Reset caller client config
        > ${CommandHandler.prefix}${this.name} ${REQUIRED_PARAMETER.RESET} ${OPTIONAL_PARAMETER.SERVER} = Reset world server config (Admin)
        `).replaceAll("        ", "");
    },
    async execute(player, args) {
        if (args && args.length) {
            const requiredParams: string[] = (`[${Object.values(REQUIRED_PARAMETER).join('|')}]`).slice(1, -1).split('|').map(command => command.trim()); 
            const selectedReqParam: string = args[0].toLowerCase();
            const isShow: boolean = REQUIRED_PARAMETER.SHOW === selectedReqParam;
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
            if(isShow) {
                system.run(() => player.configuration.showServerScreen());
            } 
            else {
                const optionalParams: string[] = (`[${Object.values(OPTIONAL_PARAMETER).join('|')}]`).slice(1, -1).split('|').map(command => command.trim());
                const selectedOptParam: string = args[1]?.toLowerCase();
                let shouldResetClient: boolean = OPTIONAL_PARAMETER.CLIENT === selectedOptParam;
                if(!optionalParams.includes(selectedOptParam)) shouldResetClient = true; 
                if(shouldResetClient) player.configuration.reset("CLIENT");
            }
        } 
    }
};

export default command