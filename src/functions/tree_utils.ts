import { Block, Dimension, EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, Player, Vector3, system } from "@minecraft/server";
import { MinecraftBlockTypes, MinecraftEnchantmentTypes } from "../modules/vanilla-types/index";
import { Vector } from "modules/Vector";

import { validLogBlocks, axeEquipments, stackDistribution, SERVER_CONFIGURATION } from "../index";
import { BlockGraph } from "classes/BlockGraph";

//! STOP making including interfaces to compilation.

async function treeCut(player: Player, dimension: Dimension, blockChopped: Block, blockTypeId: string, blocksVisited: BlockGraph): Promise<void> {
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
  const unbreakingDamage: number = SERVER_CONFIGURATION.durabilityDamagePerBlock * unbreakingMultiplier;
  
  let visited: BlockGraph = new BlockGraph();
  let groupedBlocks = [];

  const filteredVisited: BlockGraph = blocksVisited.filter((block) => isLogIncluded(block?.typeId) || Vector.equals(block.location, blockChopped));
  if(filteredVisited.size) {
    visited = filteredVisited;
    visited.locations = new Set( Array.from(visited.traverse(blockChopped, "bfs")).map(block => JSON.stringify(block)) );
  } else {
    visited = await getTreeLogs(dimension, blockChopped, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage)
  }
  const size: number = visited.locations.size - 1;
  
  for (const group of groupAdjacentBlocks( visited.locations )) {
    const firstElement: Vector = JSON.parse(group[0]);
    const lastElement: Vector = JSON.parse(group[group.length - 1]);
    groupedBlocks.push([firstElement, lastElement]);
  }

  const totalDamage: number = size * unbreakingDamage;
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
  let breakBlocksGeneratorID;
  breakBlocksGeneratorID = system.runJob((function*() {
    try {
      for (const group of groupedBlocks) {
        dimension.fillBlocks(group[0], group[group.length - 1], MinecraftBlockTypes.Air);
        yield;
      }
  
      for(const stack of stackDistribution(size)) {
        dimension.spawnItem(new ItemStack(blockTypeId, stack), blockChopped.location);
        yield;
      }
    } catch (error) {
      system.clearJob(breakBlocksGeneratorID)
    }
  })());
}


async function getTreeLogs(dimension: Dimension, blockChopped: Block, blockTypeId: string, maxNeeded: number):Promise<BlockGraph> {
  const visited: BlockGraph = new BlockGraph();
  
  const visitedLocations: Set<string> = new Set();
  
  visited.addVertex(blockChopped);
  visitedLocations.add(JSON.stringify(blockChopped));

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
    let fetchBlockGenerator = getBlockNear(dimension, blockChopped.location);
    let nextIteration = fetchBlockGenerator.next();
    let _block: Block;
    let queue: Vector3[] = [];
    while (!nextIteration.done || queue.length > 0) {
      if (visited.locations.size >= SERVER_CONFIGURATION.chopLimit || visited.locations.size >= maxNeeded) {
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
      const pos: string = JSON.stringify(_block);
      if (visited.locations.has(pos)) continue;
      queue.push(_block.location);
      visited.locations.add(pos);
      const prev = visited.previousVertex; 
      visited.addVertex(_block);
      visited.addEdge(prev, _block)
      yield;
    }
  }

  const t = traverseTree();
  const x = system.runJob(t);
  let awaitResolve: number;
  return new Promise<BlockGraph>((resolve) => {
    awaitResolve = system.runJob((function* () {
      while(!t.next().done) {}
      system.clearJob(awaitResolve);
      system.clearJob(x);
      resolve(visited);
    })());
  });
}

function isLogIncluded(blockTypeId: string): boolean {
  if (SERVER_CONFIGURATION.excludedLog.includes(blockTypeId) || blockTypeId.includes('stripped_')) return false;
  if (SERVER_CONFIGURATION.includedLog.includes(blockTypeId) || validLogBlocks.test(blockTypeId)) return true;
  return false;
}

// Gets all the visited blocks and groups them together.
function groupAdjacentBlocks(visited: Set<string>): string[][] {
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
