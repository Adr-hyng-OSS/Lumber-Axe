import { Entity, Vector3 } from '@minecraft/server';
import { Graph } from 'utils/graph';

export * from './utils/utilities';
export * from './functions/tree_utils';
export * from './classes/player';
export * from './classes/entity_override';
export * from './classes/item_equippable';

export * from "configuration/server_configuration";
export * from "constant";
export * from "items/axes";

export type VisitedBlockResult = {
  source: Graph;
  blockOutlines: Entity[];
}

export type InteractedTreeResult = {
  visitedLogs: VisitedBlockResult;
  isDone: boolean;
}
