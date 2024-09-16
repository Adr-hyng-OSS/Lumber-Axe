import { Block, EntityEquippableComponent, ItemCooldownComponent, ItemDurabilityComponent, ItemEnchantableComponent, ItemStack, MolangVariableMap, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, blockOutlinesDespawnTimer, forceShow, getTreeLogs, InteractedTreeResult, isLogIncluded, playerInteractedTimeLogMap, resetOutlinedTrees, serverConfigurationCopy, VisitedBlockResult, visitedLogs} from "index"
import { MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Logger } from "utils/logger";

import "classes/player";
import { Graph } from "utils/graph";

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

        const cooldown = (currentHeldAxe.getComponent(ItemCooldownComponent.componentId) as ItemCooldownComponent);
        try {
            // Check also, if this tree is already being interacted. By checking this current blockOutline (node), if it's being interacted.
            if(!visitedLogs) return;
            const tempResult = await new Promise<{result: VisitedBlockResult, index: number}>((inspectTreePromiseResolve) => {
                const tMain = system.runJob((function*(inspectTreePromiseResolve: (inspectedTreeResult: {result: VisitedBlockResult, index: number} | PromiseLike<{result: VisitedBlockResult, index: number}>) => void){
                    // Filter by getting the graph that has this node.
                    const possibleVisitedLogs: {result: InteractedTreeResult, index: number}[] = [];
                    for(let i = 0; i < visitedLogs.length; i++) {
                        const currentInspectedTree = visitedLogs[i];
                        const interactedTreeNode = currentInspectedTree.visitedLogs.source.getNode(blockInteracted);
                        if(interactedTreeNode) {
                            possibleVisitedLogs.push({result: currentInspectedTree, index: i});
                        }
                    }

                    if(!possibleVisitedLogs.length) {
                        inspectTreePromiseResolve({result: null, index: -1});
                        return system.clearJob(tMain);
                    }

                    // After filtering check get that tree that this player has inspected, get the latest one.
                    const latestPossibleInspectedTree = possibleVisitedLogs[possibleVisitedLogs.length - 1];
                    const index = latestPossibleInspectedTree.index;
                    const initialTreeInspection = latestPossibleInspectedTree.result;

                    // Remove some nodes in the graph that is not existing anymore. So, it can update its branches or neighbors
                    for(const node of initialTreeInspection.visitedLogs.source.traverseIterative(blockInteracted, "BFS")) {
                        if(!node.block?.isValid() || !isLogIncluded(node.block.typeId)) {
                            initialTreeInspection.visitedLogs.source.removeNode(node.block);
                        }
                        yield;
                    }

                    if(initialTreeInspection.initialSize === initialTreeInspection.visitedLogs.source.getSize()) {
                        system.clearJob(tMain);
                        inspectTreePromiseResolve({result: initialTreeInspection.visitedLogs, index: index});
                    }

                    const finalizedTreeInspection: VisitedBlockResult = {
                        blockOutlines: [], 
                        source: new Graph(), 
                        yOffsets: new Map(),
                        trunk: {
                            centroid: {
                                x: 0,
                                z: 0
                            },
                            size: 0
                        }
                    };

                    // Traverse the interacted block to validate the remaining nodes, if something was removed. O(n)
                    for(const node of initialTreeInspection.visitedLogs.source.traverseIterative(blockInteracted, "BFS")) {
                        if(node.block?.isValid()) {
                            finalizedTreeInspection.blockOutlines.push(initialTreeInspection.visitedLogs.blockOutlines[node.index]);
                            finalizedTreeInspection.source.addNode(node);
                            finalizedTreeInspection.yOffsets.set(node.block.location.y, false);
                        }
                        yield;
                    }

                    // Just appending the sub-tree as a separate tree.
                    const newInspectedSubTree: InteractedTreeResult = {
                        initialSize: finalizedTreeInspection.source.getSize(),
                        isDone: false, 
                        visitedLogs: finalizedTreeInspection
                    };
                    // if this newly inspected tree is just the main inspected tree, then just update, else add this new result, since it has changed.
                    const currentChangedIndex = visitedLogs.findIndex((result) => newInspectedSubTree.visitedLogs.source.isEqual(initialTreeInspection.visitedLogs.source) && !result.isDone);
                    if(currentChangedIndex === -1) {
                        if(newInspectedSubTree.initialSize > 0) visitedLogs.push(newInspectedSubTree);
                        system.waitTicks(blockOutlinesDespawnTimer * TicksPerSecond).then(async (_) => {
                            if(!visitedLogs[tempResult.index]) return;
                            if(!visitedLogs[tempResult.index].isDone) resetOutlinedTrees(newInspectedSubTree);
                        });
                    } else {
                        visitedLogs[tempResult.index] = newInspectedSubTree;
                    }
                    system.clearJob(tMain);
                    inspectTreePromiseResolve({result: finalizedTreeInspection, index: index});
                })(inspectTreePromiseResolve));
            });

            if(tempResult.index === -1) {
                if(cooldown.getCooldownTicksRemaining(player) !== 0) return;
                const currentTime = system.currentTick;
                const treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1);
                const t = system.runInterval(() => {
                    // Get the first block, and based on that it will get the height.
                    if(system.currentTick >= currentTime + (blockOutlinesDespawnTimer * TicksPerSecond)) system.clearRun(t);
                    const molangVariable = new MolangVariableMap();
                    const treeOffsets = Array.from(treeCollectedResult.yOffsets.keys()).sort((a, b) => a - b);
                    molangVariable.setFloat('radius', treeCollectedResult.trunk.size == 1 ? 0.75 : 1.5);
                    molangVariable.setFloat('depth', -(treeOffsets.length));
                    molangVariable.setColorRGB('color', {red: 1.0, green: 1.0, blue: 1.0}); // Change color based on property??
                    player.dimension.spawnParticle('yn:inspecting_indicator', {x: treeCollectedResult.trunk.centroid.x, y: treeOffsets[0], z: treeCollectedResult.trunk.centroid.z}, molangVariable);
                }, 5);
                cooldown.startCooldown(player);
                const result: InteractedTreeResult = {
                    visitedLogs: treeCollectedResult, 
                    isDone: false,
                    initialSize: treeCollectedResult.source.getSize(),
                };
                if(result.initialSize > 0) visitedLogs.push(result);
                system.runTimeout(async () => { 
                    if(!result.isDone) resetOutlinedTrees(result);
                }, blockOutlinesDespawnTimer * TicksPerSecond);
            } else {
                const size = tempResult.result.source.getSize();
                const totalDamage: number = size * unbreakingDamage;
                const totalDurabilityConsumed: number = currentDurability + totalDamage;
                const canBeChopped: boolean = ((totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability)) && (size <= parseInt(serverConfigurationCopy.chopLimit.defaultValue + ""));
                
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
                    return;
                }
                }).catch((error: Error) => {
                    Logger.error("Form Error: ", error, error.stack);
                });
            }
        } catch (e) {
            console.warn(e, e.stack);
        }
    },
  })
});