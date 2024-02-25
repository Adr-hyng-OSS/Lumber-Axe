import { command as HelpCommand } from "./commands/help";
import { command as ConfigCommand } from "./commands/config";
import { command as DatabaseCommand } from "./commands/database";
import { ICommandBase } from "./setup";
// Credits to: https://github.com/RohanDaCoder/CommandHandler


export const CommandRegistry: Map<string, ICommandBase> = new Map<string, ICommandBase>([
  ["help", HelpCommand],
  ["config", ConfigCommand],
  ["database", DatabaseCommand],
]);