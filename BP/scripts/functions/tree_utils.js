import { EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, system } from "@minecraft/server";
import { MinecraftBlockTypes, MinecraftEnchantmentTypes } from "../modules/vanilla-types/index";
import { validLogBlocks, axeEquipments, stackDistribution, serverConfigurationCopy } from "../index";
function treeCut(player, dimension, location, blockTypeId) {
    const equipment = player.getComponent(EntityEquippableComponent.componentId);
    const currentHeldAxe = equipment.getEquipment(EquipmentSlot.Mainhand);
    if (!axeEquipments.includes(currentHeldAxe?.typeId))
        return;
    if (!player.isSurvival())
        return;
    if (player.isSurvival())
        currentHeldAxe.lockMode = ItemLockMode.slot;
    const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
    const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
    const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
    const unbreakingMultiplier = (100 / (level + 1)) / 100;
    const unbreakingDamage = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
    system.run(async () => {
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
        for (const visitedLogLocation of visited) {
            system.run(() => dimension.setBlockType(JSON.parse(visitedLogLocation), MinecraftBlockTypes.Air));
        }
        system.runTimeout(() => {
            for (const group of stackDistribution(visited.size)) {
                system.run(() => dimension.spawnItem(new ItemStack(blockTypeId, group), location));
            }
        }, 5);
    });
}
function isLogIncluded(blockTypeId) {
    if (serverConfigurationCopy.excludedLog.values.includes(blockTypeId) || blockTypeId.includes('stripped_'))
        return false;
    if (serverConfigurationCopy.includedLog.values.includes(blockTypeId) || validLogBlocks.test(blockTypeId))
        return true;
    return false;
}
function getTreeLogs(dimension, location, blockTypeId, maxNeeded) {
    return new Promise((resolve) => {
        const traversingTreeInterval = system.runJob(function* () {
            const visited = new Set();
            let queue = getBlockNearInitialize(dimension, location);
            while (queue.length > 0) {
                if (visited.size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || visited.size >= maxNeeded) {
                    system.clearJob(traversingTreeInterval);
                    resolve(visited);
                }
                const _block = queue.shift();
                if (!_block?.isValid() || !isLogIncluded(_block?.typeId))
                    continue;
                if (_block.typeId !== blockTypeId)
                    continue;
                const pos = JSON.stringify(_block.location);
                if (visited.has(pos))
                    continue;
                visited.add(pos);
                for (const block of getBlockNear(dimension, _block.location)) {
                    queue.push(block);
                    yield;
                }
                yield;
            }
            queue = [];
            system.clearJob(traversingTreeInterval);
            resolve(visited);
        }());
    });
}
function* getBlockNear(dimension, location, radius = 1) {
    const centerX = location.x;
    const centerY = location.y;
    const centerZ = location.z;
    let _block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if (centerX === x && centerY === y && centerZ === z)
                    continue;
                _block = dimension.getBlock({ x, y, z });
                if (_block.isAir)
                    continue;
                yield _block;
            }
        }
    }
}
function getBlockNearInitialize(dimension, location, radius = 1) {
    const centerX = location.x;
    const centerY = location.y;
    const centerZ = location.z;
    const blocks = [];
    let _block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if (centerX === x && centerY === y && centerZ === z)
                    continue;
                _block = dimension.getBlock({ x, y, z });
                if (_block.isAir)
                    continue;
                blocks.push(_block);
            }
        }
    }
    return blocks;
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
