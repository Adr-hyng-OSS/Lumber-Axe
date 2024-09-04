import { JsonDatabase } from "./utils/Database/con-database";
import { MyCustomItemTypes } from 'items/CustomItemTypes';
export const ADDON_NAMESPACE = "yn";
export const ADDON_NAME = "Lumber_Axe";
export const ADDON_IDENTIFIER = `${ADDON_NAMESPACE}:lumber`;
export const db = new JsonDatabase(ADDON_NAME);
export const validLogBlocks = /(_log|crimson_stem|warped_stem)$/;
export const playerInteractionMap = new Map();
export const axeEquipments = Object.values(MyCustomItemTypes);
