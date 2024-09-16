import { EntityEquippableComponent, EntityInventoryComponent, ItemCooldownComponent, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, MolangVariableMap, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, blockOutlinesDespawnTimer, forceShow, getTreeLogs, isLogIncluded, playerInteractedTimeLogMap, resetOutlinedTrees, SendMessageTo, serverConfigurationCopy, stackDistribution, visitedLogs } from "index";
import { MinecraftBlockTypes, MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Logger } from "utils/logger";
import "classes/player";
import { Graph } from "utils/graph";
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
            const currentHeldAxeSlot = player.selectedSlotIndex;
            const currentBreakBlock = arg.minedBlockPermutation;
            const blockTypeId = currentBreakBlock.type.id;
            if (!player.isSurvival())
                return;
            if (!isLogIncluded(blockTypeId)) {
                axe.damageDurability(1);
                return;
            }
            currentHeldAxe.lockMode = ItemLockMode.slot;
            const inventory = player.getComponent(EntityInventoryComponent.componentId).container;
            inventory.setItem(currentHeldAxeSlot, currentHeldAxe);
            axe.damageDurability(2);
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
            if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + ""))
                return resetOutlinedTrees(destroyedTree, true);
            const totalDamage = size * unbreakingDamage;
            const postDamagedDurability = itemDurability.damage + totalDamage;
            if (postDamagedDurability + 1 === itemDurability.maxDurability) {
                player.playSound("random.break");
                inventory.setItem(currentHeldAxeSlot, undefined);
            }
            else if (postDamagedDurability > itemDurability.maxDurability) {
                currentHeldAxe.lockMode = ItemLockMode.none;
                return;
            }
            else if (postDamagedDurability < itemDurability.maxDurability) {
                itemDurability.damage = itemDurability.damage + totalDamage;
                const heldTemp = currentHeldAxe.clone();
                heldTemp.lockMode = ItemLockMode.none;
                inventory.setItem(currentHeldAxeSlot, heldTemp);
            }
            const trunkYCoordinates = Array.from(destroyedTree.visitedLogs.yOffsets.keys()).sort((a, b) => a - b);
            let currentBlockOffset = 0;
            const DustPerNumberOfBlocks = 2;
            for (const yOffset of trunkYCoordinates) {
                if (currentBlockOffset % DustPerNumberOfBlocks === 0) {
                    await system.waitTicks(3);
                    const molang = new MolangVariableMap();
                    molang.setFloat('trunk_size', destroyedTree.visitedLogs.trunk.size);
                    dimension.spawnParticle('yn:tree_dust', { x: destroyedTree.visitedLogs.trunk.centroid.x, y: yOffset, z: destroyedTree.visitedLogs.trunk.centroid.z }, molang);
                }
                destroyedTree.visitedLogs.yOffsets.set(yOffset, true);
                currentBlockOffset++;
            }
            const t = system.runJob((function* () {
                for (const node of destroyedTree.visitedLogs.source.traverseIterative(blockInteracted, "BFS")) {
                    if (node) {
                        const blockOutline = destroyedTree.visitedLogs.blockOutlines[node.index];
                        if (destroyedTree.visitedLogs.yOffsets.has(node.block.location.y) &&
                            destroyedTree.visitedLogs.yOffsets.get(node.block.location.y)) {
                            if (blockOutline?.isValid()) {
                                blockOutline.playAnimation('animation.block_outline.spawn_particle');
                                destroyedTree.visitedLogs.yOffsets.set(node.block.location.y, false);
                            }
                        }
                        system.waitTicks(3).then(() => dimension.setBlockType(node.block.location, MinecraftBlockTypes.Air));
                    }
                    yield;
                }
                for (const group of stackDistribution(size)) {
                    dimension.spawnItem(new ItemStack(blockTypeId, group), location);
                    yield;
                }
                system.clearJob(t);
            })());
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
            const cooldown = currentHeldAxe.getComponent(ItemCooldownComponent.componentId);
            try {
                if (!visitedLogs)
                    return;
                const tempResult = await new Promise((inspectTreePromiseResolve) => {
                    const tMain = system.runJob((function* (inspectTreePromiseResolve) {
                        const possibleVisitedLogs = [];
                        for (let i = 0; i < visitedLogs.length; i++) {
                            const currentInspectedTree = visitedLogs[i];
                            const interactedTreeNode = currentInspectedTree.visitedLogs.source.getNode(blockInteracted);
                            if (interactedTreeNode) {
                                possibleVisitedLogs.push({ result: currentInspectedTree, index: i });
                            }
                        }
                        if (!possibleVisitedLogs.length) {
                            inspectTreePromiseResolve({ result: null, index: -1 });
                            return system.clearJob(tMain);
                        }
                        const latestPossibleInspectedTree = possibleVisitedLogs[possibleVisitedLogs.length - 1];
                        const index = latestPossibleInspectedTree.index;
                        const initialTreeInspection = latestPossibleInspectedTree.result;
                        for (const node of initialTreeInspection.visitedLogs.source.traverseIterative(blockInteracted, "BFS")) {
                            if (!node.block?.isValid() || !isLogIncluded(node.block.typeId)) {
                                initialTreeInspection.visitedLogs.source.removeNode(node.block);
                            }
                            yield;
                        }
                        if (initialTreeInspection.initialSize === initialTreeInspection.visitedLogs.source.getSize()) {
                            system.clearJob(tMain);
                            inspectTreePromiseResolve({ result: initialTreeInspection.visitedLogs, index: index });
                        }
                        const finalizedTreeInspection = {
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
                        for (const node of initialTreeInspection.visitedLogs.source.traverseIterative(blockInteracted, "BFS")) {
                            if (node.block?.isValid()) {
                                finalizedTreeInspection.blockOutlines.push(initialTreeInspection.visitedLogs.blockOutlines[node.index]);
                                finalizedTreeInspection.source.addNode(node);
                                finalizedTreeInspection.yOffsets.set(node.block.location.y, false);
                            }
                            yield;
                        }
                        const newInspectedSubTree = {
                            initialSize: finalizedTreeInspection.source.getSize(),
                            isDone: false,
                            visitedLogs: finalizedTreeInspection
                        };
                        const currentChangedIndex = visitedLogs.findIndex((result) => newInspectedSubTree.visitedLogs.source.isEqual(initialTreeInspection.visitedLogs.source) && !result.isDone);
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
                        system.clearJob(tMain);
                        inspectTreePromiseResolve({ result: finalizedTreeInspection, index: index });
                    })(inspectTreePromiseResolve));
                });
                if (tempResult.index === -1) {
                    if (cooldown.getCooldownTicksRemaining(player) !== 0)
                        return;
                    const currentTime = system.currentTick;
                    const treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1);
                    const t = system.runInterval(() => {
                        if (system.currentTick >= currentTime + (blockOutlinesDespawnTimer * TicksPerSecond))
                            system.clearRun(t);
                        const molangVariable = new MolangVariableMap();
                        const treeOffsets = Array.from(treeCollectedResult.yOffsets.keys()).sort((a, b) => a - b);
                        molangVariable.setFloat('radius', treeCollectedResult.trunk.size == 1 ? 0.75 : 1.5);
                        molangVariable.setFloat('depth', -(treeOffsets.length));
                        molangVariable.setColorRGB('color', { red: 1.0, green: 1.0, blue: 1.0 });
                        player.dimension.spawnParticle('yn:inspecting_indicator', { x: treeCollectedResult.trunk.centroid.x, y: treeOffsets[0], z: treeCollectedResult.trunk.centroid.z }, molangVariable);
                    }, 5);
                    cooldown.startCooldown(player);
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
                else {
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
            }
            catch (e) {
                console.warn(e, e.stack);
            }
        },
    });
});
