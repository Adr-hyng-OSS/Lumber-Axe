export * from './functions/utils';
export * from './functions/tree_utils';
import Configuration from "./config";
const { durabilityDamagePerBlock, chopLimit, includedLog, excludedLog, disableWatchDogTerminateLog } = Configuration;
export { durabilityDamagePerBlock, chopLimit, includedLog, excludedLog, disableWatchDogTerminateLog };
export const validLogBlocks = /(_log|crimson_stem|warped_stem)$/;
export const axeEquipments = ["yn:wooden_lumber_axe", "yn:stone_lumber_axe", "yn:iron_lumber_axe", "yn:diamond_lumber_axe", "yn:golden_lumber_axe", "yn:netherite_lumber_axe"];
