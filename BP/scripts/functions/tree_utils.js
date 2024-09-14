import { MolangVariableMap, system } from "@minecraft/server";
import { validLogBlocks, serverConfigurationCopy } from "../index";
import { Graph } from "utils/graph";
function isLogIncluded(blockTypeId) {
    if (serverConfigurationCopy.excludedLog.values.includes(blockTypeId) || blockTypeId.includes('stripped_'))
        return false;
    if (serverConfigurationCopy.includedLog.values.includes(blockTypeId) || validLogBlocks.test(blockTypeId))
        return true;
    return false;
}
async function getTreeLogs(dimension, location, blockTypeId, maxNeeded, shouldSpawnOutline = true) {
    let centroidLog = { x: 0, y: 0, z: 0 };
    let trunkNumberOfBlocks = shouldSpawnOutline ? 0 : 1;
    const visitedTree = new Promise((resolve) => {
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
            centroidLog = {
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
                    trunkNumberOfBlocks++;
                    yield;
                }
                yield;
            }
            centroidLog.x = (centroidLog.x / trunkNumberOfBlocks) + 0.5;
            centroidLog.z = (centroidLog.z / trunkNumberOfBlocks) + 0.5;
            yOffsets.set(firstBlock.location.y, false);
            let _topBlock = firstBlock.above();
            let _bottomBlock = firstBlock.below();
            while (true) {
                const availableAbove = _topBlock?.isValid() && isLogIncluded(_topBlock?.typeId) && _topBlock?.typeId === blockTypeId;
                const availableBelow = _bottomBlock?.isValid() && isLogIncluded(_bottomBlock?.typeId) && _bottomBlock?.typeId === blockTypeId;
                if (!availableAbove && !availableBelow)
                    break;
                if (availableAbove) {
                    yOffsets.set(_topBlock.location.y, false);
                    _topBlock = _topBlock.above();
                }
                if (availableBelow) {
                    yOffsets.set(_bottomBlock.location.y, false);
                    _bottomBlock = _bottomBlock.below();
                }
                yield;
            }
            while (queue.length > 0) {
                const size = graph.getSize();
                if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || size >= maxNeeded) {
                    for (const blockOutline of blockOutlines) {
                        if (blockOutline?.isValid())
                            blockOutline.triggerEvent('not_persistent');
                        yield;
                    }
                    system.clearJob(traversingTreeInterval);
                    resolve({ source: graph, blockOutlines, yOffsets });
                    return;
                }
                const block = queue.shift();
                const pos = block.location;
                const mainNode = graph.getNode(pos);
                if (!mainNode)
                    continue;
                const outline = dimension.spawnEntity('yn:block_outline', { x: block.location.x + 0.5, y: block.location.y, z: block.location.z + 0.5 });
                outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                if (shouldSpawnOutline)
                    outline.triggerEvent('active_outline');
                blockOutlines.push(outline);
                yield;
                for (const neighborBlock of getBlockNear(block)) {
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
            for (const blockOutline of blockOutlines) {
                if (blockOutline?.isValid())
                    blockOutline.triggerEvent('not_persistent');
                yield;
            }
            queue = [];
            system.clearJob(traversingTreeInterval);
            resolve({ source: graph, blockOutlines, yOffsets });
        }());
    });
    const awaitedVisitedTree = await visitedTree;
    if (!shouldSpawnOutline && awaitedVisitedTree.source.getSize() > 1) {
        const trunkYCoordinates = awaitedVisitedTree.yOffsets;
        let i = 0;
        for (const yOffset of trunkYCoordinates) {
            if (i % 2 === 0) {
                await system.waitTicks(3);
                const molang = new MolangVariableMap();
                molang.setFloat('trunk_size', trunkNumberOfBlocks);
                dimension.spawnParticle('yn:tree_dust', { x: centroidLog.x, y: yOffset[0], z: centroidLog.z }, molang);
            }
            awaitedVisitedTree.yOffsets.set(yOffset[0], true);
            i++;
        }
    }
    return awaitedVisitedTree;
}
function* getBlockNear(initialBlock, radius = 1) {
    const centerX = initialBlock.location.x;
    const centerY = initialBlock.location.y;
    const centerZ = initialBlock.location.z;
    let _block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if (centerX === x && centerY === y && centerZ === z)
                    continue;
                _block = initialBlock.dimension.getBlock({ x, y, z });
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
