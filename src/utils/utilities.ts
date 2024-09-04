import { Player, RawMessage, system } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, FormCancelationReason } from "@minecraft/server-ui";


/**
 * sleep
 * @param {number} ticks Amount of time, in ticks, before the timeouts will be
 * called.
 * @returns {Promise<void>}
 */
export function sleep(ticks: number): Promise<void> {
  // Script example for ScriptAPI
  // Author: stackoverflow <https://stackoverflow.com/a/41957152>
  // Project: https://github.com/JaylyDev/ScriptAPI
  return new Promise((resolve) => {
    system.runTimeout(resolve, ticks);
  });
};

/**
 * Generates a random 16-character UUID.
 * @returns {string} - A 16-character UUID.
*/
export function generateUUID16(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let uuid = '';
  for (let i = 0; i < 16; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    uuid += characters[randomIndex];
  }
  return uuid;
}

/**
 * IDK What to call this, but returns boolean if for every X amount of ticks
 * @param tick Minecraft Ticks
 * @returns 
 */
export function ExecuteAtGivenTick(tick: number) {
  return (system.currentTick % tick) === 0;
}

export function SendMessageTo(executor: Player, rawMessage: RawMessage = { rawtext: [ {text: "Not Implemented Yet"} ] }) {
  const formattedRawMessage = JSON.stringify(rawMessage);
  executor.runCommandAsync(`tellraw ${executor.name} ` + formattedRawMessage);
}

// Calculates the amount of items to be dropped in each stack. O(1)
function stackDistribution(number: number, groupSize: number = 64): number[] {
    // Author: Adr-hyng <https://github.com/Adr-hyng>
    // Project: https://github.com/Adr-hyng-OSS/Lumber-Axe
    const fullGroupsCount = Math.floor(number / groupSize);
    const remainder = number % groupSize;
    // Create an array with the size of each full group
    const groups = new Array(fullGroupsCount).fill(groupSize);
    // If there's a remainder, add it as the last group
    if (remainder > 0) {
        groups.push(remainder);
    }

    return groups;
}

async function forceShow(player: Player, form: ActionFormData, timeout: number = Infinity): Promise<ActionFormResponse> {
    // Script example for ScriptAPI
    // Author: Jayly#1397 <Jayly Discord>
    //         Worldwidebrine#9037 <Bedrock Add-Ons>
    // Project: https://github.com/JaylyDev/ScriptAPI
    const startTick: number = system.currentTick;
    while ((system.currentTick - startTick) < timeout) {
        const response: ActionFormResponse = await (form.show(player)).catch(er=>console.error(er,er.stack)) as ActionFormResponse;
        if (response.cancelationReason !== FormCancelationReason.UserBusy) {
            return response;
        }
    };
    throw new Error(`Timed out after ${timeout} ticks`);
}

export {stackDistribution, forceShow}