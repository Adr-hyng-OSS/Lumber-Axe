import { Block, Player, system } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, FormCancelationReason } from "@minecraft/server-ui";

// Calculates the amount of items to be dropped in each stack. O(1)
function stackDistribution(number: number, groupSize: number = 64): Array<number> {
  // Author: Adr-hyng <https://github.com/Adr-hyng>
  // Project: https://github.com/Adr-hyng-OSS/Lumber-Axe
  const fullGroupsCount = Math.floor(number / groupSize);
  const remainder = number % groupSize;
  // Create an array with the size of each full group
  const groups: number[] = new Array(fullGroupsCount).fill(groupSize);
  // If there's a remainder, add it as the last group
  if (remainder > 0) {
      groups.push(remainder);
  }

  return groups;
}

export const deepCopy = <T, U = T extends Array<infer V> ? V : never>(source: T): T => {
  if (Array.isArray(source)) {
    return source.map(item => deepCopy(item)) as T & U[];
  }
  if (source instanceof Date) {
    return new Date(source.getTime()) as T & Date;
  }
  if (source && typeof source === 'object') {
    return (Object.getOwnPropertyNames(source) as (keyof T)[]).reduce<T>((o, prop) => {
      Object.defineProperty(o, prop, Object.getOwnPropertyDescriptor(source, prop)!);
      o[prop] = deepCopy(source[prop]);
      return o;
    }, Object.create(Object.getPrototypeOf(source))) as T;
  }
  return source;
};


function runJob(callback, finishCallBack? ): number {
  return system.runJob( (function* (){
    yield* callback;
    if(finishCallBack) yield* finishCallBack;
  })() );
}

function BlockToLocations(blocks: Array<Block>): Set<string> {
  return new Set(blocks.map(block => JSON.stringify(block.location)));
}

async function forceShow(player: Player, form: ActionFormData, timeout: number = Infinity): Promise<ActionFormResponse> {
  // Script example for ScriptAPI
  // Author: Jayly#1397 <Jayly Discord>
  //         Worldwidebrine#9037 <Bedrock Add-Ons>
  // Project: https://github.com/JaylyDev/ScriptAPI
  const startTick: number = system.currentTick;
  while ((system.currentTick - startTick) < timeout) {
      const response: ActionFormResponse = await (form.show(player)).catch(er=>console.error(er,er.stack)) as ActionFormResponse;
      if (response.cancelationReason !== FormCancelationReason.UserBusy) {
          return response;
      }
  };
  throw new Error(`Timed out after ${timeout} ticks`);
}

export {stackDistribution, forceShow, runJob, BlockToLocations}
