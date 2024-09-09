import { EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, isLogIncluded, playerInteractedTimeLogMap, serverConfigurationCopy, stackDistribution } from "index";
import { MinecraftBlockTypes, MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Logger } from "utils/logger";
import "classes/player";
import { Graph } from "utils/graph";
const blockOutlinesDespawnTimer = 10;
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
            })).then(async () => {
                await resetOutlinedTrees(player, destroyedTree);
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
            }).catch(async (e) => {
                await resetOutlinedTrees(player, destroyedTree);
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
                    const tempResult = await new Promise((inspectTreePromiseResolve) => {
                        const tMain = system.runJob((function* (inspectTreePromiseResolve) {
                            let index = -1;
                            if (!player.visitedLogs)
                                return system.clearJob(tMain);
                            const possibleVisitedLogs = [];
                            let i = 0;
                            for (const currentInspectedTree of player.visitedLogs) {
                                console.warn("Index possible tree: ", i);
                                const interactedTreeNode = currentInspectedTree.visitedLogs.source.getNode(blockInteracted.location);
                                if (interactedTreeNode) {
                                    possibleVisitedLogs.push({ result: currentInspectedTree, index: i });
                                }
                                i++;
                            }
                            console.warn("Possible Trees: ", possibleVisitedLogs.length);
                            possibleVisitedLogs.forEach((res) => console.warn("Possible Tree: ", res.result.visitedLogs.source.hash()));
                            for (let i = 0; i < possibleVisitedLogs.length; i++) {
                                index++;
                                const visitedTree = possibleVisitedLogs[i].result;
                                const _i = possibleVisitedLogs[i].index;
                                yield;
                                if (visitedTree.isDone)
                                    continue;
                                yield;
                                if (index !== possibleVisitedLogs.length - 1)
                                    continue;
                                index = player.visitedLogs.lastIndexOf(visitedTree);
                                inspectedTree = visitedTree;
                                break;
                            }
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
                            const tempResult = { blockOutlines: [], source: new Graph() };
                            if (inspectedTree.visitedLogs.source.getSize() !== 0) {
                                for (const node of inspectedTree.visitedLogs.source.traverseIterative(blockInteracted.location, "BFS")) {
                                    if (node) {
                                        tempResult.blockOutlines.push(inspectedTree.visitedLogs.blockOutlines[node.index]);
                                        tempResult.source.addNode(node);
                                    }
                                    yield;
                                }
                            }
                            else {
                                index = -1;
                                if (!player.visitedLogs)
                                    return;
                                for (const visitedLogsGraph of player.visitedLogs) {
                                    index++;
                                    const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                                    yield;
                                    if (!interactedNode)
                                        continue;
                                    yield;
                                    if (visitedLogsGraph.isDone)
                                        continue;
                                    const lastIndexOccurence = player.visitedLogs.lastIndexOf(visitedLogsGraph);
                                    yield;
                                    if (lastIndexOccurence === -1)
                                        continue;
                                    if (index !== lastIndexOccurence)
                                        continue;
                                    index = lastIndexOccurence;
                                    inspectedTree = player.visitedLogs[index];
                                    break;
                                }
                                if (!inspectedTree)
                                    return system.clearJob(tMain);
                                for (const node of inspectedTree.visitedLogs.source.traverseIterative(blockInteracted.location, "BFS")) {
                                    if (node) {
                                        tempResult.blockOutlines.push(inspectedTree.visitedLogs.blockOutlines[node.index]);
                                        tempResult.source.addNode(node);
                                    }
                                    yield;
                                }
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
                    const currentChangedIndex = player.visitedLogs.findIndex((result) => newInspectedSubTree.visitedLogs.source.isEqual(inspectedTree.visitedLogs.source) && !result.isDone);
                    if (currentChangedIndex === -1) {
                        player.visitedLogs.push(newInspectedSubTree);
                        system.waitTicks(blockOutlinesDespawnTimer * TicksPerSecond).then(async (_) => {
                            if (!player.visitedLogs[tempResult.index])
                                return;
                            if (!player.visitedLogs[tempResult.index].isDone)
                                await resetOutlinedTrees(player, newInspectedSubTree);
                        });
                    }
                    else {
                        player.visitedLogs[tempResult.index] = newInspectedSubTree;
                    }
                    const size = tempResult.result.source.getSize();
                    const totalDamage = size * unbreakingDamage;
                    const totalDurabilityConsumed = currentDurability + totalDamage;
                    const canBeChopped = (totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability);
                    const t = system.runJob((function* () {
                        for (const blockOutline of newInspectedSubTree.visitedLogs.blockOutlines) {
                            if (blockOutline?.isValid()) {
                                if (canBeChopped)
                                    blockOutline.triggerEvent('is_tree_choppable');
                                else
                                    blockOutline.triggerEvent('unchoppable_tree');
                            }
                            yield;
                        }
                        system.clearJob(t);
                    })());
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
                            const t = system.runJob((function* () {
                                for (const blockOutline of newInspectedSubTree.visitedLogs.blockOutlines) {
                                    if (blockOutline?.isValid()) {
                                        blockOutline.triggerEvent('go_default_outline');
                                    }
                                    yield;
                                }
                                system.clearJob(t);
                            })());
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
                    console.warn("Original: ", result.visitedLogs.source.hash(), "\n");
                    player.visitedLogs.push(result);
                    system.runTimeout(async () => {
                        await resetOutlinedTrees(player, result);
                    }, blockOutlinesDespawnTimer * TicksPerSecond);
                }
            }
            catch (e) {
                console.warn(e, e.stack);
            }
        },
    });
});
async function resetOutlinedTrees(player, result) {
    return new Promise((resolve) => {
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
            resolve();
        })());
        console.warn("RESET");
        player.visitedLogs?.shift();
    });
}
