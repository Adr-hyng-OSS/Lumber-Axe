import { world, system, ScriptEventSource, Player, EntityEquippableComponent, EntityInventoryComponent, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, MolangVariableMap, TicksPerSecond, ItemCooldownComponent } from '@minecraft/server';
import { ADDON_IDENTIFIER, axeEquipments, db, forceShow, getTreeLogs, getTreeTrunkSize, hashBlock, isLogIncluded, playerInteractedTimeLogMap, resetOutlinedTrees, SendMessageTo, serverConfigurationCopy, stackDistribution, visitedLogs } from "./index";
import { Logger } from 'utils/logger';
import './items/axes';
import { MinecraftEnchantmentTypes, MinecraftBlockTypes } from 'modules/vanilla-types/index';
import { Graph } from 'utils/graph';
import { Vec3 } from 'utils/VectorUtils';
import { ActionFormData, FormCancelationReason } from '@minecraft/server-ui';
const BLOCK_OUTLINES_DESPAWN_TIMER = 5;
world.afterEvents.playerSpawn.subscribe((e) => {
    if (!e.initialSpawn)
        return;
    e.player.configuration.loadServer();
    if (!db.has(`playerFirstJoined-${e.player.id}`)) {
        db.set(`playerFirstJoined-${e.player.id}`, false);
    }
    if (!db.get(`playerFirstJoined-${e.player.id}`)) {
        db.set(`playerFirstJoined-${e.player.id}`, true);
        SendMessageTo(e.player, {
            rawtext: [
                {
                    translate: "LumberAxe.on_load_message"
                }
            ]
        });
    }
});
world.beforeEvents.playerBreakBlock.subscribe((arg) => {
    const player = arg.player;
    const axe = player.getComponent(EntityEquippableComponent.componentId);
    const dimension = player.dimension;
    const blockInteracted = arg.block;
    const location = blockInteracted.location;
    const currentHeldAxe = arg.itemStack;
    const currentHeldAxeSlot = player.selectedSlotIndex;
    const currentBreakBlock = arg.block.permutation;
    const blockTypeId = currentBreakBlock.type.id;
    if (!axeEquipments.includes(currentHeldAxe.typeId))
        return;
    if (!player.isSurvival())
        return;
    if (!isLogIncluded(blockTypeId, blockTypeId)) {
        system.run(() => axe.damageDurability(1));
        return;
    }
    if (db.has(`visited_${hashBlock(blockInteracted)}`) && !db.get(`visited_${hashBlock(blockInteracted)}`)) {
        arg.cancel = true;
        return;
    }
    const possibleVisitedLogs = [];
    for (let i = 0; i < visitedLogs.length; i++) {
        const currentInspectedTree = visitedLogs[i];
        const interactedTreeNode = currentInspectedTree.visitedLogs.source.getNode(blockInteracted);
        if (interactedTreeNode) {
            possibleVisitedLogs.push({ result: currentInspectedTree, index: i });
        }
    }
    if (possibleVisitedLogs.length) {
        const latestPossibleInspectedTree = possibleVisitedLogs[possibleVisitedLogs.length - 1];
        const index = latestPossibleInspectedTree.index;
        const initialTreeInspection = latestPossibleInspectedTree.result;
        if (initialTreeInspection.isBeingChopped) {
            arg.cancel = true;
            return;
        }
        visitedLogs.splice(index, 1);
        initialTreeInspection.isDone = true;
    }
    player.configuration.loadServer();
    system.run(async () => {
        currentHeldAxe.lockMode = ItemLockMode.slot;
        const inventory = player.getComponent(EntityInventoryComponent.componentId).container;
        inventory.setItem(currentHeldAxeSlot, currentHeldAxe);
        axe.damageDurability(2);
        const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
        const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
        const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
        const unbreakingMultiplier = (100 / (level + 1)) / 100;
        const unbreakingDamage = +serverConfigurationCopy.durabilityDamagePerBlock.defaultValue * unbreakingMultiplier;
        let visited;
        let destroyedTree = {
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
        const molang = new MolangVariableMap();
        let isTreeDoneTraversing = false;
        const brokenTreeTrunk = await getTreeTrunkSize(blockInteracted, blockTypeId);
        const topMostBlock = blockInteracted.dimension.getTopmostBlock(brokenTreeTrunk.center);
        const bottomMostBlock = await new Promise((getBottomMostBlockResolved) => {
            let _bottom = blockInteracted.below();
            const _t = system.runInterval(() => {
                if (!isLogIncluded(blockInteracted.typeId, _bottom.typeId)) {
                    system.clearRun(_t);
                    getBottomMostBlockResolved(_bottom);
                    return;
                }
                _bottom = _bottom.below();
            });
        });
        const mainTreeTrunkHeight = (topMostBlock.y - bottomMostBlock.y);
        const isValidVerticalTree = mainTreeTrunkHeight > 2;
        if (isValidVerticalTree) {
            let dustRadius = 1;
            molang.setFloat('trunk_size', dustRadius);
            player.playSound('hit.stem');
            dimension.spawnParticle('yn:tree_dust', { x: brokenTreeTrunk.center.x, y: blockInteracted.y, z: brokenTreeTrunk.center.z }, molang);
            const t = system.runInterval(() => {
                molang.setFloat('trunk_size', dustRadius += 0.25);
                if (isTreeDoneTraversing) {
                    system.clearRun(t);
                    return;
                }
                ;
                player.playSound('hit.stem');
                dimension.spawnParticle('yn:tree_dust', { x: brokenTreeTrunk.center.x, y: blockInteracted.y, z: brokenTreeTrunk.center.z }, molang);
            }, 12);
        }
        const choppedTree = await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage, false);
        isTreeDoneTraversing = true;
        destroyedTree.visitedLogs = choppedTree;
        visited = choppedTree.source;
        const initialSize = visited.getSize() - 1;
        visitedLogs.push(destroyedTree);
        if (!visited)
            return;
        if (initialSize >= +serverConfigurationCopy.chopLimit.defaultValue) {
            currentHeldAxe.lockMode = ItemLockMode.none;
            inventory.setItem(currentHeldAxeSlot, currentHeldAxe);
            SendMessageTo(player, { rawtext: [{ translate: `LumberAxe.server.invalid_log_amount_limitation`, with: [serverConfigurationCopy.chopLimit.defaultValue] }] });
            return await new Promise((resolve) => {
                system.runJob((function* () {
                    for (const node of destroyedTree.visitedLogs.source.traverseIterative(blockInteracted, "BFS")) {
                        yield;
                        if (!node)
                            continue;
                        db.delete(`visited_${hashBlock(node.block)}`);
                        yield;
                    }
                    resetOutlinedTrees(destroyedTree);
                    resolve();
                    return;
                })());
            });
        }
        const totalDamage = initialSize * unbreakingDamage;
        const postDamagedDurability = itemDurability.damage + totalDamage;
        if (postDamagedDurability + 1 === itemDurability.maxDurability) {
            player.playSound("random.break");
            inventory.setItem(currentHeldAxeSlot, undefined);
        }
        else if (postDamagedDurability > itemDurability.maxDurability) {
            currentHeldAxe.lockMode = ItemLockMode.none;
            inventory.setItem(currentHeldAxeSlot, currentHeldAxe);
            return;
        }
        else if (postDamagedDurability < itemDurability.maxDurability) {
            itemDurability.damage = itemDurability.damage + totalDamage;
            const heldTemp = currentHeldAxe.clone();
            heldTemp.lockMode = ItemLockMode.none;
            inventory.setItem(currentHeldAxeSlot, heldTemp);
        }
        const treeDustParseMap = {
            0: 1,
            1: 3.25,
            2: 4,
            3: 4,
            4: 4,
            5: 7,
            6: 7,
            7: 7,
            8: 7,
            9: 7
        };
        const trunkYCoordinates = Array.from(destroyedTree.visitedLogs.yOffsets.keys()).sort((a, b) => a - b);
        const getTreeDustValue = (key) => key > 9 ? 7 : treeDustParseMap[key];
        molang.setFloat('trunk_size', getTreeDustValue(brokenTreeTrunk.size));
        let currentBlockOffset = 0;
        if (serverConfigurationCopy.progressiveChopping.defaultValue && isValidVerticalTree) {
            for (const yOffset of trunkYCoordinates) {
                if (currentBlockOffset % 2 === 0) {
                    await system.waitTicks(10);
                    const loc = { x: destroyedTree.visitedLogs.trunk.center.x, y: yOffset, z: destroyedTree.visitedLogs.trunk.center.z };
                    player.playSound('mob.irongolem.crack', { location: loc });
                    const molang = new MolangVariableMap();
                    molang.setFloat('trunk_size', getTreeDustValue(destroyedTree.visitedLogs.trunk.size));
                    dimension.spawnParticle('yn:tree_dust', loc, molang);
                }
                destroyedTree.visitedLogs.yOffsets.set(yOffset, true);
                currentBlockOffset++;
            }
        }
        let size = 0;
        system.runJob((function* () {
            if (!(serverConfigurationCopy.progressiveChopping.defaultValue) && isValidVerticalTree) {
                for (const yOffset of trunkYCoordinates) {
                    if (currentBlockOffset % 2 === 0) {
                        const molang = new MolangVariableMap();
                        molang.setFloat('trunk_size', getTreeDustValue(destroyedTree.visitedLogs.trunk.size));
                        dimension.spawnParticle('yn:tree_dust', { x: destroyedTree.visitedLogs.trunk.center.x, y: yOffset, z: destroyedTree.visitedLogs.trunk.center.z }, molang);
                    }
                    currentBlockOffset++;
                    yield;
                }
            }
            const blockOutlineIterator = destroyedTree.visitedLogs.blockOutlines[Symbol.iterator]();
            let blockOutlineIterResult = blockOutlineIterator.next();
            while (!blockOutlineIterResult.done) {
                const blockOutline = blockOutlineIterResult.value;
                if (blockOutline?.isValid()) {
                    blockOutline.setProperty('yn:trunk_size', destroyedTree.visitedLogs.trunk.size);
                }
                blockOutlineIterResult = blockOutlineIterator.next();
                yield;
            }
            for (const node of destroyedTree.visitedLogs.source.traverseIterative(blockInteracted, "BFS")) {
                yield;
                if (Vec3.equals(node.block, blockInteracted.location))
                    continue;
                if (!node)
                    continue;
                if (isLogIncluded(blockTypeId, node.block.typeId)) {
                    size++;
                    system.waitTicks(3).then(() => {
                        dimension.setBlockType(node.block.location, MinecraftBlockTypes.Air);
                    });
                }
                else {
                    destroyedTree.visitedLogs.source.removeNode(node.block);
                    break;
                }
                yield;
            }
            player.playSound('dig.cave_vines');
            for (const group of stackDistribution(size)) {
                dimension.spawnItem(new ItemStack(blockTypeId, group), location);
                yield;
            }
            return;
        })());
        await system.waitTicks(3);
        system.runJob((function* () {
            for (const node of destroyedTree.visitedLogs.source.traverseIterative(blockInteracted, "BFS")) {
                if (node) {
                    db.delete(`visited_${hashBlock(node.block)}`);
                }
                yield;
            }
            if (!destroyedTree?.isDone)
                resetOutlinedTrees(destroyedTree);
            return;
        })());
    });
});
world.beforeEvents.itemUseOn.subscribe(async (arg) => {
    const currentHeldAxe = arg.itemStack;
    const blockInteracted = arg.block;
    const player = arg.source;
    if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId, blockInteracted.typeId))
        return;
    const oldLog = playerInteractedTimeLogMap.get(player.id);
    playerInteractedTimeLogMap.set(player.id, system.currentTick);
    if ((oldLog + 10) >= system.currentTick)
        return;
    player.configuration.loadServer();
    const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
    const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
    const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
    const currentDurability = itemDurability.damage;
    const maxDurability = itemDurability.maxDurability;
    const unbreakingMultiplier = (100 / (level + 1)) / 100;
    const unbreakingDamage = +serverConfigurationCopy.durabilityDamagePerBlock.defaultValue * unbreakingMultiplier;
    const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
    const cooldown = currentHeldAxe.getComponent(ItemCooldownComponent.componentId);
    let BLOCK_OUTLINES_DESPAWN_CD = BLOCK_OUTLINES_DESPAWN_TIMER * TicksPerSecond;
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
                    if (db.has(`visited_${hashBlock(blockInteracted)}`)) {
                        inspectTreePromiseResolve({ result: null, index: -100 });
                        return system.clearJob(tMain);
                    }
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
                    if (!node.block?.isValid() || !isLogIncluded(blockInteracted.typeId, node.block.typeId)) {
                        initialTreeInspection.visitedLogs.source.removeNode(node.block);
                        db.delete(`visited_${hashBlock(node.block)}`);
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
                        center: {
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
                    system.waitTicks(BLOCK_OUTLINES_DESPAWN_CD).then(async (_) => {
                        system.runJob((function* () {
                            for (const node of newInspectedSubTree.visitedLogs.source.traverseIterative(blockInteracted, "BFS")) {
                                db.delete(`visited_${hashBlock(node.block)}`);
                                yield;
                            }
                            if (!visitedLogs[index])
                                return;
                            if (!visitedLogs[index].isDone)
                                resetOutlinedTrees(newInspectedSubTree);
                            return;
                        })());
                    });
                }
                else {
                    visitedLogs[index] = newInspectedSubTree;
                }
                system.clearJob(tMain);
                inspectTreePromiseResolve({ result: finalizedTreeInspection, index: index });
            })(inspectTreePromiseResolve));
        });
        if (tempResult.index === -1) {
            if (cooldown.getCooldownTicksRemaining(player) !== 0)
                return;
            cooldown.startCooldown(player);
            const molangVariable = new MolangVariableMap();
            let isTreeDoneTraversing = false;
            let treeOffsets = [];
            let result = {
                isBeingChopped: false,
                visitedLogs: {
                    blockOutlines: [],
                    source: new Graph(),
                    trunk: {
                        center: { x: 0, z: 0 },
                        size: 0
                    },
                    yOffsets: new Map()
                },
                isDone: false,
                initialSize: 0,
            };
            let interactedTreeTrunk = await getTreeTrunkSize(blockInteracted, blockInteracted.typeId);
            const topMostBlock = blockInteracted.dimension.getTopmostBlock(interactedTreeTrunk.center);
            const bottomMostBlock = await new Promise((getBottomMostBlockResolved) => {
                let _bottom = blockInteracted.below();
                const _t = system.runInterval(() => {
                    if (!isLogIncluded(blockInteracted.typeId, _bottom.typeId)) {
                        system.clearRun(_t);
                        getBottomMostBlockResolved(_bottom);
                        return;
                    }
                    _bottom = _bottom.below();
                });
            });
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
            let treeCollectedResult = null;
            const trunkHeight = (topMostBlock.y - (bottomMostBlock.y + 1));
            const isValidVerticalTree = trunkHeight > 2;
            if (isValidVerticalTree) {
                const { x: centerX, z: centerZ } = interactedTreeTrunk.center;
                const centerBlockErrorCatch = blockInteracted.dimension.getBlock({ x: centerX, y: blockInteracted.y, z: centerZ });
                if (!isLogIncluded(blockInteracted.typeId, centerBlockErrorCatch.typeId)) {
                    interactedTreeTrunk.size++;
                }
                const it = system.runInterval(() => {
                    if (result.isDone) {
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
                        y: bottomMostBlock.y + 1,
                        z: interactedTreeTrunk.center.z
                    }, molangVariable);
                }, 5);
            }
            treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, +serverConfigurationCopy.chopLimit.defaultValue);
            isTreeDoneTraversing = true;
            if (isValidVerticalTree) {
                treeOffsets = Array.from(treeCollectedResult.yOffsets.keys()).sort((a, b) => a - b);
                const { x: centerX, z: centerZ } = treeCollectedResult.trunk.center;
                const centerBlockErrorCatch = blockInteracted.dimension.getBlock({ x: centerX, y: blockInteracted.y, z: centerZ });
                if (!isLogIncluded(blockInteracted.typeId, centerBlockErrorCatch.typeId)) {
                    treeCollectedResult.trunk.size++;
                }
            }
            else {
                const t = system.runJob((function* () {
                    for (const node of treeCollectedResult.source.traverseIterative(blockInteracted, "BFS")) {
                        molangVariable.setFloat('radius', 1.1);
                        molangVariable.setFloat('height', 0.97);
                        molangVariable.setFloat('max_age', BLOCK_OUTLINES_DESPAWN_CD / TicksPerSecond);
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
                system.runJob((function* () {
                    for (const node of treeCollectedResult.source.traverseIterative(blockInteracted, "BFS")) {
                        db.delete(`visited_${hashBlock(node.block)}`);
                        yield;
                    }
                    if (!result?.isDone)
                        resetOutlinedTrees(result);
                    return;
                })());
            }, BLOCK_OUTLINES_DESPAWN_CD);
        }
        else if (tempResult.index >= 0) {
            const size = tempResult.result.source.getSize();
            const totalDamage = size * unbreakingDamage;
            const totalDurabilityConsumed = currentDurability + totalDamage;
            const canBeChopped = ((totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability)) && (size <= +serverConfigurationCopy.chopLimit.defaultValue);
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
                        text: ` ${size !== 0 ? (canBeChopped ? size : reachableLogs + 1) : 1}${canBeChopped ? "" : "+"} `
                    },
                    {
                        translate: `LumberAxe.form.treeSizeAbrevLogs.text`
                    }
                ]
            }, "textures/InfoUI/total_lumber.png")
                .button({
                rawtext: [
                    {
                        text: `${tempResult.result.yOffsets.size} `
                    },
                    {
                        translate: `LumberAxe.form.trunkHeightAbrev.text`
                    }
                ]
            }, "textures/InfoUI/tree_height.png")
                .button({
                rawtext: [
                    {
                        text: `${(maxDurability - totalDurabilityConsumed) > 0 ? '+' : ''}${maxDurability - totalDurabilityConsumed} `
                    },
                    {
                        translate: "LumberAxe.form.treeSizeAbrevLogs.text"
                    }
                ]
            }, (maxDurability - totalDurabilityConsumed) > 0 ? "textures/InfoUI/lumber_surplus.png" : "textures/InfoUI/lumber_deficit.png")
                .button({
                rawtext: [
                    {
                        translate: `${canBeChopped ? "LumberAxe.form.canBeChopped.text" : "LumberAxe.form.cannotBeChopped.text"}`
                    }
                ]
            }, canBeChopped ? "textures/InfoUI/can_be_cut.png" : "textures/InfoUI/cannot_be_cut.png");
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
});
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.sourceType !== ScriptEventSource.Entity)
        return;
    if (!(event.sourceEntity instanceof Player))
        return;
    if (event.id !== ADDON_IDENTIFIER)
        return;
    const player = event.sourceEntity;
    const message = event.message;
    const args = message.trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();
    system.run(async () => {
        try {
            const { default: CommandObject } = await import(`./commands/${cmd}.js`);
            CommandObject.execute(player, args);
        }
        catch (err) {
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
            }
            else {
                Logger.error(err, err.stack);
            }
        }
    });
});
