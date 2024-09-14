import { Block, BlockVolumeBase, Dimension, Entity, MolangVariableMap, Vector3, system } from "@minecraft/server";

import { validLogBlocks, serverConfigurationCopy, VisitedBlockResult } from "../index";
import { Graph, GraphNode } from "utils/graph";
import { world } from "@minecraft/server";
import { MinecraftEffectTypes } from "modules/vanilla-types/index";
import { Vec3 } from "utils/VectorUtils";

function isLogIncluded(blockTypeId: string): boolean {
    if(serverConfigurationCopy.excludedLog.values.includes(blockTypeId) || blockTypeId.includes('stripped_')) return false;
    if(serverConfigurationCopy.includedLog.values.includes(blockTypeId) || validLogBlocks.test(blockTypeId)) return true;
    return false;
}


async function getTreeLogs(
    dimension: Dimension, 
    location: Vector3, 
    blockTypeId: string, 
    maxNeeded: number, 
    shouldSpawnOutline: boolean = true
): Promise<VisitedBlockResult> {
    let centroidLog: Vector3 = {x: 0, y: 0, z: 0};
    let trunkNumberOfBlocks: number = shouldSpawnOutline ? 0 : 1;
    const visitedTree = new Promise<VisitedBlockResult>((resolve) => {
        const graph = new Graph();
        const blockOutlines: Entity[] = [];
        const yOffsets: Map<number, boolean> = new Map();

        let queue: Block[] = [];
        const visited = new Set<string>(); // To track visited locations

        const traversingTreeInterval: number = system.runJob(function* () {
            const firstBlock = dimension.getBlock(location);
            queue.push(firstBlock);
            graph.addNode(firstBlock.location);
            visited.add(JSON.stringify(firstBlock.location));

            // Should spawn outline is indicator for inspection or breaking tree.
            // Inspection = True
            // Breaking = False

            // Gets the center of the trunk.
            centroidLog = {
                x: shouldSpawnOutline ? 0 : firstBlock.x, 
                y: 0, 
                z: shouldSpawnOutline ? 0 : firstBlock.z
            };
            for (let x = location.x - 2; x <= location.x + 2; x++) {
                for (let z = location.z - 2; z <= location.z + 2; z++) {
                    const _neighborBlock = dimension.getBlock({ x: x, y: location.y, z: z });
                    if (!_neighborBlock?.isValid() || !isLogIncluded(_neighborBlock?.typeId)) continue;
                    if (_neighborBlock.typeId !== blockTypeId) continue;
                    centroidLog.x += _neighborBlock.x;
                    centroidLog.z += _neighborBlock.z;
                    trunkNumberOfBlocks++;
                    yield;
                }
                yield;
            }
            centroidLog.x = (centroidLog.x / trunkNumberOfBlocks) + 0.5;
            centroidLog.z = (centroidLog.z / trunkNumberOfBlocks) + 0.5;

            // Get the most bottom block, and the top most block.
            yOffsets.set(firstBlock.location.y, false);
            let _topBlock = firstBlock.above();
            let _bottomBlock = firstBlock.below();
            while(true) {
                const availableAbove = _topBlock?.isValid() && isLogIncluded(_topBlock?.typeId) && _topBlock?.typeId === blockTypeId;
                const availableBelow = _bottomBlock?.isValid() && isLogIncluded(_bottomBlock?.typeId) && _bottomBlock?.typeId === blockTypeId;
                if(!availableAbove && !availableBelow) break;
                if(availableAbove) {
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

                // Check termination conditions
                if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || size >= maxNeeded) {
                    // After all is traversed, start timer.
                    for(const blockOutline of blockOutlines) {
                        if(blockOutline?.isValid()) blockOutline.triggerEvent('not_persistent');
                        yield;
                    }
                    system.clearJob(traversingTreeInterval);
                    resolve({ source: graph, blockOutlines, yOffsets });
                    return;
                }

                const block: Block = queue.shift();
                const pos = block.location;

                const mainNode = graph.getNode(pos);
                if (!mainNode) continue;

                // VFX
                //! Stop creating entity if there's already an entity
                const outline = dimension.spawnEntity('yn:block_outline', { x: block.location.x + 0.5, y: block.location.y, z: block.location.z + 0.5 });
                outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                if (shouldSpawnOutline) outline.triggerEvent('active_outline');
                blockOutlines.push(outline);
                yield;

                // First, gather all valid neighbors
                for (const neighborBlock of getBlockNear(block)) {
                    if (neighborBlock.typeId !== blockTypeId) continue;
                    const serializedLocation = JSON.stringify(neighborBlock.location);
                    
                    let neighborNode = graph.getNode(neighborBlock.location);
                    if (!neighborNode) {
                        neighborNode = graph.addNode(neighborBlock.location);
                    }
                    
                    // It should check if this neighbor of main node is already a neighbor, if yes, then continue.
                    if(mainNode.neighbors.has(neighborNode)) continue;
                    
                    // Connect the current node to its neighbor
                    mainNode.addNeighbor(neighborNode);
                    neighborNode.addNeighbor(mainNode);

                    // Check if the neighbor node has already been visited
                    if (visited.has(serializedLocation)) continue;
                    
                    // Mark this neighbor as visited and add to the queue for further processing
                    visited.add(serializedLocation);
                    queue.push(neighborBlock);
                    yield;
                }
                yield;
            }

            // After all is traversed, start timer.
            for(const blockOutline of blockOutlines) {
                if(blockOutline?.isValid()) blockOutline.triggerEvent('not_persistent');
                yield;
            }

            queue = [];
            system.clearJob(traversingTreeInterval);
            resolve({ source: graph, blockOutlines, yOffsets });
        }());
    });

    const awaitedVisitedTree = await visitedTree;
    if(!shouldSpawnOutline && awaitedVisitedTree.source.getSize() > 1) {
        const trunkYCoordinates = awaitedVisitedTree.yOffsets;
        let i = 0;
        for(const yOffset of trunkYCoordinates) {
            // Spawn dust every 3 blocks
            if(i % 2 === 0) {
                await system.waitTicks(3);
                const molang = new MolangVariableMap();
                molang.setFloat('trunk_size', trunkNumberOfBlocks);
                dimension.spawnParticle('yn:tree_dust', {x: centroidLog.x, y: yOffset[0], z: centroidLog.z}, molang);
            }
            awaitedVisitedTree.yOffsets.set(yOffset[0], true);
            i++;
        }
    }
    return awaitedVisitedTree;
}



function* getBlockNear(initialBlock: Block, radius: number = 1): Generator<Block, any, unknown> {
    const centerX: number = initialBlock.location.x;
    const centerY: number = initialBlock.location.y;
    const centerZ: number = initialBlock.location.z;
    let _block: Block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if (centerX === x && centerY === y && centerZ === z) continue;
                _block = initialBlock.dimension.getBlock({x, y, z});
                if (!_block?.isValid() || !isLogIncluded(_block?.typeId)) continue;
                yield _block;
            }
        }
    }
}

// Gets all the visited blocks and groups them together.
function groupAdjacentBlocks(visited: Set<string>): string[][] {
    // Author: Adr-hyng <https://github.com/Adr-hyng>
    // Project: https://github.com/Adr-hyng-OSS/Lumber-Axe
    // Convert Set to Array and parse each string to JSON object
    const array = Array.from(visited).map(item => JSON.parse(item));

    // Sort the array based on "x", "z", and "y"
    array.sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y);

    const groups: string[][] = [];
    let currentGroup: string[] = [];

    for (let i = 0; i < array.length; i++) {
        // If it's the first element or "x" and "z" didn't change and "y" difference is less or equal to 2, add it to the current group
        if (i === 0 || (array[i].x === array[i - 1].x && array[i].z === array[i - 1].z && Math.abs(array[i].y - JSON.parse(currentGroup[currentGroup.length - 1]).y) <= 2)) {
            currentGroup.push(JSON.stringify(array[i]));
        } else {
            // Otherwise, add the current group to the groups array and start a new group
            groups.push(currentGroup);
            currentGroup = [JSON.stringify(array[i])];
        }
    }
    // Add the last group to the groups array
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }
    return groups;
}



export {isLogIncluded, getTreeLogs}