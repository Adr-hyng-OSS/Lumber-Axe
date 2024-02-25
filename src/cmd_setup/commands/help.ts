import { Player } from '@minecraft/server';
import { CommandRegistry } from 'cmd_setup/handler';
import { CommandHandler, ICommandBase, ChatEventType } from 'cmd_setup/setup';

const details = {
    __name__: `help ${CommandHandler.addon}`,
    __description__: 'Displays the help message.',
    __format__: `[<commandName: string>?]`,
}

export const command: ICommandBase = {
    name: details.__name__,
    description: details.__description__,
    format: details.__format__,
    usage(): string {
        return (`Format:
        > ${CommandHandler.prefix}${this.name} ${this.format}
        Usage:
        > ${CommandHandler.prefix}${this.name}
        > ${CommandHandler.prefix}${this.name} config
        `).replaceAll("        ", "");
    },
    execute(chat: ChatEventType, player: Player, args: string[]) {
        const commands: Map<string, ICommandBase> = CommandRegistry;
        if (!args || args.length === 0) return;
        if(!args.includes(CommandHandler.addon.id)) return;
        if (args.length === 1) {
            let helpMessage: string = `\n§aCommands available @ ${CommandHandler.addon.name}: \n`;
            for (let [key, importedCommand] of commands.entries()) {
                if(key === details.__name__) {
                    helpMessage += `§e${CommandHandler.prefix}${details.__name__}§r${details.__format__.length ? " " + details.__format__ : ""} - ${details.__description__}\n`;
                    continue;
                }
                helpMessage += `§e${CommandHandler.prefix}${importedCommand.name}§r${importedCommand.format.length ? " " + importedCommand.format : ""} - ${importedCommand.description}\n`;
            }
            player.sendMessage(helpMessage);
        } else if (args.length >= 2) {
            const specifiedCommand = args[1].toLowerCase();
            if (commands.has(specifiedCommand)) {
                const importedCommand: ICommandBase = commands.get(specifiedCommand);
                player.sendMessage(`\n§e${CommandHandler.prefix}${importedCommand.name}: \n${importedCommand.description}§r ${importedCommand.usage()}`);
            } else {
                player.sendMessage(`§cInvalid command specified: ${specifiedCommand}`);
            }
        }
    }
}