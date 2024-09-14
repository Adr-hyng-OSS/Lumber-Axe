import { system } from "@minecraft/server";
import { validLogBlocks, serverConfigurationCopy } from "../index";
import { Graph } from "utils/graph";
function isLogIncluded(blockTypeId) {
    if (serverConfigurationCopy.excludedLog.values.includes(blockTypeId) || blockTypeId.includes('stripped_'))
        return false;
    if (serverConfigurationCopy.includedLog.values.includes(blockTypeId) || validLogBlocks.test(blockTypeId))
        return true;
    return false;
}
function getTreeLogs(dimension, location, blockTypeId, maxNeeded, shouldSpawnOutline = true) {
    return new Promise((resolve) => {
        const graph = new Graph();
        const blockOutlines = [];
        const yOffsets = new Map();
        let queue = [];
        const visited = new Set();
        const traversingTreeInterval = system.runJob(function* () {
            const firstBlock = dimension.getBlock(location);
            queue.push(firstBlock);
            graph.addNode(firstBlock.location);
            visited.add(JSON.stringify(firstBlock.location));
            let _len = shouldSpawnOutline ? 0 : 1;
            const centroidLog = {
                x: shouldSpawnOutline ? 0 : firstBlock.x,
                y: 0,
                z: shouldSpawnOutline ? 0 : firstBlock.z
            };
            for (let x = location.x - 2; x <= location.x + 2; x++) {
                for (let z = location.z - 2; z <= location.z + 2; z++) {
                    const _neighborBlock = dimension.getBlock({ x: x, y: location.y, z: z });
                    if (!_neighborBlock?.isValid() || !isLogIncluded(_neighborBlock?.typeId))
                        continue;
                    if (_neighborBlock.typeId !== blockTypeId)
                        continue;
                    centroidLog.x += _neighborBlock.x;
                    centroidLog.z += _neighborBlock.z;
                    _len++;
                    yield;
                }
                yield;
            }
            centroidLog.x = (centroidLog.x / _len) + 0.5;
            centroidLog.z = (centroidLog.z / _len) + 0.5;
            yOffsets.set(firstBlock.location.y, false);
            let _topBlock = firstBlock.above();
            while (true) {
                if (!_topBlock?.isValid() || !isLogIncluded(_topBlock?.typeId))
                    break;
                if (_topBlock?.typeId !== blockTypeId)
                    break;
                yOffsets.set(_topBlock.location.y, false);
                _topBlock = _topBlock.above();
                yield;
            }
            while (queue.length > 0) {
                const size = graph.getSize();
                if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || size >= maxNeeded) {
                    system.clearJob(traversingTreeInterval);
                    resolve({ source: graph, blockOutlines });
                    return;
                }
                const block = queue.shift();
                const pos = block.location;
                const mainNode = graph.getNode(pos);
                if (!mainNode)
                    continue;
                const outline = dimension.spawnEntity('yn:block_outline', { x: block.location.x + 0.5, y: block.location.y, z: block.location.z + 0.5 });
                outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                if (shouldSpawnOutline) {
                    outline.triggerEvent('active_outline');
                }
                else {
                    system.waitTicks(1).then(() => {
                        if (yOffsets.has(mainNode.location.y) && !yOffsets.get(mainNode.location.y)) {
                            dimension.spawnParticle('yn:tree_dust', { x: centroidLog.x, y: mainNode.location.y, z: centroidLog.z });
                            yOffsets.set(mainNode.location.y, true);
                        }
                    });
                }
                blockOutlines.push(outline);
                yield;
                for (const neighborBlock of getBlockNear(dimension, block.location)) {
                    if (neighborBlock.typeId !== blockTypeId)
                        continue;
                    const serializedLocation = JSON.stringify(neighborBlock.location);
                    let neighborNode = graph.getNode(neighborBlock.location);
                    if (!neighborNode) {
                        neighborNode = graph.addNode(neighborBlock.location);
                    }
                    if (mainNode.neighbors.has(neighborNode))
                        continue;
                    mainNode.addNeighbor(neighborNode);
                    neighborNode.addNeighbor(mainNode);
                    if (visited.has(serializedLocation))
                        continue;
                    visited.add(serializedLocation);
                    queue.push(neighborBlock);
                    yield;
                }
                yield;
            }
            queue = [];
            system.clearJob(traversingTreeInterval);
            resolve({ source: graph, blockOutlines });
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
                if (!_block?.isValid() || !isLogIncluded(_block?.typeId))
                    continue;
                yield _block;
            }
        }
    }
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
export { isLogIncluded, getTreeLogs };
