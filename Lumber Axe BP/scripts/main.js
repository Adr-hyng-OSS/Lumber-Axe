import { world, ItemStack, MinecraftBlockTypes, GameMode, ItemLockMode, system, ItemDurabilityComponent, ItemEnchantsComponent, WatchdogTerminateReason, EntityEquipmentInventoryComponent, EquipmentSlot } from '@minecraft/server';
import { FormCancelationReason, ActionFormData } from "@minecraft/server-ui";
import { config as Configuration } from "./config";
const axeEquipments = ["yn:wooden_lumber_axe", "yn:stone_lumber_axe", "yn:iron_lumber_axe", "yn:diamond_lumber_axe", "yn:golden_lumber_axe", "yn:netherite_lumber_axe"];
const logMap = new Map();
const playerInteractionMap = new Map();
const validLogBlocks = /(_log|crimson_stem|warped_stem)$/;
const { durabilityDamagePerBlock, chopLimit, excludedLog, includedLog, disableWatchDogTerminateLog } = Configuration;
system.beforeEvents.watchdogTerminate.subscribe((e) => {
    e.cancel = true;
    if (e.terminateReason === WatchdogTerminateReason.Hang) {
        for (const key of playerInteractionMap.keys()) {
            playerInteractionMap.set(key, false);
        }
        if (!disableWatchDogTerminateLog)
            world.sendMessage(`Scripting Error: Try chopping or inspecting smaller trees or different angle.`);
        if (disableWatchDogTerminateLog)
            console.warn(`Scripting Error: Try chopping or inspecting smaller trees or different angle.`);
    }
    console.warn(`Watchdog Error: ${e.terminateReason}`);
});
world.afterEvents.playerLeave.subscribe((e) => {
    playerInteractionMap.set(e.playerId, false);
});
world.afterEvents.blockBreak.subscribe(async (e) => {
    const { dimension, player, block } = e;
    const currentBreakBlock = e.brokenBlockPermutation;
    const blockTypeId = currentBreakBlock.type.id;
    treeCut(player, dimension, block.location, blockTypeId);
});
world.beforeEvents.itemUseOn.subscribe(async (e) => {
    const currentHeldAxe = e.itemStack;
    const blockInteracted = e.block;
    const player = e.source;
    const oldLog = logMap.get(player.name);
    logMap.set(player.name, Date.now());
    if ((oldLog + 1000) >= Date.now())
        return;
    if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId))
        return;
    if (playerInteractionMap.get(player.id))
        return;
    playerInteractionMap.set(player.id, true);
    const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
    const enchantments = currentHeldAxe?.getComponent(ItemEnchantsComponent.componentId)?.enchantments;
    const level = enchantments.hasEnchantment('unbreaking');
    const currentDurability = itemDurability.damage;
    const maxDurability = itemDurability.maxDurability;
    const unbreakingMultiplier = (100 / (level + 1)) / 100;
    const unbreakingDamage = durabilityDamagePerBlock * unbreakingMultiplier;
    const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
    getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1).then(async (treeCollected) => {
        const totalDamage = (treeCollected.size) * unbreakingDamage;
        const totalDurabilityConsumed = currentDurability + totalDamage;
        const canBeChopped = (totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability);
        const inspectionForm = new ActionFormData()
            .title("LOG INFORMATION")
            .button(`HAS ${treeCollected.size}${canBeChopped ? "" : "+"} LOG/S`, "textures/InfoUI/blocks.png")
            .button(`DMG: ${currentDurability}`, "textures/InfoUI/axe_durability.png")
            .button(`MAX: ${maxDurability}`, "textures/InfoUI/required_durability.png")
            .button(`§l${canBeChopped ? "§aChoppable" : "§cCannot be chopped"}`, "textures/InfoUI/canBeCut.png");
        forceShow(player, inspectionForm).then((response) => {
            playerInteractionMap.set(player.id, false);
            if (response.canceled || response.selection === undefined || response.cancelationReason === FormCancelationReason.UserClosed)
                return;
        }).catch((error) => {
            console.warn("Form Error: ", error, error.stack);
        });
    }).catch((error) => {
        console.warn("Tree Error: ", error, error.stack);
        playerInteractionMap.set(player.id, false);
    });
});
async function treeCut(player, dimension, location, blockTypeId) {
    const equipment = player.getComponent(EntityEquipmentInventoryComponent.componentId);
    const currentHeldAxe = equipment.getEquipment(EquipmentSlot.mainhand);
    if (!axeEquipments.includes(currentHeldAxe?.typeId))
        return;
    if (!isLogIncluded(blockTypeId))
        return;
    const isSurvivalMode = isGameModeSurvival(player);
    if (!isSurvivalMode)
        return;
    if (isSurvivalMode)
        currentHeldAxe.lockMode = ItemLockMode.slot;
    const itemDurability = currentHeldAxe.getComponent('minecraft:durability');
    const enchantments = currentHeldAxe.getComponent('minecraft:enchantments').enchantments;
    const level = enchantments.hasEnchantment('unbreaking');
    const unbreakingMultiplier = (100 / (level + 1)) / 100;
    const unbreakingDamage = durabilityDamagePerBlock * unbreakingMultiplier;
    const visited = await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage);
    const totalDamage = visited.size * unbreakingDamage;
    const totalDurabilityConsumed = itemDurability.damage + totalDamage;
    if (totalDurabilityConsumed + 1 === itemDurability.maxDurability) {
        equipment.setEquipment(EquipmentSlot.mainhand, undefined);
    }
    else if (totalDurabilityConsumed > itemDurability.maxDurability) {
        currentHeldAxe.lockMode = ItemLockMode.none;
        return;
    }
    else if (totalDurabilityConsumed < itemDurability.maxDurability) {
        itemDurability.damage = itemDurability.damage + totalDamage;
        currentHeldAxe.lockMode = ItemLockMode.none;
        equipment.setEquipment(EquipmentSlot.mainhand, currentHeldAxe.clone());
    }
    for await (const group of groupAdjacentBlocks(visited)) {
        const firstElement = JSON.parse(group[0]);
        const lastElement = JSON.parse(group[group.length - 1]);
        if (firstElement === lastElement) {
            dimension.getBlock(firstElement).setType(MinecraftBlockTypes.air);
            continue;
        }
        else {
            dimension.fillBlocks(firstElement, lastElement, MinecraftBlockTypes.air);
        }
    }
    for await (const group of stackDistribution(visited.size)) {
        dimension.spawnItem(new ItemStack(blockTypeId, group), location);
    }
}
function isLogIncluded(blockTypeId) {
    if (excludedLog.includes(blockTypeId) || blockTypeId.includes('stripped_'))
        return false;
    if (includedLog.includes(blockTypeId) || validLogBlocks.test(blockTypeId))
        return true;
    return false;
}
async function getTreeLogs(dimension, location, blockTypeId, maxNeeded) {
    const visited = new Set();
    let queue = getBlockNear(dimension, location);
    while (queue.length > 0) {
        if (visited.size >= chopLimit) {
            console.warn(`Limit: ${visited.size}`);
            return visited;
        }
        if (visited.size >= maxNeeded)
            return visited;
        const _block = queue.shift();
        if (!_block || !isLogIncluded(_block?.typeId))
            continue;
        if (_block.typeId !== blockTypeId)
            continue;
        const pos = JSON.stringify(_block.location);
        if (visited.has(pos))
            continue;
        visited.add(pos);
        queue.push(...getBlockNear(dimension, _block.location));
    }
    queue = [];
    return visited;
}
function groupAdjacentBlocks(visited) {
    const array = Array.from(visited).map(item => JSON.parse(item));
    array.sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y);
    const groups = [];
    let currentGroup = [];
    for (let i = 0; i < array.length; i++) {
        if (i === 0 || (array[i].x === array[i - 1].x && array[i].z === array[i - 1].z && Math.abs(array[i].y - JSON.parse(currentGroup[currentGroup.length - 1]).y) <= 2)) {
            currentGroup.push(JSON.stringify(array[i]));
        }
        else {
            groups.push(currentGroup);
            currentGroup = [JSON.stringify(array[i])];
        }
    }
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }
    return groups;
}
function stackDistribution(number, groupSize = 64) {
    const fullGroupsCount = Math.floor(number / groupSize);
    const remainder = number % groupSize;
    const groups = new Array(fullGroupsCount).fill(groupSize);
    if (remainder > 0) {
        groups.push(remainder);
    }
    return groups;
}
function isGameModeSurvival(player) {
    return player.dimension.getPlayers({ gameMode: GameMode.survival, name: player.name, location: player.location, maxDistance: 1, closest: 1 }).length > 0;
}
function getBlockNear(dimension, location, radius = 1) {
    const centerX = location.x;
    const centerY = location.y;
    const centerZ = location.z;
    const positions = [];
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                const _location = { x, y, z };
                const _block = dimension.getBlock(_location);
                if (_block.isAir())
                    continue;
                positions.push(_block);
            }
        }
    }
    return positions;
}
async function forceShow(player, form, timeout = Infinity) {
    const startTick = system.currentTick;
    while ((system.currentTick - startTick) < timeout) {
        const response = await (form.show(player)).catch(er => console.error(er, er.stack));
        if (response.cancelationReason !== FormCancelationReason.UserBusy) {
            return response;
        }
    }
    ;
    throw new Error(`Timed out after ${timeout} ticks`);
}
