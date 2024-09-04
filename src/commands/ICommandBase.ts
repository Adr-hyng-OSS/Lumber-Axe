import { Player, ScriptEventCommandMessageAfterEvent } from "@minecraft/server";
export interface ICommandBase {
  name: string,
  description: string,
  format: string,
  usage(): string,
  execute(player: Player, args: string[]): void | Promise<void>;
}