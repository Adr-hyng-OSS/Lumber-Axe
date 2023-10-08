import { EntityEquippableComponent, EquipmentSlot, ItemLockMode, ItemStack } from "@minecraft/server";
import { MinecraftBlockTypes } from "../modules/vanilla-types/index";
import { validLogBlocks, axeEquipments, stackDistribution, durabilityDamagePerBlock, excludedLog, includedLog, chopLimit } from "../index";
async function treeCut(player, dimension, location, blockTypeId) {
    const equipment = player.getComponent(EntityEquippableComponent.componentId);
    const currentHeldAxe = equipment.getEquipment(EquipmentSlot.Mainhand);
    if (!axeEquipments.includes(currentHeldAxe?.typeId))
        return;
    if (!isLogIncluded(blockTypeId))
        return;
    if (!player.isSurvival())
        return;
    if (player.isSurvival())
        currentHeldAxe.lockMode = ItemLockMode.slot;
    const itemDurability = currentHeldAxe.getComponent('minecraft:durability');
    const enchantments = currentHeldAxe.getComponent('minecraft:enchantments').enchantments;
    const level = enchantments.hasEnchantment('unbreaking');
    const unbreakingMultiplier = (100 / (level + 1)) / 100;
    const unbreakingDamage = durabilityDamagePerBlock * unbreakingMultiplier;
    const visited = await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage);
    const totalDamage = visited.size * unbreakingDamage;
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
    for (const group of groupAdjacentBlocks(visited)) {
        const firstElement = JSON.parse(group[0]);
        const lastElement = JSON.parse(group[group.length - 1]);
        if (firstElement === lastElement) {
            await new Promise((resolve) => {
                dimension.getBlock(firstElement).setType(MinecraftBlockTypes.Air);
                resolve();
            });
            continue;
        }
        else {
            await new Promise((resolve) => {
                dimension.fillBlocks(firstElement, lastElement, MinecraftBlockTypes.Air);
                resolve();
            });
        }
    }
    for (const group of stackDistribution(visited.size)) {
        await new Promise((resolve) => {
            dimension.spawnItem(new ItemStack(blockTypeId, group), location);
            resolve();
        });
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
        if (visited.size >= chopLimit || visited.size >= maxNeeded) {
            return visited;
        }
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
function getBlockNear(dimension, location, radius = 1) {
    const centerX = location.x;
    const centerY = location.y;
    const centerZ = location.z;
    const positions = [];
    let _block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if (centerX === x && centerY === y && centerZ === z)
                    continue;
                _block = dimension.getBlock({ x, y, z });
                if (_block.isAir)
                    continue;
                positions.push(_block);
            }
        }
    }
    return positions;
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
export { treeCut, isLogIncluded, getTreeLogs };
