import { EntityEquippableComponent, ItemCooldownComponent, ItemDurabilityComponent, ItemEnchantableComponent, MolangVariableMap, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, getTreeTrunkSize, isLogIncluded, playerInteractedTimeLogMap, resetOutlinedTrees, serverConfigurationCopy, visitedLogs } from "index";
import { MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
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
            player.configuration.loadServer();
            const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
            const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
            const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
            const currentDurability = itemDurability.damage;
            const maxDurability = itemDurability.maxDurability;
            const unbreakingMultiplier = (100 / (level + 1)) / 100;
            const unbreakingDamage = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
            const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
            const cooldown = currentHeldAxe.getComponent(ItemCooldownComponent.componentId);
            let BLOCK_OUTLINES_DESPAWN_CD = cooldown.cooldownTicks / TicksPerSecond;
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
                        if (initialTreeInspection.isBeingChopped) {
                            inspectTreePromiseResolve({ result: null, index: -100 });
                            return system.clearJob(tMain);
                        }
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
                            isBeingChopped: false,
                            initialSize: finalizedTreeInspection.source.getSize(),
                            isDone: false,
                            visitedLogs: finalizedTreeInspection
                        };
                        const currentChangedIndex = visitedLogs.findIndex((result) => newInspectedSubTree.visitedLogs.source.isEqual(initialTreeInspection.visitedLogs.source) && !result.isDone);
                        if (currentChangedIndex === -1) {
                            if (newInspectedSubTree.initialSize > 0)
                                visitedLogs.push(newInspectedSubTree);
                            system.waitTicks(BLOCK_OUTLINES_DESPAWN_CD * TicksPerSecond).then(async (_) => {
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
                    const molangVariable = new MolangVariableMap();
                    let isTreeDoneTraversing = false;
                    let treeOffsets = [];
                    let result = {
                        isBeingChopped: false,
                        visitedLogs: {
                            blockOutlines: [],
                            source: new Graph(),
                            trunk: {
                                centroid: { x: 0, z: 0 },
                                size: 0
                            },
                            yOffsets: new Map()
                        },
                        isDone: false,
                        initialSize: 0,
                    };
                    const interactedTreeTrunk = await getTreeTrunkSize(blockInteracted, blockInteracted.typeId);
                    const topMostBlock = blockInteracted.dimension.getTopmostBlock(interactedTreeTrunk.center);
                    const bottomMostBlock = await new Promise((getBottomMostBlockResolved) => {
                        let _bottom = blockInteracted.below();
                        const _t = system.runInterval(() => {
                            if (!isLogIncluded(blockInteracted.typeId) || blockInteracted.typeId !== _bottom.typeId) {
                                system.clearRun(_t);
                                getBottomMostBlockResolved(_bottom);
                                return;
                            }
                            _bottom = _bottom.below();
                        });
                    });
                    cooldown.startCooldown(player);
                    const trunkSizeToParticleRadiusParser = {
                        1: 1.5,
                        2: 2.5,
                        3: 2.5,
                        4: 2.5,
                        5: 3.5,
                        6: 3.5,
                        7: 3.5,
                        8: 3.5,
                        9: 3.5
                    };
                    const trunkHeight = (topMostBlock.y - bottomMostBlock.y);
                    if (trunkHeight > 3) {
                        const it = system.runInterval(() => {
                            if (system.currentTick >= currentTime + (BLOCK_OUTLINES_DESPAWN_CD * TicksPerSecond) || result?.isDone) {
                                system.clearRun(it);
                                return;
                            }
                            if (isTreeDoneTraversing) {
                                molangVariable.setFloat('radius', trunkSizeToParticleRadiusParser[treeCollectedResult.trunk.size]);
                                molangVariable.setFloat('height', treeOffsets.length);
                                molangVariable.setFloat('max_age', 1);
                                molangVariable.setColorRGB('color', { red: 0.0, green: 1.0, blue: 0.0 });
                            }
                            else {
                                molangVariable.setFloat('radius', trunkSizeToParticleRadiusParser[interactedTreeTrunk.size]);
                                molangVariable.setFloat('height', trunkHeight);
                                molangVariable.setFloat('max_age', 1);
                                molangVariable.setColorRGB('color', { red: 1.0, green: 1.0, blue: 1.0 });
                            }
                            player.dimension.spawnParticle('yn:inspecting_indicator', {
                                x: interactedTreeTrunk.center.x,
                                y: bottomMostBlock.y,
                                z: interactedTreeTrunk.center.z
                            }, molangVariable);
                        }, 5);
                    }
                    const currentTime = system.currentTick;
                    const treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1);
                    isTreeDoneTraversing = true;
                    if (trunkHeight > 3) {
                        treeOffsets = Array.from(treeCollectedResult.yOffsets.keys()).sort((a, b) => a - b);
                    }
                    else {
                        const t = system.runJob((function* () {
                            for (const node of treeCollectedResult.source.traverseIterative(blockInteracted, "BFS")) {
                                molangVariable.setFloat('radius', 1.1);
                                molangVariable.setFloat('height', 0.99);
                                molangVariable.setFloat('max_age', BLOCK_OUTLINES_DESPAWN_CD);
                                molangVariable.setColorRGB('color', { red: 0.0, green: 1.0, blue: 0.0 });
                                player.dimension.spawnParticle('yn:inspecting_indicator', { x: node.block.bottomCenter().x, y: node.block.y, z: node.block.bottomCenter().z }, molangVariable);
                                yield;
                            }
                            system.clearJob(t);
                        })());
                    }
                    result = {
                        isBeingChopped: false,
                        visitedLogs: treeCollectedResult,
                        isDone: false,
                        initialSize: treeCollectedResult.source.getSize(),
                    };
                    if (result.initialSize > 0)
                        visitedLogs.push(result);
                    system.runTimeout(() => {
                        if (!result?.isDone)
                            resetOutlinedTrees(result);
                    }, (BLOCK_OUTLINES_DESPAWN_CD - 2) * TicksPerSecond);
                }
                else if (tempResult.index >= 0) {
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
