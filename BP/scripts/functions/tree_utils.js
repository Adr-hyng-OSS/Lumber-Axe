import { EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, system } from "@minecraft/server";
import { MinecraftEnchantmentTypes } from "../modules/vanilla-types/index";
import { validLogBlocks, axeEquipments, serverConfigurationCopy } from "../index";
function treeCut(player, dimension, location, blockTypeId) {
    const equipment = player.getComponent(EntityEquippableComponent.componentId);
    const currentHeldAxe = equipment.getEquipment(EquipmentSlot.Mainhand);
    if (!axeEquipments.includes(currentHeldAxe?.typeId))
        return;
    if (player.isSurvival())
        currentHeldAxe.lockMode = ItemLockMode.slot;
    const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
    const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
    const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
    const unbreakingMultiplier = (100 / (level + 1)) / 100;
    const unbreakingDamage = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
    system.run(async () => {
        const visited = (await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage)).graph;
        const size = visited.getSize();
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
        const graph = new Graph();
        const blockOutlines = [];
        let queue = [];
        const firstBlock = dimension.getBlock(location);
        queue.push(firstBlock);
        graph.addNode(firstBlock.location);
        const traversingTreeInterval = system.runJob(function* () {
            while (queue.length > 0) {
                const size = graph.getSize();
                if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || size >= maxNeeded) {
                    system.clearJob(traversingTreeInterval);
                    resolve({ graph, blockOutlines });
                    return;
                }
                const block = queue.shift();
                const pos = block.location;
                const node = graph.getNode(pos);
                if (!node)
                    continue;
                blockOutlines.push(dimension.spawnEntity('yn:block_outline', { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.5 }));
                yield;
                for (const neighborBlock of getBlockNear(dimension, block.location)) {
                    if (!neighborBlock?.isValid() || !isLogIncluded(neighborBlock?.typeId))
                        continue;
                    if (neighborBlock.typeId !== blockTypeId)
                        continue;
                    if (graph.getNode(neighborBlock.location))
                        continue;
                    const neighborNode = graph.addNode(neighborBlock.location);
                    node.addNeighbor(neighborNode);
                    neighborNode.addNeighbor(node);
                    queue.push(neighborBlock);
                    yield;
                }
                yield;
            }
            queue = [];
            system.clearJob(traversingTreeInterval);
            resolve({ graph, blockOutlines });
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
class GraphNode {
    constructor(location) {
        this.location = location;
        this.neighbors = new Set();
    }
    addNeighbor(node) {
        this.neighbors.add(node);
    }
    removeNeighbor(node) {
        this.neighbors.delete(node);
    }
}
class Graph {
    constructor() {
        this.nodes = new Map();
    }
    getNode(location) {
        return this.nodes.get(this.serializeLocation(location));
    }
    addNode(location) {
        const key = this.serializeLocation(location);
        let node = this.nodes.get(key);
        if (!node) {
            node = new GraphNode(location);
            this.nodes.set(key, node);
        }
        return node;
    }
    removeNode(location) {
        const key = this.serializeLocation(location);
        const node = this.nodes.get(key);
        if (node) {
            node.neighbors.forEach(neighbor => {
                neighbor.removeNeighbor(node);
            });
            this.nodes.delete(key);
        }
    }
    serializeLocation(location) {
        return JSON.stringify(location);
    }
    getSize() {
        return this.nodes.size;
    }
}
export { treeCut, isLogIncluded, getTreeLogs };
