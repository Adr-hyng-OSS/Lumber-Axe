import { system } from "@minecraft/server";
import { serverConfigurationCopy } from "../index";
import { Graph } from "utils/graph";
import { Vec3 } from "utils/VectorUtils";
export function isLogIncluded(rootBlockTypeId, blockTypeId) {
    const validLogBlocks = /(_log|_wood|crimson_stem|warped_stem)$/;
    function extractLogFamily(blockTypeId) {
        const parts = blockTypeId.split('_');
        return parts.slice(0, -1).join('_');
    }
    if (serverConfigurationCopy.excludedLog.values.includes(blockTypeId) || blockTypeId.includes('stripped_'))
        return false;
    const extractedLogFamily = extractLogFamily(rootBlockTypeId);
    const blockFamily = extractLogFamily(blockTypeId);
    const isSameFamily = blockFamily === extractedLogFamily;
    if ((serverConfigurationCopy.includedLog.values.includes(blockTypeId) ||
        validLogBlocks.test(blockTypeId)) && isSameFamily)
        return true;
    return false;
}
export async function getTreeLogs(dimension, location, blockTypeId, maxNeeded, isInspectingTree = true) {
    const firstBlock = dimension.getBlock(location);
    const visitedTree = await new Promise((resolve) => {
        let queue = [];
        const graph = new Graph();
        const yOffsets = new Map();
        const visited = new Set();
        const traversingTreeInterval = system.runJob(function* () {
            queue.push(firstBlock);
            graph.addNode(firstBlock);
            visited.add(JSON.stringify(firstBlock.location));
            while (queue.length > 0) {
                const size = graph.getSize();
                if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || size >= maxNeeded) {
                    break;
                }
                const block = queue.shift();
                const mainNode = graph.getNode(block);
                if (!mainNode)
                    continue;
                yOffsets.set(block.y, false);
                for (const neighborBlock of getBlockNear(block)) {
                    const serializedLocation = JSON.stringify(neighborBlock.location);
                    let neighborNode = graph.getNode(neighborBlock) ?? graph.addNode(neighborBlock);
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
            system.clearJob(traversingTreeInterval);
            resolve({
                source: graph,
                blockOutlines: [],
                yOffsets,
                trunk: {
                    size: 0,
                    center: { x: 0, z: 0 }
                }
            });
        }());
    });
    const blockOutlines = [];
    const trunk = await getTreeTrunkSize(firstBlock, blockTypeId);
    return new Promise((resolve) => {
        const t = system.runJob((function* () {
            console.warn(trunk.center.x, trunk.center.z, trunk.size);
            if (!isInspectingTree) {
                for (const yOffset of visitedTree.yOffsets.keys()) {
                    const outline = dimension.spawnEntity('yn:block_outline', { x: trunk.center.x, y: yOffset, z: trunk.center.z });
                    outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                    blockOutlines.push(outline);
                    yield;
                }
                for (const blockOutline of blockOutlines) {
                    if (blockOutline?.isValid()) {
                        blockOutline.triggerEvent('not_persistent');
                        blockOutline.triggerEvent('active_outline');
                    }
                    yield;
                }
            }
            system.clearJob(t);
            resolve({
                source: visitedTree.source,
                blockOutlines: blockOutlines,
                trunk: trunk,
                yOffsets: visitedTree.yOffsets
            });
            return;
        })());
    });
}
function* getBlockNear(initialBlock, radius = 1) {
    const centerX = 0;
    const centerY = 0;
    const centerZ = 0;
    let _block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if (centerX === x && centerY === y && centerZ === z)
                    continue;
                _block = initialBlock.offset({ x, y, z });
                if (!_block?.isValid() || !isLogIncluded(initialBlock.typeId, _block?.typeId))
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
export function getTreeTrunkSize(blockInteracted, blockTypeId) {
    return new Promise((fetchedTrunkSizeResolved) => {
        let i = 0;
        let centroidLog = {
            x: 0,
            z: 0
        };
        const visited = new Set();
        const queue = [blockInteracted];
        const t = system.runJob((function* () {
            while (queue.length > 0) {
                const currentBlock = queue.shift();
                if ((!currentBlock || !currentBlock.isValid()) && !Vec3.equals(blockInteracted, currentBlock))
                    continue;
                const blockKey = JSON.stringify({ x: currentBlock.x, z: currentBlock.z });
                if (visited.has(blockKey))
                    continue;
                visited.add(blockKey);
                centroidLog.x += currentBlock.x;
                centroidLog.z += currentBlock.z;
                i++;
                for (let y = -1; y <= 1; y++) {
                    for (let x = -1; x <= 1; x++) {
                        for (let z = -1; z <= 1; z++) {
                            if (x === 0 && z === 0 && y === 0)
                                continue;
                            const neighborBlock = currentBlock.offset({ x: x, y: y, z: z });
                            const neighborLoc = JSON.stringify({ x: neighborBlock.x, z: neighborBlock.z });
                            if (!neighborBlock?.isValid() || visited.has(neighborLoc) || !isLogIncluded(blockTypeId, neighborBlock.typeId))
                                continue;
                            queue.push(neighborBlock);
                            yield;
                        }
                        yield;
                    }
                    yield;
                }
                yield;
            }
            if (i <= 1) {
                i = 1;
                centroidLog = blockInteracted.center();
            }
            else {
                centroidLog.x = (centroidLog.x / i) + 0.5;
                centroidLog.z = (centroidLog.z / i) + 0.5;
            }
            system.clearJob(t);
            fetchedTrunkSizeResolved({ center: centroidLog, size: i });
            return;
        })());
    });
}
