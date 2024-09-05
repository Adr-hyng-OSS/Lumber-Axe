import { Block, Dimension, Entity, Vector3, system } from "@minecraft/server";

import { validLogBlocks, serverConfigurationCopy, VisitedBlockResult } from "../index";
import { Graph } from "utils/graph";

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
        const firstBlock = dimension.getBlock(location);
        queue.push(firstBlock);
        graph.addNode(firstBlock.location);

        console.warn("ASDASD");

        const traversingTreeInterval: number = system.runJob(function* () {
            while (queue.length > 0) {
                // Get the graph size
                const size = graph.getSize();

                // Check termination conditions
                if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || size >= maxNeeded) {
                    system.clearJob(traversingTreeInterval);
                    resolve({ source: graph, blockOutlines });
                    return;
                }

                // Dequeue the block and check if it's valid and not already visited
                const block: Block = queue.shift();
                // if (!block?.isValid() || !isLogIncluded(block?.typeId)) continue;
                // if (block.typeId !== blockTypeId) continue;

                const pos = block.location;

                // Add the block as a new node in the graph
                const node = graph.getNode(pos);
                if(!node) continue;

                // Spawn the block outline for visualization (optional)
                if(shouldSpawnOutline) {
                    const outline = dimension.spawnEntity('yn:block_outline', { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.5 });
                    outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                    blockOutlines.push(outline);
                }

                yield;

                // Get the neighbors and connect to main node.
                for (const neighborBlock of getBlockNear(dimension, block.location)) {
                    if (!neighborBlock?.isValid() || !isLogIncluded(neighborBlock?.typeId)) continue;
                    if (neighborBlock.typeId !== blockTypeId) continue;
                    if (graph.getNode(neighborBlock.location)) continue;
                    const neighborNode = graph.addNode(neighborBlock.location);
                    node.addNeighbor(neighborNode);
                    neighborNode.addNeighbor(node);
                    

                    // Get the neighbor's neighbor, and add to queue.

                    // Add the neighbor to the queue for further processing
                    queue.push(neighborBlock);
                    yield;
                }

                yield;
            }

            // Clear the queue and finish
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