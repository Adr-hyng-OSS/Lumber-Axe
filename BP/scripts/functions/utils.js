import { system } from "@minecraft/server";
import { FormCancelationReason } from "@minecraft/server-ui";
function stackDistribution(number, groupSize = 64) {
    const fullGroupsCount = Math.floor(number / groupSize);
    const remainder = number % groupSize;
    const groups = new Array(fullGroupsCount).fill(groupSize);
    if (remainder > 0) {
        groups.push(remainder);
    }
    return groups;
}
export const deepCopy = (source) => {
    if (Array.isArray(source)) {
        return source.map(item => deepCopy(item));
    }
    if (source instanceof Date) {
        return new Date(source.getTime());
    }
    if (source && typeof source === 'object') {
        return Object.getOwnPropertyNames(source).reduce((o, prop) => {
            Object.defineProperty(o, prop, Object.getOwnPropertyDescriptor(source, prop));
            o[prop] = deepCopy(source[prop]);
            return o;
        }, Object.create(Object.getPrototypeOf(source)));
    }
    return source;
};
function runJob(callback, finishCallBack) {
    return system.runJob((function* () {
        yield* callback;
        if (finishCallBack)
            yield* finishCallBack;
    })());
}
function BlockToLocations(blocks) {
    return new Set(blocks.map(block => JSON.stringify(block.location)));
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
export { stackDistribution, forceShow, runJob, BlockToLocations };
