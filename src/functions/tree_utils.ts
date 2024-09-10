import { Block, Dimension, Entity, Vector3, system } from "@minecraft/server";

import { validLogBlocks, serverConfigurationCopy, VisitedBlockResult } from "../index";
import { Graph, GraphNode } from "utils/graph";
import { world } from "@minecraft/server";
import { MinecraftEffectTypes } from "modules/vanilla-types/index";

function isLogIncluded(blockTypeId: string): boolean {
    if(serverConfigurationCopy.excludedLog.values.includes(blockTypeId) || blockTypeId.includes('stripped_')) return false;
    if(serverConfigurationCopy.includedLog.values.includes(blockTypeId) || validLogBlocks.test(blockTypeId)) return true;
    return false;
}


function getTreeLogs(dimension: Dimension, location: Vector3, blockTypeId: string, maxNeeded: number, shouldSpawnOutline: boolean = true): Promise<VisitedBlockResult> {
    return new Promise<VisitedBlockResult>((resolve) => {
        const graph = new Graph();
        const blockOutlines: Entity[] = [];

        let queue: Block[] = [];
        const visited = new Set<string>(); // To track visited locations

        const firstBlock = dimension.getBlock(location);
        queue.push(firstBlock);
        graph.addNode(firstBlock.location);
        visited.add(JSON.stringify(firstBlock.location)); // Mark a+s visited

        const traversingTreeInterval: number = system.runJob(function* () {
            while (queue.length > 0) {
                const size = graph.getSize();

                // Check termination conditions
                if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || size >= maxNeeded) {
                    system.clearJob(traversingTreeInterval);
                    resolve({ source: graph, blockOutlines });
                    return;
                }

                const block: Block = queue.shift();
                const pos = block.location;

                const mainNode = graph.getNode(pos);
                if (!mainNode) continue;

                const outline = dimension.spawnEntity('yn:block_outline', { x: block.location.x + 0.5, y: block.location.y, z: block.location.z + 0.5 });
                outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                if (shouldSpawnOutline) {
                    outline.triggerEvent('active_outline');
                } else {
                    system.waitTicks(1).then(() => {
                        outline.playAnimation('animation.block_outline.spawn_particle');
                    });
                }
                blockOutlines.push(outline);
                yield;

                // First, gather all valid neighbors
                for (const neighborBlock of getBlockNear(dimension, block.location)) {
                    if (!neighborBlock?.isValid() || !isLogIncluded(neighborBlock?.typeId)) continue;
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

            queue = [];
            system.clearJob(traversingTreeInterval);
            resolve({ source: graph, blockOutlines });
        }());
    });
}



function* getBlockNear(dimension: Dimension, location: Vector3, radius: number = 1): Generator<Block, any, unknown> {
    const centerX: number = location.x;
    const centerY: number = location.y;
    const centerZ: number = location.z;
    let _block: Block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if (centerX === x && centerY === y && centerZ === z) continue;
                _block = dimension.getBlock({ x, y, z });
                if (_block.isAir) continue;
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