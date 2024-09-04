import { JsonDatabase } from "./utils/Database/con-database";
import { MyCustomItemTypes } from 'items/CustomItemTypes';

export const ADDON_NAMESPACE: string = "yn"
export const ADDON_NAME: string = "Lumber_Axe";
export const ADDON_IDENTIFIER: string = `${ADDON_NAMESPACE}:lumber`;
export const db = new JsonDatabase(ADDON_NAME);

export const validLogBlocks: RegExp = /(_log|crimson_stem|warped_stem)$/;
export const playerInteractionMap: Map<string, boolean> = new Map();
export const playerInteractedTimeLogMap: Map<string, number> = new Map();
export const axeEquipments: string[] = Object.values(MyCustomItemTypes);

