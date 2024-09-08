import { EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, isLogIncluded, playerInteractedTimeLogMap, serverConfigurationCopy, stackDistribution } from "index";
import { MinecraftBlockTypes, MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Logger } from "utils/logger";
import "classes/player";
import { Graph } from "utils/graph";
const blockOutlinesDespawnTimer = 5;
world.beforeEvents.worldInitialize.subscribe((registry) => {
    registry.itemComponentRegistry.registerCustomComponent('yn:tool_durability', {
        onHitEntity(arg) {
            if (!(arg.attackingEntity instanceof Player))
                return;
            const player = arg.attackingEntity;
            if (!player.isSurvival())
                return;
            const axe = player.getComponent(EntityEquippableComponent.componentId);
            axe.damageDurability(1);
        },
        async onMineBlock(arg) {
            if (!(arg.source instanceof Player))
                return;
            const player = arg.source;
            const axe = player.getComponent(EntityEquippableComponent.componentId);
            const dimension = player.dimension;
            const blockInteracted = arg.block;
            const location = blockInteracted.location;
            const currentHeldAxe = arg.itemStack;
            const currentBreakBlock = arg.minedBlockPermutation;
            const blockTypeId = currentBreakBlock.type.id;
            if (!player.isSurvival())
                return;
            if (!isLogIncluded(blockTypeId)) {
                axe.damageDurability(1);
                return;
            }
            const equipment = player.getComponent(EntityEquippableComponent.componentId);
            currentHeldAxe.lockMode = ItemLockMode.slot;
            const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
            const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
            const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
            const unbreakingMultiplier = (100 / (level + 1)) / 100;
            const unbreakingDamage = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
            const blockOutline = player.dimension.getEntities({
                closest: 1,
                maxDistance: 1,
                type: "yn:block_outline",
                location: blockInteracted.bottomCenter()
            })[0];
            let visited;
            let destroyedTree = {
                initialSize: 0,
                isDone: false,
                visitedLogs: {
                    blockOutlines: [],
                    source: new Graph()
                }
            };
            let size = 0;
            if (blockOutline) {
                let inspectedTree;
                let index = -1;
                for (const visitedLogsGraph of player.visitedLogs) {
                    index++;
                    const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                    if (!interactedNode)
                        continue;
                    if (visitedLogsGraph.isDone)
                        continue;
                    const lastIndexOccurence = player.visitedLogs.lastIndexOf(visitedLogsGraph);
                    if (lastIndexOccurence === -1)
                        continue;
                    if (index !== lastIndexOccurence)
                        continue;
                    index = lastIndexOccurence;
                    inspectedTree = player.visitedLogs[index];
                    break;
                }
                if (!inspectedTree)
                    return;
                destroyedTree.initialSize = inspectedTree.initialSize;
                inspectedTree.visitedLogs.source.traverse(blockInteracted.location, "BFS", (node) => {
                    destroyedTree.visitedLogs.blockOutlines.push(inspectedTree.visitedLogs.blockOutlines[node.index]);
                    destroyedTree.visitedLogs.source.addNode(node);
                });
                for (const blockOutline of destroyedTree.visitedLogs.blockOutlines) {
                    if (blockOutline?.isValid())
                        continue;
                    let { x, y, z } = blockOutline.lastLocation;
                    x -= 0.5;
                    z -= 0.5;
                    destroyedTree.visitedLogs.source.removeNode({ x, y, z });
                }
                const tempResult = { blockOutlines: [], source: new Graph() };
                destroyedTree.visitedLogs.source.traverse(blockInteracted.location, "BFS", (node) => {
                    if (node) {
                        tempResult.blockOutlines.push(destroyedTree.visitedLogs.blockOutlines[node.index]);
                        tempResult.source.addNode(node);
                    }
                });
                tempResult.source.removeNode(blockOutline.lastLocation);
                destroyedTree.visitedLogs = tempResult;
                visited = tempResult.source;
                size = visited.getSize() - 1;
            }
            else {
                const choppedTree = await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage, false);
                destroyedTree.visitedLogs.source = choppedTree.source;
                destroyedTree.visitedLogs.blockOutlines = choppedTree.blockOutlines;
                visited = choppedTree.source;
                size = visited.getSize() - 1;
            }
            if (!visited)
                return;
            if (size <= 0)
                return;
            await (new Promise((resolve) => {
                const t = system.runJob((function* () {
                    destroyedTree.visitedLogs.source.traverse(location, "BFS", (node) => {
                        if (node) {
                            const blockOutline = destroyedTree.visitedLogs.blockOutlines[node.index];
                            dimension.setBlockType(node.location, MinecraftBlockTypes.Air);
                        }
                    });
                    system.clearJob(t);
                    resolve();
                })());
            })).then(() => {
                resetOutlinedTrees(player, destroyedTree);
                const totalDamage = size * unbreakingDamage;
                const postDamagedDurability = itemDurability.damage + totalDamage;
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
                for (const group of stackDistribution(size)) {
                    system.run(() => dimension.spawnItem(new ItemStack(blockTypeId, group), location));
                }
            }).catch((e) => {
                resetOutlinedTrees(player, destroyedTree);
                console.warn(e, e.stack);
            });
        },
        async onUseOn(arg) {
            const currentHeldAxe = arg.itemStack;
            const blockInteracted = arg.block;
            const player = arg.source;
            if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId))
                return;
            const oldLog = playerInteractedTimeLogMap.get(player.id);
            playerInteractedTimeLogMap.set(player.id, system.currentTick);
            if ((oldLog + 5) >= system.currentTick)
                return;
            const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
            const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
            const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
            const currentDurability = itemDurability.damage;
            const maxDurability = itemDurability.maxDurability;
            const unbreakingMultiplier = (100 / (level + 1)) / 100;
            const unbreakingDamage = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
            const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
            const blockOutline = player.dimension.getEntities({ closest: 1, maxDistance: 1, type: "yn:block_outline", location: blockInteracted.bottomCenter() })[0];
            try {
                if (blockOutline?.isValid()) {
                    let inspectedTree;
                    let index = -1;
                    if (!player.visitedLogs)
                        return;
                    for (const visitedLogsGraph of player.visitedLogs) {
                        index++;
                        const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                        if (!interactedNode)
                            continue;
                        if (visitedLogsGraph.isDone)
                            continue;
                        const lastIndexOccurence = player.visitedLogs.lastIndexOf(visitedLogsGraph);
                        if (lastIndexOccurence === -1)
                            continue;
                        if (index !== lastIndexOccurence)
                            continue;
                        index = lastIndexOccurence;
                        inspectedTree = player.visitedLogs[index];
                        break;
                    }
                    if (!inspectedTree)
                        return;
                    for (const blockOutline of inspectedTree.visitedLogs.blockOutlines) {
                        if (blockOutline?.isValid()) {
                            continue;
                        }
                        let { x, y, z } = blockOutline.lastLocation;
                        x -= 0.5;
                        z -= 0.5;
                        inspectedTree.visitedLogs.source.removeNode({ x, y, z });
                    }
                    const tempResult = { blockOutlines: [], source: new Graph() };
                    if (inspectedTree.visitedLogs.source.getSize() !== 0) {
                        inspectedTree.visitedLogs.source.traverse(blockInteracted.location, "BFS", (node) => {
                            if (node) {
                                tempResult.blockOutlines.push(inspectedTree.visitedLogs.blockOutlines[node.index]);
                                tempResult.source.addNode(node);
                            }
                        });
                    }
                    else {
                        index = -1;
                        if (!player.visitedLogs)
                            return;
                        for (const visitedLogsGraph of player.visitedLogs) {
                            index++;
                            const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                            if (!interactedNode)
                                continue;
                            if (visitedLogsGraph.isDone)
                                continue;
                            const lastIndexOccurence = player.visitedLogs.lastIndexOf(visitedLogsGraph);
                            if (lastIndexOccurence === -1)
                                continue;
                            if (index !== lastIndexOccurence)
                                continue;
                            index = lastIndexOccurence;
                            inspectedTree = player.visitedLogs[index];
                            break;
                        }
                        if (!inspectedTree)
                            return;
                        inspectedTree.visitedLogs.source.traverse(blockInteracted.location, "BFS", (node) => {
                            if (node) {
                                tempResult.blockOutlines.push(inspectedTree.visitedLogs.blockOutlines[node.index]);
                                tempResult.source.addNode(node);
                            }
                        });
                    }
                    const newInspectedSubTree = {
                        initialSize: tempResult.source.getSize(),
                        isDone: false,
                        visitedLogs: tempResult
                    };
                    const currentChangedIndex = player.visitedLogs.findIndex((result) => newInspectedSubTree.visitedLogs.source.isEqual(inspectedTree.visitedLogs.source) && !result.isDone);
                    if (currentChangedIndex === -1) {
                        player.visitedLogs.push(newInspectedSubTree);
                        system.waitTicks(blockOutlinesDespawnTimer * TicksPerSecond).then((_) => {
                            if (!player.visitedLogs[index])
                                return;
                            if (!player.visitedLogs[index].isDone)
                                resetOutlinedTrees(player, newInspectedSubTree);
                        });
                    }
                    else {
                        player.visitedLogs[currentChangedIndex] = newInspectedSubTree;
                    }
                    const size = tempResult.source.getSize();
                    const totalDamage = size * unbreakingDamage;
                    const totalDurabilityConsumed = currentDurability + totalDamage;
                    const canBeChopped = (totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability);
                    const inspectionForm = new ActionFormData()
                        .title({
                        rawtext: [
                            {
                                translate: "LumberAxe.form.title.text"
                            }
                        ]
                    })
                        .button({
                        rawtext: [
                            {
                                translate: `LumberAxe.form.treeSizeAbrev.text`
                            },
                            {
                                text: ` ${size !== 0 ? size : 1}${canBeChopped ? "" : "+"} `
                            },
                            {
                                translate: `LumberAxe.form.treeSizeAbrevLogs.text`
                            }
                        ]
                    }, "textures/InfoUI/blocks.png")
                        .button({
                        rawtext: [
                            {
                                translate: `LumberAxe.form.durabilityAbrev.text`
                            },
                            {
                                text: ` ${currentDurability}`
                            }
                        ]
                    }, "textures/InfoUI/axe_durability.png")
                        .button({
                        rawtext: [
                            {
                                translate: `LumberAxe.form.maxDurabilityAbrev.text`
                            },
                            {
                                text: ` ${maxDurability}`
                            }
                        ]
                    }, "textures/InfoUI/required_durability.png")
                        .button({
                        rawtext: [
                            {
                                text: "§l"
                            },
                            {
                                translate: `${canBeChopped ? "LumberAxe.form.canBeChopped.text" : "LumberAxe.form.cannotBeChopped.text"}`
                            }
                        ]
                    }, "textures/InfoUI/canBeCut.png");
                    forceShow(player, inspectionForm).then((response) => {
                        if (response.canceled || response.selection === undefined || response.cancelationReason === FormCancelationReason.UserClosed) {
                            return;
                        }
                    }).catch((error) => {
                        Logger.error("Form Error: ", error, error.stack);
                    });
                }
                else {
                    const treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1);
                    player.visitedLogs = player.visitedLogs ?? [];
                    const result = {
                        visitedLogs: treeCollectedResult,
                        isDone: false,
                        initialSize: treeCollectedResult.source.getSize(),
                    };
                    player.visitedLogs.push(result);
                    system.runTimeout(() => {
                        resetOutlinedTrees(player, result);
                    }, blockOutlinesDespawnTimer * TicksPerSecond);
                }
            }
            catch (e) {
                console.warn(e, e.stack);
            }
        },
    });
});
function resetOutlinedTrees(player, result) {
    result.isDone = true;
    const t = system.runJob((function* () {
        for (const blockOutline of result.visitedLogs.blockOutlines) {
            if (blockOutline?.isValid()) {
                const isPersistent = blockOutline.getProperty('yn:stay_persistent');
                yield;
                if (isPersistent)
                    continue;
                blockOutline.triggerEvent('despawn');
            }
            yield;
        }
        system.clearJob(t);
    })());
    player.visitedLogs?.shift();
}
