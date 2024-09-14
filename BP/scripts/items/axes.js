import { EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, MolangVariableMap, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, isLogIncluded, playerInteractedTimeLogMap, SendMessageTo, serverConfigurationCopy, stackDistribution } from "index";
import { MinecraftBlockTypes, MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Logger } from "utils/logger";
import "classes/player";
import { Graph } from "utils/graph";
const blockOutlinesDespawnTimer = 5;
export const visitedLogs = [];
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
            let visited;
            let destroyedTree = {
                initialSize: 0,
                isDone: false,
                visitedLogs: {
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
                }
            };
            const choppedTree = await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage, false);
            SendMessageTo(player, { rawtext: [{ text: "Tree is fully traversed. " }] });
            destroyedTree.visitedLogs = choppedTree;
            visited = choppedTree.source;
            const size = visited.getSize() - 1;
            if (!visited)
                return;
            if (size <= 1)
                return axe.damageDurability(2);
            if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + ""))
                return resetOutlinedTrees(destroyedTree, true);
            const trunkYCoordinates = destroyedTree.visitedLogs.yOffsets;
            let i = 0;
            for (const yOffset of trunkYCoordinates) {
                if (i % 2 === 0) {
                    await system.waitTicks(3);
                    const molang = new MolangVariableMap();
                    molang.setFloat('trunk_size', destroyedTree.visitedLogs.trunk.size);
                    dimension.spawnParticle('yn:tree_dust', { x: destroyedTree.visitedLogs.trunk.centroid.x, y: yOffset[0], z: destroyedTree.visitedLogs.trunk.centroid.z }, molang);
                }
                destroyedTree.visitedLogs.yOffsets.set(yOffset[0], true);
                i++;
            }
            await (new Promise((resolve) => {
                const t = system.runJob((function* () {
                    destroyedTree.visitedLogs.source.traverse(location, "BFS", (node) => {
                        if (node) {
                            const blockOutline = destroyedTree.visitedLogs.blockOutlines[node.index];
                            if (destroyedTree.visitedLogs.yOffsets.has(node.location.y) && destroyedTree.visitedLogs.yOffsets.get(node.location.y)) {
                                if (blockOutline?.isValid()) {
                                    blockOutline.playAnimation('animation.block_outline.spawn_particle');
                                    destroyedTree.visitedLogs.yOffsets.set(node.location.y, false);
                                }
                            }
                            system.waitTicks(3).then(() => {
                                dimension.setBlockType(node.location, MinecraftBlockTypes.Air);
                            });
                        }
                    });
                    system.clearJob(t);
                    resolve();
                })());
            })).then(() => {
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
                console.warn(e, e.stack);
                currentHeldAxe.lockMode = ItemLockMode.none;
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
                    if (!visitedLogs)
                        return;
                    const tempResult = await new Promise((inspectTreePromiseResolve) => {
                        const tMain = system.runJob((function* (inspectTreePromiseResolve) {
                            const possibleVisitedLogs = [];
                            for (let i = 0; i < visitedLogs.length; i++) {
                                const currentInspectedTree = visitedLogs[i];
                                const interactedTreeNode = currentInspectedTree.visitedLogs.source.getNode(blockInteracted.location);
                                if (interactedTreeNode) {
                                    possibleVisitedLogs.push({ result: currentInspectedTree, index: i });
                                }
                            }
                            if (!possibleVisitedLogs.length)
                                return system.clearJob(tMain);
                            const latestPossibleInspectedTree = possibleVisitedLogs[possibleVisitedLogs.length - 1];
                            const index = latestPossibleInspectedTree.index;
                            inspectedTree = latestPossibleInspectedTree.result;
                            if (!inspectedTree)
                                return system.clearJob(tMain);
                            for (const blockOutline of inspectedTree.visitedLogs.blockOutlines) {
                                if (!blockOutline?.isValid()) {
                                    let { x, y, z } = blockOutline.lastLocation;
                                    x -= 0.5;
                                    z -= 0.5;
                                    inspectedTree.visitedLogs.source.removeNode({ x, y, z });
                                }
                                yield;
                            }
                            if (inspectedTree.initialSize === inspectedTree.visitedLogs.source.getSize()) {
                                system.clearJob(tMain);
                                inspectTreePromiseResolve({ result: inspectedTree.visitedLogs, index: index });
                            }
                            const tempResult = {
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
                            for (const node of inspectedTree.visitedLogs.source.traverseIterative(blockInteracted.location, "BFS")) {
                                if (node) {
                                    tempResult.blockOutlines.push(inspectedTree.visitedLogs.blockOutlines[node.index]);
                                    tempResult.source.addNode(node);
                                    tempResult.yOffsets.set(node.location.y, false);
                                }
                                yield;
                            }
                            system.clearJob(tMain);
                            inspectTreePromiseResolve({ result: tempResult, index: index });
                        })(inspectTreePromiseResolve));
                    });
                    const newInspectedSubTree = {
                        initialSize: tempResult.result.source.getSize(),
                        isDone: false,
                        visitedLogs: tempResult.result
                    };
                    const currentChangedIndex = visitedLogs.findIndex((result) => newInspectedSubTree.visitedLogs.source.isEqual(inspectedTree.visitedLogs.source) && !result.isDone);
                    if (currentChangedIndex === -1) {
                        if (newInspectedSubTree.initialSize > 0)
                            visitedLogs.push(newInspectedSubTree);
                        system.waitTicks(blockOutlinesDespawnTimer * TicksPerSecond).then(async (_) => {
                            if (!visitedLogs[tempResult.index])
                                return;
                            if (!visitedLogs[tempResult.index].isDone)
                                resetOutlinedTrees(newInspectedSubTree);
                        });
                    }
                    else {
                        visitedLogs[tempResult.index] = newInspectedSubTree;
                    }
                    const size = tempResult.result.source.getSize();
                    const totalDamage = size * unbreakingDamage;
                    const totalDurabilityConsumed = currentDurability + totalDamage;
                    const canBeChopped = ((totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability)) && (size <= parseInt(serverConfigurationCopy.chopLimit.defaultValue + ""));
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
                    const t = system.runJob((function* () {
                        for (const blockOutline of treeCollectedResult.blockOutlines) {
                            if (blockOutline?.isValid())
                                blockOutline.triggerEvent('is_tree_choppable');
                            yield;
                        }
                        system.clearJob(t);
                    })());
                    const result = {
                        visitedLogs: treeCollectedResult,
                        isDone: false,
                        initialSize: treeCollectedResult.source.getSize(),
                    };
                    if (result.initialSize > 0)
                        visitedLogs.push(result);
                    system.runTimeout(async () => {
                        if (!result.isDone)
                            resetOutlinedTrees(result);
                    }, blockOutlinesDespawnTimer * TicksPerSecond);
                }
            }
            catch (e) {
                console.warn(e, e.stack);
            }
        },
    });
});
function resetOutlinedTrees(result, instantDespawn = false) {
    if (result.isDone)
        return;
    result.isDone = true;
    if (!instantDespawn)
        visitedLogs?.shift();
    const t = system.runJob((function* () {
        for (const blockOutline of result.visitedLogs.blockOutlines) {
            if (blockOutline?.isValid()) {
                blockOutline.triggerEvent('despawn');
            }
            yield;
        }
        system.clearJob(t);
    })());
}
