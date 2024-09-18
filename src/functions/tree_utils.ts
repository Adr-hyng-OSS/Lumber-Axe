import { Block, Dimension, Entity, Vector3, VectorXZ, system } from "@minecraft/server";

import { validLogBlocks, serverConfigurationCopy, VisitedBlockResult, TrunkBlockResult } from "../index";
import { Graph } from "utils/graph";

export function isLogIncluded(blockTypeId: string): boolean {
    if(serverConfigurationCopy.excludedLog.values.includes(blockTypeId) || blockTypeId.includes('stripped_')) return false;
    if(serverConfigurationCopy.includedLog.values.includes(blockTypeId) || validLogBlocks.test(blockTypeId)) return true;
    return false;
}


export async function getTreeLogs(
    dimension: Dimension, 
    location: Vector3, 
    blockTypeId: string, 
    maxNeeded: number, 
    isInspectingTree: boolean = true
): Promise<VisitedBlockResult> {
    const firstBlock = dimension.getBlock(location);
    const visitedTree = await new Promise<VisitedBlockResult>((resolve) => {
        let queue: Block[] = [];
        const graph = new Graph();
        const yOffsets: Map<number, boolean> = new Map();
        const visited: Set<string> = new Set();
        const traversingTreeInterval: number = system.runJob(function* () {
            queue.push(firstBlock);
            graph.addNode(firstBlock);
            visited.add(JSON.stringify(firstBlock.location));

            // Should spawn outline is indicator for inspection or breaking tree.
            // Inspection = True
            // Breaking = False

            while (queue.length > 0) {
                const size = graph.getSize();

                // Check termination conditions
                if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || size >= maxNeeded) {
                    break;
                }

                const block: Block = queue.shift();
                const mainNode = graph.getNode(block);
                if (!mainNode) continue;
                yOffsets.set(block.y, false);
                
                // First, gather all valid neighbors
                for (const neighborBlock of getBlockNear(block)) {
                    if (neighborBlock.typeId !== blockTypeId) continue;
                    const serializedLocation = JSON.stringify(neighborBlock.location);
                    let neighborNode = graph.getNode(neighborBlock) ?? graph.addNode(neighborBlock);

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

            system.clearJob(traversingTreeInterval);
            resolve({
                source: graph, 
                blockOutlines: [], 
                yOffsets, 
                trunk: {
                    size: 0,
                    center: {x: 0, z: 0}
                }
            });
        }());
    });

    const blockOutlines: Entity[] = [];
    const trunk = await getTreeTrunkSize(firstBlock, blockTypeId);
    return new Promise<VisitedBlockResult>((resolve) => {
        const t = system.runJob((function*(){
            // Create Block Entity based on the trunk. 
            // (Create particle spawner entities when you are chopping it down for dust, and destroy particle, else just for inpsection particle)
            if(!isInspectingTree) {
                for(const yOffset of visitedTree.yOffsets.keys()) {
                    const outline = dimension.spawnEntity('yn:block_outline', { x: trunk.center.x, y: yOffset, z: trunk.center.z });
                    outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                    blockOutlines.push(outline);
                    yield;
                }
                // After all is traversed, start timer.
                for(const blockOutline of blockOutlines) {
                    if(blockOutline?.isValid()) {
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



function* getBlockNear(initialBlock: Block, radius: number = 1): Generator<Block, any, unknown> {
    const centerX: number = 0;
    const centerY: number = 0;
    const centerZ: number = 0;
    let _block: Block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if (centerX === x && centerY === y && centerZ === z) continue;
                _block = initialBlock.offset({x, y, z});
                if (!_block?.isValid() || !isLogIncluded(_block?.typeId)) continue;
                yield _block;
            }
        }
    }
}

// Gets all the visited blocks and groups them together.
function groupAdjacentBlocks(visited: Set<string>): string[][] {
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

export function getTreeTrunkSize(blockInteracted: Block, blockTypeId: string): Promise<TrunkBlockResult> {
    return new Promise<TrunkBlockResult>((fetchedTrunkSizeResolved) => {
        let i = 0;
        let centroidLog: VectorXZ = {
            x: 0, 
            z: 0
        };

        const visited = new Set<string>(); // To avoid revisiting blocks
        const queue: Block[] = [blockInteracted]; // Queue for the floodfill process

        const t = system.runJob((function* () {
            while (queue.length > 0) {
                const currentBlock = queue.shift();
                if (!currentBlock || !currentBlock.isValid() || currentBlock.typeId !== blockTypeId) continue;

                const blockKey = JSON.stringify({x: currentBlock.x, z: currentBlock.z} as VectorXZ);
                if (visited.has(blockKey)) continue;
                visited.add(blockKey);

                // Accumulate the log coordinates to calculate the centroid
                centroidLog.x += currentBlock.x;
                centroidLog.z += currentBlock.z;
                i++;

                // Add the neighboring blocks within radius 1 (cardinal + diagonal)
                for (let y = 0; y <= 1; y++) {
                    for (let x = -1; x <= 1; x++) {
                        for (let z = -1; z <= 1; z++) {
                            if (x === 0 && z === 0 && y === 0) continue; // Skip the current block itself
                            const neighborBlock = currentBlock.offset({ x: x, y: y, z: z });
                            const neighborLoc = JSON.stringify({x: neighborBlock.x, z: neighborBlock.z} as VectorXZ);
                            if (!neighborBlock?.isValid() || visited.has(neighborLoc)) continue;
                            queue.push(neighborBlock);
                            yield;
                        }
                        yield;
                    }
                    yield;
                }
                yield;
            }

            // If only one block found, the centroid is the original block's location
            if (i <= 1) {
                i = 1;
                centroidLog = blockInteracted.location;
            }

            // Compute the average position of the logs
            centroidLog.x = (centroidLog.x / i) + 0.5;
            centroidLog.z = (centroidLog.z / i) + 0.5;

            system.clearJob(t);
            fetchedTrunkSizeResolved({ center: centroidLog, size: i });
            return;
        })());
    });
}