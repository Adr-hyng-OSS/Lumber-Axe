import { Block, Dimension, EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, Player, System, Vector, Vector3, system } from "@minecraft/server";
import { MinecraftBlockTypes, MinecraftEnchantmentTypes, MinecraftItemTypes } from "../modules/vanilla-types/index";

import { validLogBlocks, axeEquipments, stackDistribution, durabilityDamagePerBlock, excludedLog, includedLog, chopLimit } from "../index";
// Test 2

async function treeCut(player: Player, dimension: Dimension, location: Vector3, blockTypeId: string): Promise<void> {
  // Modified Version
  // Author: Lete114 <https://github.com/Lete114>
  // Project: https://github.com/mcbe-mods/Cut-tree-one-click

  //! Make Lumberjack (extends Player) Interface i/ class for this
  const equipment = player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent;
  const currentHeldAxe = equipment.getEquipment(EquipmentSlot.Mainhand);
  if (!axeEquipments.includes(currentHeldAxe?.typeId)) return;
  if (!isLogIncluded(blockTypeId)) return;

  if (!player.isSurvival()) return;
  if (player.isSurvival()) currentHeldAxe.lockMode = ItemLockMode.slot;

  //! MAKE THIS D-R-Y
  const itemDurability: ItemDurabilityComponent = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId) as ItemDurabilityComponent;
  const enchantments: ItemEnchantableComponent = (currentHeldAxe.getComponent(ItemEnchantableComponent.componentId));
  const level: number = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
  const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
  const unbreakingDamage: number = durabilityDamagePerBlock * unbreakingMultiplier;
  
  // When done it should return boolean,and distribute.
  const visited: Set<string> = await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage);

  const totalDamage: number = visited.size * unbreakingDamage;
  const postDamagedDurability: number = itemDurability.damage + totalDamage;

  if (postDamagedDurability + 1 === itemDurability.maxDurability) {
    equipment.setEquipment(EquipmentSlot.Mainhand, undefined);
  }
  else if (postDamagedDurability > itemDurability.maxDurability) {
    currentHeldAxe.lockMode = ItemLockMode.none;
    return;
  }
  else if (postDamagedDurability < itemDurability.maxDurability) {
    itemDurability.damage = itemDurability.damage + totalDamage;
    currentHeldAxe.lockMode = ItemLockMode.none;
    equipment.setEquipment(EquipmentSlot.Mainhand, currentHeldAxe.clone());
  }
  const breakBlocksGeneratorID = system.runJob(breakBlocksGenerator());
  function* breakBlocksGenerator(): Generator<void, void, void> {
    try {
      for (const group of groupAdjacentBlocks(visited)) {
        const firstElement = JSON.parse(group[0]);
        const lastElement = JSON.parse(group[group.length - 1]);
        if (firstElement === lastElement) {
          dimension.getBlock(firstElement).setType(MinecraftBlockTypes.Air);
          yield;
          continue;
        } else {
          dimension.fillBlocks(firstElement, lastElement, MinecraftBlockTypes.Air);
          yield;
        }
      }

      for(const stack of stackDistribution(visited.size)) {
        dimension.spawnItem(new ItemStack(blockTypeId, stack), location);
        yield;
      }
    } catch (error) { 
      console.warn(error);
      system.clearJob(breakBlocksGeneratorID); 
    }
  }
}

function isLogIncluded(blockTypeId: string): boolean {
  if (excludedLog.includes(blockTypeId) || blockTypeId.includes('stripped_')) return false;
  if (includedLog.includes(blockTypeId) || validLogBlocks.test(blockTypeId)) return true;
  return false;
}

async function getTreeLogs(dimension: Dimension, location: Vector3, blockTypeId: string, maxNeeded: number):Promise<Set<string>> {
  let visited: Set<string> = new Set<string>();
  const visitedLocations: Set<string> = new Set<string>();
  visitedLocations.add(JSON.stringify(location));

  // Make this a generator, and the traversing also.
  // Make this return a block to while loop of BFS,each iteration.
  function* getBlockNear(dimension: Dimension, location: Vector3, radius: number = 1): Generator<Block, any, void> {
    const originalX: number = location.x;
    const originalY: number = location.y;
    const originalZ: number = location.z;
    for (let x = originalX - radius; x <= originalX + radius; x++) {
      for (let y = originalY - radius; y <= originalY + radius; y++) {
        for (let z = originalZ - radius; z <= originalZ + radius; z++) {
          const newLoc: Vector3 = {x, y, z};
          const parsedLoc: string = JSON.stringify(newLoc);
          if(visitedLocations.has(parsedLoc)) continue;
          visitedLocations.add(parsedLoc);
          const _block: Block = dimension.getBlock(newLoc);
          yield _block;
        }
      }
    }
  }    

  function* traverseTree(): Generator<void, void, void> {
    let fetchBlockGenerator = getBlockNear(dimension, location);
    let nextIteration = fetchBlockGenerator.next();
    let _block: Block;
    let queue: Vector3[] = [];
    while (!nextIteration.done || queue.length > 0) {
      if (visited.size >= chopLimit || visited.size >= maxNeeded) {
        break;
      }
      
      if(nextIteration.done) { 
        const newLoc: Vector3 = queue.shift(); 
        fetchBlockGenerator = getBlockNear(dimension, newLoc);
        nextIteration = fetchBlockGenerator.next();
        _block = nextIteration.value;
        nextIteration = fetchBlockGenerator.next();
      } else {
        _block = nextIteration.value;
        nextIteration = fetchBlockGenerator.next();
      }
      if (!_block?.isValid() || !isLogIncluded(_block?.typeId)) continue;

      if (_block.typeId !== blockTypeId) continue;
      const pos: string = JSON.stringify(_block.location);
      if (visited.has(pos)) continue;
      visited.add(pos);
      queue.push(_block.location);
      yield;
    }
  }
  const t = traverseTree();
  const x = system.runJob(t);
  // It should return after generator is done.
  return await new Promise<Set<string>>((resolve) => {
    const awaitResolve: number = system.runJob((function* () {
      while(!t.next().done) {}
      system.clearJob(awaitResolve);
      resolve(visited);
    })());
  });
}


// Gets all the visited blocks and groups them together.
function groupAdjacentBlocks(visited: Set<string>): string[][] {
  // Author: Adr-hyng <https://github.com/Adr-hyng>
  // Project: https://github.com/Adr-hyng-OSS/Lumber-Axe
  // Convert Set to Array and parse each string to JSON object
  const array = Array.from(visited).map(item => JSON.parse(item));

  // Sort the array based on "x", "z", and "y"
  array.sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y);

  const groups: string[][] = [];
  let currentGroup: string[] = [];

  for (let i = 0; i < array.length; i++) {
    // If it's the first element or "x" and "z" didn't change and "y" difference is less or equal to 2, add it to the current group
    if (i === 0 || (array[i].x === array[i - 1].x && array[i].z === array[i - 1].z && Math.abs(array[i].y - JSON.parse(currentGroup[currentGroup.length - 1]).y) <= 2)) {
      currentGroup.push(JSON.stringify(array[i]));
    } else {
      // Otherwise, add the current group to the groups array and start a new group
      groups.push(currentGroup);
      currentGroup = [JSON.stringify(array[i])];
    }
  }
  // Add the last group to the groups array
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  return groups;
}

export { treeCut, isLogIncluded, getTreeLogs }
