import { command as HelpCommand } from "./commands/help";
import { command as ConfigCommand } from "./commands/config";
import { command as DatabaseCommand } from "./commands/database";
export const CommandRegistry = new Map([
    ["help", HelpCommand],
    ["config", ConfigCommand],
    ["database", DatabaseCommand],
]);
