import { system } from "@minecraft/server";
import { serverConfigurationCopy, originalDatabase, hashBlock } from "../index";
import { Graph } from "utils/graph";
import { Vec3 } from "utils/VectorUtils";
export function isLogIncluded(rootBlockTypeId, blockTypeId) {
    const validLogBlocks = /(_log|_wood|crimson_stem|warped_stem|(?:brown|red_)?mushroom_block)$/;
    function extractLogFamily(blockTypeId) {
        const [, cleanedBlockTypeId] = blockTypeId.split(':');
        const parts = cleanedBlockTypeId.split('_');
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
        const graph = new Graph();
        const visitedTypeIDs = new Map();
        const queue = [firstBlock];
        const yOffsets = new Map();
        const visited = new Set([JSON.stringify(firstBlock.location)]);
        visitedTypeIDs.set(blockTypeId, 0);
        const traversingTreeInterval = system.runJob(function* () {
            graph.addNode(firstBlock);
            originalDatabase.set(`visited_${hashBlock(firstBlock)}`, isInspectingTree);
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
                for (const neighborBlock of getBlockNear(blockTypeId, block)) {
                    const serializedLocation = JSON.stringify(neighborBlock.location);
                    let neighborNode = graph.getNode(neighborBlock) ?? graph.addNode(neighborBlock);
                    originalDatabase.set(`visited_${hashBlock(neighborBlock)}`, isInspectingTree);
                    if (mainNode.neighbors.has(neighborNode))
                        continue;
                    mainNode.addNeighbor(neighborNode);
                    neighborNode.addNeighbor(mainNode);
                    if (visited.has(serializedLocation))
                        continue;
                    visited.add(serializedLocation);
                    queue.push(neighborBlock);
                    let currentAmount = visitedTypeIDs.get(neighborBlock.typeId) ?? 0;
                    currentAmount += 1;
                    visitedTypeIDs.set(neighborBlock.typeId, currentAmount);
                    yield;
                }
                yield;
            }
            system.clearJob(traversingTreeInterval);
            resolve({
                source: graph,
                blockOutlines: [],
                yOffsets,
                typeIds: visitedTypeIDs,
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
            for (const yOffset of visitedTree.yOffsets.keys()) {
                const outline = dimension.spawnEntity('yn:block_outline', {
                    x: trunk.center.x,
                    y: yOffset,
                    z: trunk.center.z
                });
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
            system.clearJob(t);
            resolve({
                typeIds: visitedTree.typeIds,
                source: visitedTree.source,
                blockOutlines: blockOutlines,
                trunk: trunk,
                yOffsets: visitedTree.yOffsets
            });
            return;
        })());
    });
}
function* getBlockNear(initialBlockTypeID, initialBlock, radius = 1) {
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
                if (!_block?.isValid() || !isLogIncluded(initialBlockTypeID, _block?.typeId))
                    continue;
                yield _block;
            }
        }
    }
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
        const originalY = blockInteracted.y;
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
                    const newY = currentBlock.y + y;
                    if (newY < originalY - 2 || newY > originalY + 2)
                        continue;
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
