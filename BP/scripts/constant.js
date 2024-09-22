import { JsonDatabase } from "./utils/Database/con-database";
import { MyCustomItemTypes } from 'items/CustomItemTypes';
import { system } from "@minecraft/server";
export const ADDON_NAMESPACE = "yn";
export const ADDON_NAME = "Lumber_Axe";
export const ADDON_IDENTIFIER = `${ADDON_NAMESPACE}:lumber`;
export let originalDatabase = new JsonDatabase(ADDON_NAME);
export const resetOriginalDatabase = () => {
    originalDatabase = new JsonDatabase(ADDON_NAME);
};
export const playerInteractedTimeLogMap = new Map();
export const axeEquipments = Object.values(MyCustomItemTypes);
export const visitedLogs = [];
export function resetOutlinedTrees(result, instantDespawn = false) {
    if (result.isDone)
        return;
    result.isDone = true;
    if (!instantDespawn)
        visitedLogs?.shift();
    const t = system.runJob((function* () {
        for (const blockOutline of result.visitedLogs.blockOutlines) {
            if (blockOutline?.isValid()) {
                blockOutline.triggerEvent('despawn');
            }
            yield;
        }
        system.clearJob(t);
    })());
}
