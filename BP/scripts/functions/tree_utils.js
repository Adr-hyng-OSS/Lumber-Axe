import { EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, system } from "@minecraft/server";
import { MinecraftBlockTypes, MinecraftEnchantmentTypes } from "../modules/vanilla-types/index";
import { validLogBlocks, axeEquipments, stackDistribution, SERVER_CONFIGURATION } from "../index";
async function treeCut(player, dimension, location, blockTypeId, blocksVisited) {
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
    const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
    const enchantments = (currentHeldAxe.getComponent(ItemEnchantableComponent.componentId));
    const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
    const unbreakingMultiplier = (100 / (level + 1)) / 100;
    const unbreakingDamage = SERVER_CONFIGURATION.durabilityDamagePerBlock * unbreakingMultiplier;
    let visited = [];
    let groupedBlocks = [];
    const filteredVisited = [...blocksVisited.filter(block => isLogIncluded(block?.typeId))];
    let finalVisits = new Set();
    if (filteredVisited.length) {
        visited = filteredVisited;
    }
    else {
        visited = await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage);
    }
    for (const group of groupAdjacentBlocks(finalVisits)) {
        const firstElement = JSON.parse(group[0]);
        const lastElement = JSON.parse(group[group.length - 1]);
        groupedBlocks.push([firstElement, lastElement]);
    }
    const totalDamage = visited.length * unbreakingDamage;
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
    const breakBlocksGeneratorID = system.runJob(breakBlocksGenerator());
    function* breakBlocksGenerator() {
        try {
            for (const group of groupedBlocks) {
                const firstElement = group[0];
                const lastElement = group[group.length - 1];
                if (firstElement === lastElement) {
                    dimension.getBlock(firstElement)?.setType(MinecraftBlockTypes.Air);
                    yield;
                    continue;
                }
                else {
                    dimension.fillBlocks(firstElement, lastElement, MinecraftBlockTypes.Air);
                    yield;
                }
            }
            for (const stack of stackDistribution(visited.length)) {
                dimension.spawnItem(new ItemStack(blockTypeId, stack), location);
                yield;
            }
        }
        catch (error) {
            console.warn(error);
            system.clearJob(breakBlocksGeneratorID);
        }
    }
}
async function getTreeLogs(dimension, location, blockTypeId, maxNeeded) {
    let visited = new Set();
    let visitedBlocks = [];
    const visitedLocations = new Set();
    visitedLocations.add(JSON.stringify(location));
    function* getBlockNear(dimension, location, radius = 1) {
        const originalX = location.x;
        const originalY = location.y;
        const originalZ = location.z;
        for (let x = originalX - radius; x <= originalX + radius; x++) {
            for (let y = originalY - radius; y <= originalY + radius; y++) {
                for (let z = originalZ - radius; z <= originalZ + radius; z++) {
                    const newLoc = { x, y, z };
                    const parsedLoc = JSON.stringify(newLoc);
                    if (visitedLocations.has(parsedLoc))
                        continue;
                    visitedLocations.add(parsedLoc);
                    const _block = dimension.getBlock(newLoc);
                    yield _block;
                }
            }
        }
    }
    function* traverseTree() {
        let fetchBlockGenerator = getBlockNear(dimension, location);
        let nextIteration = fetchBlockGenerator.next();
        let _block;
        let queue = [];
        while (!nextIteration.done || queue.length > 0) {
            if (visited.size >= SERVER_CONFIGURATION.chopLimit || visited.size >= maxNeeded) {
                break;
            }
            if (nextIteration.done) {
                const newLoc = queue.shift();
                fetchBlockGenerator = getBlockNear(dimension, newLoc);
                nextIteration = fetchBlockGenerator.next();
                _block = nextIteration.value;
                nextIteration = fetchBlockGenerator.next();
            }
            else {
                _block = nextIteration.value;
                nextIteration = fetchBlockGenerator.next();
            }
            if (!_block?.isValid() || !isLogIncluded(_block?.typeId))
                continue;
            if (_block.typeId !== blockTypeId)
                continue;
            const pos = JSON.stringify(_block.location);
            if (visited.has(pos))
                continue;
            visited.add(pos);
            visitedBlocks.push(_block);
            queue.push(_block.location);
            yield;
        }
    }
    const t = traverseTree();
    const x = system.runJob(t);
    let awaitResolve;
    return new Promise((resolve) => {
        awaitResolve = system.runJob((function* () {
            while (!t.next().done) { }
            system.clearJob(awaitResolve);
            system.clearJob(x);
            resolve(visitedBlocks);
        })());
    });
}
function isLogIncluded(blockTypeId) {
    if (SERVER_CONFIGURATION.excludedLog.includes(blockTypeId) || blockTypeId.includes('stripped_'))
        return false;
    if (SERVER_CONFIGURATION.includedLog.includes(blockTypeId) || validLogBlocks.test(blockTypeId))
        return true;
    return false;
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
