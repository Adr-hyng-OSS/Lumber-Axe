import { InteractedTreeResult } from "index";
import { JsonDatabase } from "./utils/Database/con-database";
import { MyCustomItemTypes } from 'items/CustomItemTypes';
import { system } from "@minecraft/server";

export const ADDON_NAMESPACE: string = "yn"
export const ADDON_NAME: string = "Lumber_Axe";
export const ADDON_IDENTIFIER: string = `${ADDON_NAMESPACE}:lumber`;
export const db = new JsonDatabase(ADDON_NAME);

export const validLogBlocks: RegExp = /(_log|crimson_stem|warped_stem)$/;
export const playerInteractionMap: Map<string, boolean> = new Map();
export const playerInteractedTimeLogMap: Map<string, number> = new Map();
export const axeEquipments: string[] = Object.values(MyCustomItemTypes);

export const blockOutlinesDespawnTimer = 5;
export const visitedLogs: InteractedTreeResult[] = [];


/**
 * 
 * @param player Player
 * @param result Interacted Tree to despawn the block outlines later.
 * @param instantDespawn To instantly remove the outlines without shifting the visitedLogs.
 * @returns 
 */
export function resetOutlinedTrees(result: InteractedTreeResult, instantDespawn: boolean = false) {
  if(result.isDone) return;    
  result.isDone = true;
  if(!instantDespawn) visitedLogs?.shift();
  const t = system.runJob((function*(){
      for(const blockOutline of result.visitedLogs.blockOutlines) {
          if(blockOutline?.isValid()) {
              blockOutline.triggerEvent('despawn');
          }
          yield;
      }
      system.clearJob(t);
  })());
}