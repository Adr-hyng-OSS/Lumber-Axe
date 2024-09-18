import { system } from "@minecraft/server";
import { validLogBlocks, serverConfigurationCopy } from "../index";
import { Graph } from "utils/graph";
export function isLogIncluded(blockTypeId) {
    if (serverConfigurationCopy.excludedLog.values.includes(blockTypeId) || blockTypeId.includes('stripped_'))
        return false;
    if (serverConfigurationCopy.includedLog.values.includes(blockTypeId) || validLogBlocks.test(blockTypeId))
        return true;
    return false;
}
export async function getTreeLogs(dimension, location, blockTypeId, maxNeeded, isInspectingTree = true) {
    return new Promise((resolve) => {
        console.warn("RUNNED");
        const graph = new Graph();
        const blockOutlines = [];
        const yOffsets = new Map();
        let queue = [];
        const visited = new Set();
        const traversingTreeInterval = system.runJob(function* () {
            const firstBlock = dimension.getBlock(location);
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
                    if (neighborBlock.typeId !== blockTypeId)
                        continue;
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
            let trunkNumberOfBlocks = isInspectingTree ? 0 : 1;
            let centroidLog = {
                x: isInspectingTree ? 0 : firstBlock.x,
                z: isInspectingTree ? 0 : firstBlock.z
            };
            for (let x = -2; x <= 2; x++) {
                for (let z = -2; z <= 2; z++) {
                    const _neighborBlock = firstBlock.offset({ x: x, y: 0, z: z });
                    if (!_neighborBlock?.isValid() || !isLogIncluded(_neighborBlock?.typeId))
                        continue;
                    if (_neighborBlock.typeId !== blockTypeId)
                        continue;
                    centroidLog.x += _neighborBlock.x;
                    centroidLog.z += _neighborBlock.z;
                    trunkNumberOfBlocks++;
                    yield;
                }
                yield;
            }
            centroidLog.x = (centroidLog.x / trunkNumberOfBlocks) + 0.5;
            centroidLog.z = (centroidLog.z / trunkNumberOfBlocks) + 0.5;
            if (!isInspectingTree) {
                for (const yOffset of yOffsets.keys()) {
                    const outline = dimension.spawnEntity('yn:block_outline', { x: centroidLog.x, y: yOffset, z: centroidLog.z });
                    outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                    blockOutlines.push(outline);
                    yield;
                }
                for (const blockOutline of blockOutlines) {
                    if (blockOutline?.isValid()) {
                        blockOutline.triggerEvent('not_persistent');
                    }
                    yield;
                }
            }
            queue = [];
            system.clearJob(traversingTreeInterval);
            resolve({
                source: graph,
                blockOutlines,
                yOffsets,
                trunk: {
                    size: trunkNumberOfBlocks,
                    centroid: centroidLog
                }
            });
        }());
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
export function getTreeTrunkSize(blockInteracted, blockTypeId) {
    return new Promise((fetchedTrunkSizeResolved) => {
        let i = 0;
        let centroidLog = {
            x: 0,
            z: 0
        };
        const t = system.runJob((function* () {
            for (let x = -2; x <= 2; x++) {
                for (let z = -2; z <= 2; z++) {
                    const _neighborBlock = blockInteracted.offset({ x: x, y: 0, z: z });
                    if (!_neighborBlock?.isValid() || !isLogIncluded(_neighborBlock?.typeId))
                        continue;
                    if (_neighborBlock.typeId !== blockTypeId)
                        continue;
                    centroidLog.x += _neighborBlock.x;
                    centroidLog.z += _neighborBlock.z;
                    i++;
                    yield;
                }
                yield;
            }
            if (i === 0) {
                i = 1;
                centroidLog = blockInteracted.location;
            }
            centroidLog.x = (centroidLog.x / i) + 0.5;
            centroidLog.z = (centroidLog.z / i) + 0.5;
            system.clearJob(t);
            fetchedTrunkSizeResolved({ center: centroidLog, size: i });
        })());
    });
}
