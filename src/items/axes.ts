import { Block, BlockPermutation, Entity, EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, InteractedTreeResult, isLogIncluded, playerInteractedTimeLogMap, serverConfigurationCopy, stackDistribution, VisitedBlockResult } from "index"
import { MinecraftBlockTypes, MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Logger } from "utils/logger";

import "classes/player";
import { Graph } from "utils/graph";

// Caching for Cutted Inspected Logs should be for next update.
// Currently Graph is not storing its references to other branches of their neighbors.

// To improve:
// Currently the approach, i have used is when it's not in the same neighbor from the blockLocation of initial inspection, then just run FloodFillSearch
// Just make it like since it is a graph, whenever a portion of branch is being chopped, you can see still view the graph, and it's possible connections or branches
// meanwhile the untracked branches should like if it's being reset, just run the FloodFillSearch. 
// This approach, makes that it just uses 1 FloodFillSearch for each tree, either small or big.
// Like when it is big, then somehow, it is being cutted by chunks, you can still have the reference on the branches this specific point has.
const blockOutlinesDespawnTimer = 10;

world.beforeEvents.worldInitialize.subscribe((registry) => {
  registry.itemComponentRegistry.registerCustomComponent('yn:tool_durability', {
    onHitEntity(arg) {
      if(!(arg.attackingEntity instanceof Player)) return;
      const player: Player = arg.attackingEntity;
      if(!player.isSurvival()) return;
      const axe = (player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent);
      axe.damageDurability(1);
    },
    async onMineBlock(arg) {
        if(!(arg.source instanceof Player)) return;
        const player: Player = arg.source;
        const axe = (player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent);
        const dimension = player.dimension;
        const blockInteracted = arg.block;
        const location = blockInteracted.location;
        const currentHeldAxe = arg.itemStack;
        const currentBreakBlock: BlockPermutation = arg.minedBlockPermutation;
        const blockTypeId: string = currentBreakBlock.type.id;
        if(!player.isSurvival()) return;
        if (!isLogIncluded(blockTypeId)) {
            axe.damageDurability(1);
            return;
        }
        const equipment = player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent;
        currentHeldAxe.lockMode = ItemLockMode.slot;

        const itemDurability: ItemDurabilityComponent = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId) as ItemDurabilityComponent;
        const enchantments: ItemEnchantableComponent = (currentHeldAxe.getComponent(ItemEnchantableComponent.componentId) as ItemEnchantableComponent);
        const level: number = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
        const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
        const unbreakingDamage: number = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
        
        const blockOutline = player.dimension.getEntities({
            closest: 1, 
            maxDistance: 1, 
            type: "yn:block_outline", 
            location: blockInteracted.bottomCenter()
        })[0];
        let visited: Graph;
        let inspectedTree: InteractedTreeResult;
        if(blockOutline) {
            for(const visitedLogsGraph of player.visitedLogs) {
                const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                if(!interactedNode) continue; 
                const index = player.visitedLogs.indexOf(visitedLogsGraph);
                if(index === -1) continue;
                inspectedTree = player.visitedLogs[index];
                break;
            }
            if(!inspectedTree) return;
            visited = inspectedTree.visitedLogs.source;
        } else {
            visited = (await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage, true) as VisitedBlockResult).source;
        }
        if(!visited) return;
        const size = visited.getSize();
        const totalDamage: number = size * unbreakingDamage;
        const postDamagedDurability: number = itemDurability.damage + totalDamage;
    
        if (postDamagedDurability + 1 === itemDurability.maxDurability) {
            equipment.setEquipment(EquipmentSlot.Mainhand, undefined);
        } else if (postDamagedDurability > itemDurability.maxDurability) {
            currentHeldAxe.lockMode = ItemLockMode.none;
            return;
        } else if (postDamagedDurability < itemDurability.maxDurability){
            itemDurability.damage = itemDurability.damage +  totalDamage;
            currentHeldAxe.lockMode = ItemLockMode.none;
            equipment.setEquipment(EquipmentSlot.Mainhand, currentHeldAxe.clone());
        }

        if(inspectedTree) player.visitedLogs.splice(player.visitedLogs.indexOf(inspectedTree));
        //! Use this when fillBlocks is in stable. (Not applicable but can be good to be refactored to graph-based)
        // for (const group of groupAdjacentBlocks(visited)) {
        //     const firstElement = JSON.parse(group[0]);
        //     const lastElement = JSON.parse(group[group.length - 1]);
        //     if (firstElement === lastElement) {
        //         dimension.getBlock(firstElement).setType(MinecraftBlockTypes.Air);
        //         continue;
        //     } else {
        //         dimension.fillBlocks(firstElement, lastElement, MinecraftBlockTypes.Air);
        //     }
        // }

        visited.bfs(location, (node) => {
            system.run(() => dimension.setBlockType(node.location, MinecraftBlockTypes.Air));
        });

        system.runTimeout( () => {
            for (const group of stackDistribution(size)) {
                system.run(() => dimension.spawnItem(new ItemStack(blockTypeId, group), location));
            }
        }, 5);
    },
    onUseOn(arg) {
        const currentHeldAxe: ItemStack = arg.itemStack;
        const blockInteracted: Block = arg.block;
        const player: Player = arg.source as Player;
        if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId)) return;
        const oldLog = playerInteractedTimeLogMap.get(player.id);
        playerInteractedTimeLogMap.set(player.id, system.currentTick);
        if ((oldLog + 2) >= system.currentTick) return;
        const itemDurability: ItemDurabilityComponent = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId) as ItemDurabilityComponent;
        const enchantments: ItemEnchantableComponent = (currentHeldAxe.getComponent(ItemEnchantableComponent.componentId) as ItemEnchantableComponent);
        const level: number = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
        const currentDurability = itemDurability.damage;
        const maxDurability = itemDurability.maxDurability;
        const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
        const unbreakingDamage: number = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
        const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;

        const blockOutline = player.dimension.getEntities({closest: 1, maxDistance: 1, type: "yn:block_outline", location: blockInteracted.bottomCenter()})[0];
        
        try {
            system.run(async () => {
                if(blockOutline?.isValid()) {
                    let size = 0;
                    let inspectedTree: InteractedTreeResult;
                    for(const visitedLogsGraph of player.visitedLogs) {
                        const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                        if(!interactedNode) continue; 
                        const index = player.visitedLogs.indexOf(visitedLogsGraph);
                        if(index === -1) continue;
                        inspectedTree = player.visitedLogs[index];
                        break;
                    }
                    if(!inspectedTree) return;
                    for(const blockOutline of inspectedTree.visitedLogs.blockOutlines) {
                        if(blockOutline?.isValid()) {
                            blockOutline.setProperty('yn:stay_persistent', true);
                            continue;
                        }
                        let {x, y, z} = blockOutline.lastLocation;
                        x -= 0.5;
                        z -= 0.5;
                        inspectedTree.visitedLogs.source.removeNode({x, y, z});
                    }
        
                    let isInSameNeighbor = false;
                    inspectedTree.visitedLogs.source.dfsIterative(blockInteracted.location, (node) => {
                        const inspectedNode = inspectedTree.visitedLogs.source.getNode(inspectedTree.initialInteraction);
                        if(inspectedNode){
                            if(node.neighbors.has(inspectedNode)) isInSameNeighbor = true;
                        }
                        if(node) size++;
                    });
                    if(!isInSameNeighbor) {
                        const treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs, false);
                        const result: InteractedTreeResult = {initialInteraction: blockInteracted.location, visitedLogs: treeCollectedResult, isBeingInspected: false};
                        player.visitedLogs.push(result);
                        system.runTimeout(() => {
                            resetOutlinedTrees(player, result);
                        }, blockOutlinesDespawnTimer * TicksPerSecond);
                        size = treeCollectedResult.source.getSize();
                    }
                    const totalDamage: number = size * unbreakingDamage;
                    const totalDurabilityConsumed: number = currentDurability + totalDamage;
                    const canBeChopped: boolean = (totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability);
                    const inspectionForm: ActionFormData = new ActionFormData()
                    .title({
                        rawtext: [
                        {
                            translate: "LumberAxe.form.title.text"
                        }
                        ]})
                    .button(
                        {
                            rawtext: [
                            {
                                translate: `LumberAxe.form.treeSizeAbrev.text`
                            },
                            {
                                text: ` ${size !== 0 ? size : 1}${canBeChopped ? "" : "+" } `
                            },
                            {
                                translate: `LumberAxe.form.treeSizeAbrevLogs.text`
                            }
                        ]}, "textures/InfoUI/blocks.png")
                    .button(
                        {
                            rawtext: [
                            {
                                translate: `LumberAxe.form.durabilityAbrev.text`
                            },
                            {
                                text: ` ${currentDurability}`
                            }
                        ]}, "textures/InfoUI/axe_durability.png")
                    .button(
                        {
                            rawtext: [
                            {
                                translate: `LumberAxe.form.maxDurabilityAbrev.text`
                            },
                            {
                                text: ` ${maxDurability}`
                            }
                        ]}, "textures/InfoUI/required_durability.png")
                    .button(
                        {
                            rawtext: [
                            {
                                text: "§l"
                            },
                            {
                                translate: `${canBeChopped ? "LumberAxe.form.canBeChopped.text": "LumberAxe.form.cannotBeChopped.text"}`
                            }
                        ]}, "textures/InfoUI/canBeCut.png");
                    forceShow(player, inspectionForm).then((response: ActionFormResponse) => {
                        if(response.canceled || response.selection === undefined || response.cancelationReason === FormCancelationReason.UserClosed) {
                        for(const blockOutline of inspectedTree.visitedLogs.blockOutlines) {
                            if(!blockOutline?.isValid()) continue;
                            blockOutline.setProperty('yn:stay_persistent', false);
                        }
                        return;
                    }
                    }).catch((error: Error) => {
                        Logger.error("Form Error: ", error, error.stack);
                    });
                } else {
                    const treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1);
                    player.visitedLogs = player.visitedLogs ?? [];
                    const result: InteractedTreeResult = {initialInteraction: blockInteracted.location, visitedLogs: treeCollectedResult, isBeingInspected: false};
                    player.visitedLogs.push(result);
                    system.runTimeout(() => {
                        resetOutlinedTrees(player, result);
                    }, blockOutlinesDespawnTimer * TicksPerSecond);
                }
            });
        } catch (e) {
            console.warn(e, e.stack);
        }
    },
  })
});

function resetOutlinedTrees(player: Player, result: InteractedTreeResult) {
    // Shoud check if "this" tree is being inspected or not.
    let shouldDespawn = false;
    for(const blockOutline of result.visitedLogs.blockOutlines) {
        if(!blockOutline?.isValid()) continue;
        // It should despawn only blockOutlines, when "stay_persistent" property of blockOutline, is false.
        // Else just don't despawn it. Wait when 
        const isPersistent = blockOutline.getProperty('yn:stay_persistent');
        if(isPersistent) continue;
        shouldDespawn = true;
        blockOutline.triggerEvent('despawn');
    }
    if(shouldDespawn) player.visitedLogs.splice(player.visitedLogs.indexOf(result));
}