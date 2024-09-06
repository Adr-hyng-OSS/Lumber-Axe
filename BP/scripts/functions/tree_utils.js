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
        let queue = [];
        const visited = new Set();
        const firstBlock = dimension.getBlock(location);
        queue.push(firstBlock);
        graph.addNode(firstBlock.location);
        visited.add(JSON.stringify(firstBlock.location));
        const traversingTreeInterval = system.runJob(function* () {
            while (queue.length > 0) {
                const size = graph.getSize();
                if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || size >= maxNeeded) {
                    system.clearJob(traversingTreeInterval);
                    resolve({ source: graph, blockOutlines });
                    return;
                }
                const block = queue.shift();
                const pos = block.location;
                const node = graph.getNode(pos);
                if (!node)
                    continue;
                if (shouldSpawnOutline) {
                    const outline = dimension.spawnEntity('yn:block_outline', { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.5 });
                    outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                    blockOutlines.push(outline);
                }
                yield;
                const neighborNodes = [];
                for (const neighborBlock of getBlockNear(dimension, block.location)) {
                    if (!neighborBlock?.isValid() || !isLogIncluded(neighborBlock?.typeId))
                        continue;
                    if (neighborBlock.typeId !== blockTypeId)
                        continue;
                    const serializedLocation = JSON.stringify(neighborBlock.location);
                    if (visited.has(serializedLocation))
                        continue;
                    let neighborNode = graph.getNode(neighborBlock.location);
                    if (!neighborNode) {
                        neighborNode = graph.addNode(neighborBlock.location);
                    }
                    node.addNeighbor(neighborNode);
                    neighborNode.addNeighbor(node);
                    neighborNodes.push(neighborNode);
                    visited.add(serializedLocation);
                    queue.push(neighborBlock);
                    yield;
                }
                for (let i = 0; i < neighborNodes.length; i++) {
                    for (let j = i + 1; j < neighborNodes.length; j++) {
                        const nodeA = neighborNodes[i];
                        const nodeB = neighborNodes[j];
                        nodeA.addNeighbor(nodeB);
                        nodeB.addNeighbor(nodeA);
                    }
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
                if (_block.isAir)
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
