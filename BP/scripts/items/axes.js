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
                destroyedTree.visitedLogs.blockOutlines = [...inspectedTree.visitedLogs.blockOutlines];
                inspectedTree.visitedLogs.source.traverse(blockInteracted.location, "BFS", (node) => {
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
                size = visited.getSize();
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
            if (visited.getSize() <= 1)
                return;
            console.warn(size);
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
            await (new Promise((resolve) => {
                console.warn("TEST");
                for (const entityBlock of destroyedTree.visitedLogs.blockOutlines) {
                    if (!entityBlock?.isValid())
                        throw "Entity is undefined";
                    system.run(() => {
                        entityBlock.playAnimation('animation.block_outline.spawn_particle');
                        dimension.setBlockType(entityBlock.lastLocation, MinecraftBlockTypes.Air);
                    });
                }
                resolve();
            })).then(() => {
                resetOutlinedTrees(player, destroyedTree);
                for (const group of stackDistribution(size)) {
                    system.run(() => dimension.spawnItem(new ItemStack(blockTypeId, group), location));
                }
            }).catch((e) => console.warn(e, e.stack));
        },
        onUseOn(arg) {
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
                system.run(async () => {
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
                            if (blockOutline?.isValid())
                                continue;
                            let { x, y, z } = blockOutline.lastLocation;
                            x -= 0.5;
                            z -= 0.5;
                            inspectedTree.visitedLogs.source.removeNode({ x, y, z });
                        }
                        const tempResult = { blockOutlines: [], source: new Graph() };
                        inspectedTree.visitedLogs.source.traverse(blockInteracted.location, "BFS", (node) => {
                            if (node) {
                                tempResult.blockOutlines.push(inspectedTree.visitedLogs.blockOutlines[node.index]);
                                tempResult.source.addNode(node);
                            }
                        });
                        const newResult = {
                            isDone: false,
                            visitedLogs: tempResult
                        };
                        const currentChangedIndex = player.visitedLogs.findIndex((result) => JSON.stringify(newResult.visitedLogs.source) === JSON.stringify(inspectedTree.visitedLogs.source) && !result.isDone);
                        if (currentChangedIndex === -1) {
                            player.visitedLogs.push(newResult);
                            system.waitTicks(blockOutlinesDespawnTimer * TicksPerSecond).then((_) => {
                                if (!player.visitedLogs[index])
                                    return;
                                if (!player.visitedLogs[index].isDone)
                                    resetOutlinedTrees(player, newResult);
                            });
                        }
                        else {
                            player.visitedLogs[currentChangedIndex] = newResult;
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
                        };
                        player.visitedLogs.push(result);
                        system.runTimeout(() => {
                            resetOutlinedTrees(player, result);
                        }, blockOutlinesDespawnTimer * TicksPerSecond);
                    }
                });
            }
            catch (e) {
                console.warn(e, e.stack);
            }
        },
    });
});
function resetOutlinedTrees(player, result) {
    result.isDone = true;
    for (const blockOutline of result.visitedLogs.blockOutlines) {
        if (!blockOutline?.isValid())
            continue;
        const isPersistent = blockOutline.getProperty('yn:stay_persistent');
        if (isPersistent)
            continue;
        blockOutline.triggerEvent('despawn');
    }
    player.visitedLogs.shift();
    console.warn("RESET", player.visitedLogs?.length);
}
