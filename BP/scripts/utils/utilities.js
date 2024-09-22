import { system } from "@minecraft/server";
import { FormCancelationReason } from "@minecraft/server-ui";
export function sleep(ticks) {
    return new Promise((resolve) => {
        system.runTimeout(resolve, ticks);
    });
}
;
export function generateUUID16() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let uuid = '';
    for (let i = 0; i < 16; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        uuid += characters[randomIndex];
    }
    return uuid;
}
export function ExecuteAtGivenTick(tick) {
    return (system.currentTick % tick) === 0;
}
export function SendMessageTo(executor, rawMessage = { rawtext: [{ text: "Not Implemented Yet" }] }) {
    const formattedRawMessage = JSON.stringify(rawMessage);
    executor.runCommandAsync(`tellraw ${executor.name} ` + formattedRawMessage);
}
function stackDistribution(number, groupSize = 64) {
    const fullGroupsCount = Math.floor(number / groupSize);
    const remainder = number % groupSize;
    const groups = new Array(fullGroupsCount).fill(groupSize);
    if (remainder > 0) {
        groups.push(remainder);
    }
    return groups;
}
export function hashBlock(block) {
    const inputString = `${block.dimension.id}_${block.x}-${block.y}-${block.z}`;
    let hash = 5381;
    for (let i = 0; i < inputString.length; i++) {
        hash = (hash * 33) ^ inputString.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
}
async function forceShow(player, form, timeout = Infinity) {
    const startTick = system.currentTick;
    while ((system.currentTick - startTick) < timeout) {
        const response = await (form.show(player)).catch(er => console.error(er, er.stack));
        if (response.cancelationReason !== FormCancelationReason.UserBusy) {
            return response;
        }
    }
    ;
    throw new Error(`Timed out after ${timeout} ticks`);
}
export { stackDistribution, forceShow };
