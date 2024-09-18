import { world, PlayerLeaveAfterEvent, ScriptEventCommandMessageAfterEvent, system, ScriptEventSource, Player, BlockPermutation, EntityEquippableComponent, EntityInventoryComponent, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, MolangVariableMap, PlayerBreakBlockBeforeEvent, Block, VectorXZ, TicksPerSecond, ItemCooldownComponent } from '@minecraft/server';
import { ADDON_IDENTIFIER, axeEquipments, getTreeLogs, getTreeTrunkSize, InteractedTreeResult, isLogIncluded, playerInteractedTimeLogMap, playerInteractionMap, resetOutlinedTrees, SendMessageTo, serverConfigurationCopy, stackDistribution, VisitedBlockResult, visitedLogs} from "./index"
import { Logger } from 'utils/logger';
import './items/axes';
import { MinecraftEnchantmentTypes, MinecraftBlockTypes } from 'modules/vanilla-types/index';
import { Graph } from 'utils/graph';
import { Vec3 } from 'utils/VectorUtils';

world.afterEvents.playerSpawn.subscribe((e) => {
    if(!e.initialSpawn) return;
    e.player.configuration.loadServer();
    if(!serverConfigurationCopy.ShowMessageUponJoin.defaultValue) return; 
    SendMessageTo(e.player, {
        rawtext: [
          {
              translate: "LumberAxe.on_load_message"
          }
        ]
    });
});

world.afterEvents.playerLeave.subscribe((e: PlayerLeaveAfterEvent) => {
    playerInteractionMap.set(e.playerId, false);
});

world.beforeEvents.playerBreakBlock.subscribe((arg) => {
  const player: Player = arg.player;
  const axe = (player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent);
  const dimension = player.dimension;
  const blockInteracted = arg.block;
  const location = blockInteracted.location;
  const currentHeldAxe = arg.itemStack;
  const currentHeldAxeSlot = player.selectedSlotIndex;
  const currentBreakBlock: BlockPermutation = arg.block.permutation;
  const blockTypeId: string = currentBreakBlock.type.id;
  if(!axeEquipments.includes(currentHeldAxe.typeId)) return;
  if(!player.isSurvival()) return;
  if (!isLogIncluded(blockTypeId)) {
      system.run(() => axe.damageDurability(1));
      return;
  }
  // /execute positioned ~~~ run fill ~1 ~ ~1 ~-1 ~20 ~-1 jungle_log

  // Getting the cache, if it has, to remove the particle.
  // Filter by getting the graph that has this node.
  const possibleVisitedLogs: {result: InteractedTreeResult, index: number}[] = [];
  for(let i = 0; i < visitedLogs.length; i++) {
      const currentInspectedTree = visitedLogs[i];
      const interactedTreeNode = currentInspectedTree.visitedLogs.source.getNode(blockInteracted);
      if(interactedTreeNode) {
          possibleVisitedLogs.push({result: currentInspectedTree, index: i});
      }
  }

  if(possibleVisitedLogs.length) {
    // After filtering check get that tree that this player has inspected, get the latest one.
    const latestPossibleInspectedTree = possibleVisitedLogs[possibleVisitedLogs.length - 1];
    const index = latestPossibleInspectedTree.index;
    const initialTreeInspection = latestPossibleInspectedTree.result;
    if(initialTreeInspection.isBeingChopped) {
      arg.cancel = true;
      return;
    }
    visitedLogs!.splice(index, 1);
    initialTreeInspection!.isDone = true;
  }
  player.configuration.loadServer();
  system.run(async () => {
    currentHeldAxe.lockMode = ItemLockMode.slot;
    const inventory = (player.getComponent(EntityInventoryComponent.componentId) as EntityInventoryComponent).container;
    inventory.setItem(currentHeldAxeSlot, currentHeldAxe);
    axe.damageDurability(2);
    const itemDurability: ItemDurabilityComponent = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId) as ItemDurabilityComponent;
    const enchantments: ItemEnchantableComponent = (currentHeldAxe.getComponent(ItemEnchantableComponent.componentId) as ItemEnchantableComponent);
    const level: number = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
    const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
    const unbreakingDamage: number = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
    let visited: Graph;
    
    // This should be the temporary container where it doesn't copy the reference from the original player's visitedNodes.
    let destroyedTree :InteractedTreeResult = {
      isBeingChopped: false,
      initialSize: 0,
      isDone: false,
      visitedLogs: {
      blockOutlines: [], 
      source: new Graph(),
      yOffsets: new Map(),
      trunk: {
          center: {
            x: 0, 
            z: 0
          }, 
          size: 0
      }
      }
    };
  
    // (TODO) Use Cache again :,D 
    const molang = new MolangVariableMap();
    let isTreeDoneTraversing = false;
    const brokenTreeTrunk = await getTreeTrunkSize(blockInteracted, blockTypeId);
    const topMostBlock = blockInteracted.dimension.getTopmostBlock(brokenTreeTrunk.center);
    const bottomMostBlock = await new Promise<Block>((getBottomMostBlockResolved) => {
      let _bottom = blockInteracted.below();
      const _t = system.runInterval(() => {
          if(!isLogIncluded(blockInteracted.typeId) || blockInteracted.typeId !== _bottom.typeId) {
            system.clearRun(_t);
            getBottomMostBlockResolved(_bottom);
            return;
          }
          _bottom = _bottom.below();
      });
    });
    const mainTreeTrunkHeight = (topMostBlock.y - bottomMostBlock.y);
    const isValidVerticalTree = mainTreeTrunkHeight > 2;

    const treeDustParseMap = {
      1: 3.25, // 3.25
      2: 4,
      3: 4,
      4: 4,
      5: 7,
      6: 7,
      7: 7,
      8: 7,
      9: 7
    }
    if(isValidVerticalTree) {
      let dustCount = 1.5;
      molang.setFloat('trunk_size', dustCount);
      player.playSound('hit.stem');
      dimension.spawnParticle('yn:tree_dust', {x: brokenTreeTrunk.center.x, y: blockInteracted.y, z: brokenTreeTrunk.center.z}, molang);
      const t = system.runInterval(() => {
        // Get the first block, and based on that it will get the height.
        molang.setFloat('trunk_size', dustCount += 0.25);
        if(isTreeDoneTraversing) {
          system.clearRun(t);
          return;
        };
        player.playSound('hit.stem');
        dimension.spawnParticle('yn:tree_dust', {x: brokenTreeTrunk.center.x, y: blockInteracted.y, z: brokenTreeTrunk.center.z}, molang);
      }, 12);
    }

    const choppedTree = (await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage, false) as VisitedBlockResult);
    isTreeDoneTraversing = true;
    destroyedTree.visitedLogs = choppedTree;
    destroyedTree.isBeingChopped = true;
    visited = choppedTree.source;
    const initialSize = visited.getSize() - 1;
    visitedLogs.push(destroyedTree);
  
    if(!visited) return;
    if(initialSize >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "")) {
      currentHeldAxe.lockMode = ItemLockMode.none;
      inventory.setItem(currentHeldAxeSlot, currentHeldAxe);
      SendMessageTo(player, {rawtext: [{text: "Cannot chop the whole tree due to limitation. "}]});
      return resetOutlinedTrees(destroyedTree);
    }

    const totalDamage: number = initialSize * unbreakingDamage;
    const postDamagedDurability: number = itemDurability.damage + totalDamage;
    if (postDamagedDurability + 1 === itemDurability.maxDurability) {
        player.playSound("random.break");
        inventory.setItem(currentHeldAxeSlot, undefined);
    } else if (postDamagedDurability > itemDurability.maxDurability) {
        currentHeldAxe.lockMode = ItemLockMode.none;
        inventory.setItem(currentHeldAxeSlot, currentHeldAxe);
        return; 
    } else if (postDamagedDurability < itemDurability.maxDurability) {
        itemDurability.damage = itemDurability.damage +  totalDamage;
        const heldTemp = currentHeldAxe.clone();
        heldTemp.lockMode = ItemLockMode.none;
        inventory.setItem(currentHeldAxeSlot, heldTemp);
    }

    // Dust Particle (VFX)
    const trunkYCoordinates = Array.from(destroyedTree.visitedLogs.yOffsets.keys()).sort((a, b) => a - b);
    molang.setFloat('trunk_size', treeDustParseMap[brokenTreeTrunk.size]);
    let currentBlockOffset = 0;
    if(<boolean>serverConfigurationCopy.progressiveChopping.defaultValue && isValidVerticalTree){
      for(const yOffset of trunkYCoordinates) {
        if(currentBlockOffset % 2 === 0) {
          await system.waitTicks(10);
          const loc = {x: destroyedTree.visitedLogs.trunk.center.x, y: yOffset, z: destroyedTree.visitedLogs.trunk.center.z};
          player.playSound('mob.irongolem.crack', {location: loc});
          const molang = new MolangVariableMap();
          molang.setFloat('trunk_size', treeDustParseMap[destroyedTree.visitedLogs.trunk.size]);
          dimension.spawnParticle('yn:tree_dust', loc, molang);
        }
        destroyedTree.visitedLogs.yOffsets.set(yOffset, true);
        currentBlockOffset++;
      }
    }
    const t = system.runJob( (function* () {
      if(!(serverConfigurationCopy.progressiveChopping.defaultValue) && isValidVerticalTree) {
        for(const yOffset of trunkYCoordinates) {
          if(currentBlockOffset % 2 === 0) {
            const molang = new MolangVariableMap();
            molang.setFloat('trunk_size', treeDustParseMap[destroyedTree.visitedLogs.trunk.size]);
            dimension.spawnParticle('yn:tree_dust', {x: destroyedTree.visitedLogs.trunk.center.x, y: yOffset, z: destroyedTree.visitedLogs.trunk.center.z}, molang);
          }
          destroyedTree.visitedLogs.yOffsets.set(yOffset, true);
          currentBlockOffset++;
          yield;
        }
      }
      let size = 1;
      for (const node of destroyedTree.visitedLogs.source.traverseIterative(blockInteracted, "BFS")) {
        if(Vec3.equals(node.block, blockInteracted.location)) continue;
        if (node) {
          // If there's setDestroy that cancels the dropped item, just use that instead of this.
          // Custom Destroy Particle
          if(node.block.typeId === blockTypeId) {
            size++;
            if (
              destroyedTree.visitedLogs.yOffsets.has(node.block.location.y) &&
              destroyedTree.visitedLogs.yOffsets.get(node.block.location.y) && isValidVerticalTree
            ) {
              const blockOutline = destroyedTree.visitedLogs.blockOutlines[node.index];
              if (blockOutline?.isValid()) {
                blockOutline.playAnimation('animation.block_outline.spawn_particle');
                blockOutline.setProperty('yn:trunk_size', destroyedTree.visitedLogs.trunk.size);
                destroyedTree.visitedLogs.yOffsets.set(node.block.location.y, false);
              }
            }
            system.waitTicks(3).then(() => dimension.setBlockType(node.block.location, MinecraftBlockTypes.Air));
          } else {
            destroyedTree.visitedLogs.source.removeNode(node.block);
            break;
          }
        }
        yield;
      }
      player.playSound('dig.cave_vines');

      for (const group of stackDistribution(size)) {
        dimension.spawnItem(new ItemStack(blockTypeId, group), location);
        yield;
      }

      if(!destroyedTree?.isDone) resetOutlinedTrees(destroyedTree);
      system.clearJob(t);
    })());
  });
});

system.afterEvents.scriptEventReceive.subscribe((event: ScriptEventCommandMessageAfterEvent) => {
    if(event.sourceType !== ScriptEventSource.Entity) return;
    if(!(event.sourceEntity instanceof Player)) return;
    if(event.id !== ADDON_IDENTIFIER) return;
    const player = event.sourceEntity as Player;
    const message = event.message;
    const args = message.trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();
    system.run(async () => {
      try {
          const {
            default: CommandObject
          } = await import(`./commands/${cmd}.js`);
          CommandObject.execute(player, args);
      } catch (err) {
        if (err instanceof ReferenceError) {
          SendMessageTo(player, {
            rawtext: [
              {
                translate: "yn:fishing_got_reel.on_caught_main_command_not_found",
                with: [
                  cmd,
                  "\n",
                  ADDON_IDENTIFIER
                ]
              }
            ]
          });
        } else {
          Logger.error(err, err.stack);
        }
      }
    });
});