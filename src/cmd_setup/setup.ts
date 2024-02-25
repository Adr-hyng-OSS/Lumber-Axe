import { ChatSendBeforeEvent, ChatSendAfterEvent, Player } from "@minecraft/server";

class CommandFormat {
  id: string;
  name: string;
  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  toString() {
    return this.id;
  }
}

export interface ICommandHandler {
  addon: CommandFormat,
  prefix: string
}

export type ChatEventType = ChatSendBeforeEvent | ChatSendAfterEvent;
export interface ICommandBase {
  name: string,
  description: string,
  format: string,
  usage(): string,
  execute(chat: ChatEventType, player: Player, args: string[]): void | Promise<void>;
}

export const CommandHandler: ICommandHandler = {
  addon: new CommandFormat("lumaxe", "Lumber Axe"),
  prefix: "-",
};