export * from './functions/utils';
export * from './functions/tree_utils';
export * from "./classes/PlayerOverride";
import Configuration from "./config";
import { JsonDatabase } from "./modules/con-database";
export function OverTakes(prototype, object) {
    const prototypeOrigin = Object.setPrototypeOf(Object.defineProperties({}, Object.getOwnPropertyDescriptors(prototype)), Object.getPrototypeOf(prototype));
    Object.setPrototypeOf(object, prototypeOrigin);
    Object.defineProperties(prototype, Object.getOwnPropertyDescriptors(object));
    return prototypeOrigin;
}
export const dbName = "LUMBER_AXE";
export const db = new JsonDatabase(dbName);
export let SERVER_CONFIGURATION = {
    ...Configuration
};
const originalServerConfiguration = JSON.parse(JSON.stringify(Configuration));
export const resetServerConfiguration = () => {
    SERVER_CONFIGURATION = originalServerConfiguration;
};
export const getServerConfiguration = () => SERVER_CONFIGURATION;
export const setServerConfiguration = (newConfig) => SERVER_CONFIGURATION = newConfig;
export const ConfigurationCollections_DB = (player) => `${dbName}|${player.id}|SERVER`;
export const validLogBlocks = /(_log|crimson_stem|warped_stem)$/;
export const axeEquipments = ["yn:wooden_lumber_axe", "yn:stone_lumber_axe", "yn:iron_lumber_axe", "yn:diamond_lumber_axe", "yn:golden_lumber_axe", "yn:netherite_lumber_axe"];
