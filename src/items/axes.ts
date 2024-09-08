import { Block, BlockPermutation, EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, InteractedTreeResult, isLogIncluded, playerInteractedTimeLogMap, serverConfigurationCopy, stackDistribution, VisitedBlockResult } from "index"
import { MinecraftBlockTypes, MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Logger } from "utils/logger";

import "classes/player";
import { Graph } from "utils/graph";

// Improve in next update using runJob for caching, since caching still gets O(2n).

const blockOutlinesDespawnTimer = 5;

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
        
        // This should be the temporary container where it doesn't copy the reference from the original player's visitedNodes.
        let destroyedTree :InteractedTreeResult = {
            initialSize: 0,
            isDone: false,
            visitedLogs: {
                blockOutlines: [], 
                source: new Graph()
            }
        };
        let size = 0;
        if(blockOutline) {
            // It copies the reference from the array. So, if you change something
            // It changes the array's content also.
            let inspectedTree: InteractedTreeResult; 
            let index = -1;
            for(const visitedLogsGraph of player.visitedLogs) {
                index++;

                // Check if there's existing nodes based on the interacted block, 
                // if there is, then possibly there's already a inspected tree.
                const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);

                // If there is not, then just go next.
                if(!interactedNode) continue; 

                // If there is, then check if this is already done, if it is then go next instance.
                if(visitedLogsGraph.isDone) continue;

                // Removing some duplicates
                const lastIndexOccurence = player.visitedLogs.lastIndexOf(visitedLogsGraph);
                // If the first possible occurence, is not the current index, then go next until it's in the first occurence's position.
                if(lastIndexOccurence === -1) continue;
                if(index !== lastIndexOccurence) continue;

                index = lastIndexOccurence;

                inspectedTree = player.visitedLogs[index];
                break;
            }

            if(!inspectedTree) return;
            destroyedTree.initialSize = inspectedTree.initialSize;
            
            // Copy the inspected trees's content, so it doesn't copy it's reference.
            inspectedTree.visitedLogs.source.traverse(blockInteracted.location, "BFS", (node) => {
                destroyedTree.visitedLogs.blockOutlines.push(inspectedTree.visitedLogs.blockOutlines[node.index])
                destroyedTree.visitedLogs.source.addNode(node);
            });

            // Remove some invalid nodes, and just keep the remaining ones.
            for(const blockOutline of destroyedTree.visitedLogs.blockOutlines) {
                if(blockOutline?.isValid()) continue;
                let {x, y, z} = blockOutline.lastLocation;
                x -= 0.5;
                z -= 0.5;
                destroyedTree.visitedLogs.source.removeNode({x, y, z});
            }

            // Instead of just making it the existing or selected, just traverse first if there's some invalid branch connections.
            const tempResult: VisitedBlockResult = {blockOutlines: [], source: new Graph()};

            // Traverse the first node in graph, for final checking what's the valid ones, and what's remaining.
            destroyedTree.visitedLogs.source.traverse(blockInteracted.location, "BFS", (node) => {
                if(node) {
                    tempResult.blockOutlines.push(destroyedTree.visitedLogs.blockOutlines[node.index]);
                    tempResult.source.addNode(node);
                }
            });
            
            // Remove the already broken block. Don't count that.
            tempResult.source.removeNode(blockOutline.lastLocation);
            destroyedTree.visitedLogs = tempResult;
            visited = tempResult.source;
            size = visited.getSize() - 1;
        } else {
            const choppedTree = (await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage, false) as VisitedBlockResult);
            destroyedTree.visitedLogs.source = choppedTree.source;
            destroyedTree.visitedLogs.blockOutlines = choppedTree.blockOutlines;
            visited = choppedTree.source;
            size = visited.getSize() - 1;
        }
        if(!visited) return;
        if(size <= 0) return;
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

        await (new Promise<void>((resolve) => {
            const t = system.runJob((function*(){
                destroyedTree.visitedLogs.source.traverse(location, "BFS", (node) => {
                    if(node) {
                        const blockOutline = destroyedTree.visitedLogs.blockOutlines[node.index];
                        // system.waitTicks(1).then(()=>blockOutline.playAnimation('animation.block_outline.spawn_particle')); // This doesn't get executed :<<
                        dimension.setBlockType(node.location, MinecraftBlockTypes.Air);
                    }
                });
                system.clearJob(t);
                resolve();
            })());
        })).then(() => {
            resetOutlinedTrees(player, destroyedTree);
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
            for (const group of stackDistribution(size)) {
                system.run(() => dimension.spawnItem(new ItemStack(blockTypeId, group), location));
            }
        }).catch((e) => {
            resetOutlinedTrees(player, destroyedTree);
            console.warn(e, e.stack);
        });
    },
    async onUseOn(arg) {
        const currentHeldAxe: ItemStack = arg.itemStack;
        const blockInteracted: Block = arg.block;
        const player: Player = arg.source as Player;
        if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId)) return;
        const oldLog = playerInteractedTimeLogMap.get(player.id);
        playerInteractedTimeLogMap.set(player.id, system.currentTick);
        if ((oldLog + 5) >= system.currentTick) return;
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
            // Check also, if this tree is already being interacted. By checking this current blockOutline (node), if it's being interacted.
            if(blockOutline?.isValid()) {
                // When the original has still the same size, then just return that.
                let inspectedTree: InteractedTreeResult;
                const tempResult = await new Promise<{result: VisitedBlockResult, index: number}>((inspectTreePromiseResolve) => {
                    const tMain = system.runJob((function*(inspectTreePromiseResolve: (inspectedTreeResult: {result: VisitedBlockResult, index: number} | PromiseLike<{result: VisitedBlockResult, index: number}>) => void){
                        let index = -1;
                        if(!player.visitedLogs) return system.clearJob(tMain);
                        for(const visitedLogsGraph of player.visitedLogs) {
                            index++;
        
                            // Check if there's existing nodes based on the interacted block, 
                            // if there is, then possibly there's already a inspected tree.
                            const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                            // If there is not, then just go next.
                            yield;
                            if(!interactedNode) continue; 
                            
                            // If there is, then check if this is already done, if it is then go next instance.
                            yield;
                            if(visitedLogsGraph.isDone) continue;
                            
                            // Removing some duplicates
                            const lastIndexOccurence = player.visitedLogs.lastIndexOf(visitedLogsGraph);
                            yield;
                            if(lastIndexOccurence === -1) continue;

                            // If the first possible occurence, is not the current index, then go next until it's in the first occurence's position.
                            if(index !== lastIndexOccurence) continue;
                            
                            index = lastIndexOccurence;
        
                            inspectedTree = player.visitedLogs[index];
                            break;
                        }
    
                        if(!inspectedTree) return system.clearJob(tMain);
                        if(inspectedTree.initialSize === inspectedTree.visitedLogs.source.getSize()) {
                            system.clearJob(tMain);
                            inspectTreePromiseResolve({result: inspectedTree.visitedLogs, index: index});
                        }
    
                        // O(n)
                        for(const blockOutline of inspectedTree.visitedLogs.blockOutlines) {
                            if(!blockOutline?.isValid()) {
                                let {x, y, z} = blockOutline.lastLocation;
                                x -= 0.5;
                                z -= 0.5;
                                inspectedTree.visitedLogs.source.removeNode({x, y, z});
                            }
                            yield;
                        }
    
                        const tempResult: VisitedBlockResult = {blockOutlines: [], source: new Graph()};
    
                        // Traverse the interacted block to validate the remaining nodes, if something was removed. O(n)
                        if(inspectedTree.visitedLogs.source.getSize() !== 0) {
                            for(const node of inspectedTree.visitedLogs.source.traverseIterative(blockInteracted.location, "BFS")) {
                                if(node) {
                                    tempResult.blockOutlines.push(inspectedTree.visitedLogs.blockOutlines[node.index]);
                                    tempResult.source.addNode(node);
                                }
                                yield;
                            }
                        } else {
                            // This is for main tree, and subtree conflict bug. :D Just refetch it all over again, but using the cache. 
                            // O(2n)
                            index = -1;
                            if(!player.visitedLogs) return;
                            for(const visitedLogsGraph of player.visitedLogs) {
                                index++;
                                const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                                yield;
                                if(!interactedNode) continue; 
                                yield;
                                if(visitedLogsGraph.isDone) continue;
                                const lastIndexOccurence = player.visitedLogs.lastIndexOf(visitedLogsGraph);
                                yield;
                                if(lastIndexOccurence === -1) continue;
                                if(index !== lastIndexOccurence) continue;
                                index = lastIndexOccurence;
                                inspectedTree = player.visitedLogs[index];
                                break;
                            }
                            if(!inspectedTree) return system.clearJob(tMain);
                            for(const node of inspectedTree.visitedLogs.source.traverseIterative(blockInteracted.location, "BFS")) {
                                if(node) {
                                    tempResult.blockOutlines.push(inspectedTree.visitedLogs.blockOutlines[node.index]);
                                    tempResult.source.addNode(node);
                                } 
                                yield;
                            }
                        }
                        system.clearJob(tMain);
                        inspectTreePromiseResolve({result: tempResult, index: index});
                    })(inspectTreePromiseResolve));
                });

                const newInspectedSubTree: InteractedTreeResult = {
                    initialSize: tempResult.result.source.getSize(),
                    isDone: false, 
                    visitedLogs: tempResult.result
                };
                
                // If it already exists, then just update, else add this new result, since it has changed.
                const currentChangedIndex = player.visitedLogs.findIndex((result) => JSON.stringify(newInspectedSubTree.visitedLogs.source) === JSON.stringify(inspectedTree.visitedLogs.source) && !result.isDone);
                if(currentChangedIndex === -1) {
                    player.visitedLogs.push(newInspectedSubTree);
                    system.waitTicks(blockOutlinesDespawnTimer * TicksPerSecond). then((_) => {
                        if(!player.visitedLogs[tempResult.index]) return;
                        if(!player.visitedLogs[tempResult.index].isDone) resetOutlinedTrees(player, newInspectedSubTree);
                    });
                } else {
                    player.visitedLogs[currentChangedIndex] = newInspectedSubTree;
                }

                const size = tempResult.result.source.getSize();
                const totalDamage: number = size * unbreakingDamage;
                const totalDurabilityConsumed: number = currentDurability + totalDamage;
                const canBeChopped: boolean = (totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability);
                const t = system.runJob((function*(){
                    for(const blockOutline of newInspectedSubTree.visitedLogs.blockOutlines){
                        if(blockOutline?.isValid()) {
                            if(canBeChopped) blockOutline.triggerEvent('is_tree_choppable');
                            else blockOutline.triggerEvent('unchoppable_tree');
                        }
                        yield;
                    }
                    system.clearJob(t);
                })());
                

                // After amount of seconds, make it default.
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
                    const t = system.runJob((function*(){
                        for(const blockOutline of newInspectedSubTree.visitedLogs.blockOutlines){
                            if(blockOutline?.isValid()) blockOutline.triggerEvent('go_default_outline');
                            yield;
                        }
                        system.clearJob(t);
                    })());
                    return;
                }
                }).catch((error: Error) => {
                    Logger.error("Form Error: ", error, error.stack);
                });
            } else {
                const treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1);
                player.visitedLogs = player.visitedLogs ?? [];
                const result: InteractedTreeResult = {
                    visitedLogs: treeCollectedResult, 
                    isDone: false,
                    initialSize: treeCollectedResult.source.getSize(),
                };
                player.visitedLogs.push(result);
                system.runTimeout(() => { 
                    resetOutlinedTrees(player, result);
                }, blockOutlinesDespawnTimer * TicksPerSecond);
            }
        } catch (e) {
            console.warn(e, e.stack);
        }
    },
  })
});

function resetOutlinedTrees(player: Player, result: InteractedTreeResult) {
    result.isDone = true;

    const t = system.runJob((function*(){
        for(const blockOutline of result.visitedLogs.blockOutlines) {
            if(blockOutline?.isValid()) {
                const isPersistent = blockOutline.getProperty('yn:stay_persistent');
                yield;
                if(isPersistent) continue;
                blockOutline.triggerEvent('despawn');
            }
            yield;
        }
        system.clearJob(t);
    })());
    
    player.visitedLogs?.shift();
}