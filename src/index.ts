export * from './functions/utils';
export * from './functions/tree_utils';
export * from './classes/player';
export * from './classes/item_equippable';

import { MyCustomItemTypes } from 'items/CustomItemTypes';
import Configuration from "./config";
const { durabilityDamagePerBlock, chopLimit, includedLog, excludedLog, debug} = Configuration;
export { durabilityDamagePerBlock, chopLimit, includedLog, excludedLog, debug};

export const validLogBlocks: RegExp = /(_log|crimson_stem|warped_stem)$/;

export const logMap: Map<string, number> = new Map<string, number>();
export const playerInteractionMap: Map<string, boolean> = new Map<string, boolean>();
export const axeEquipments: string[] = Object.values(MyCustomItemTypes);