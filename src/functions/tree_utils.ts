import { Block, Dimension, Entity, Vector3, VectorXZ, system, world } from "@minecraft/server";

import { serverConfigurationCopy, VisitedBlockResult, TrunkBlockResult, db, hashBlock } from "../index";
import { Graph } from "utils/graph";
import { Vec3 } from "utils/VectorUtils";

export function isLogIncluded(rootBlockTypeId: string, blockTypeId: string): boolean {
    const validLogBlocks: RegExp = /(_log|_wood|crimson_stem|warped_stem|(?:brown|red_)?mushroom_block)$/;
    function extractLogFamily(blockTypeId: string): string {
        // Remove the namespace by splitting on the colon (':') and taking the second part
        const [, cleanedBlockTypeId] = blockTypeId.split(':');

        // Split the remaining string by underscores
        const parts = cleanedBlockTypeId.split('_');

        // Remove the last part (e.g., 'log', 'wood', 'stem')
        return parts.slice(0, -1).join('_');
    }
    if(serverConfigurationCopy.excludedLog.values.includes(blockTypeId) || blockTypeId.includes('stripped_')) return false;
    const extractedLogFamily = extractLogFamily(rootBlockTypeId);
    const blockFamily = extractLogFamily(blockTypeId);
    const isSameFamily = blockFamily === extractedLogFamily;
    if((serverConfigurationCopy.includedLog.values.includes(blockTypeId) ||
        validLogBlocks.test(blockTypeId)) && isSameFamily ) return true;
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
        const graph = new Graph();
        const queue: Block[] = [firstBlock];
        const yOffsets: Map<number, boolean> = new Map();
        const visited: Set<string> = new Set([JSON.stringify(firstBlock.location)]);
        const traversingTreeInterval: number = system.runJob(function* () {
            graph.addNode(firstBlock);
            db.set(`visited_${hashBlock(firstBlock)}`, isInspectingTree);

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
                for (const neighborBlock of getBlockNear(blockTypeId, block)) {
                    const serializedLocation = JSON.stringify(neighborBlock.location);
                    let neighborNode = graph.getNode(neighborBlock) ?? graph.addNode(neighborBlock);
                    db.set(`visited_${hashBlock(neighborBlock)}`, isInspectingTree);

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
                    const outline = dimension.spawnEntity('yn:block_outline', {
                        x: trunk.center.x, 
                        y: yOffset, 
                        z: trunk.center.z
                    });
                    outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                    blockOutlines.push(outline);
                    yield;
                }
                // After all is traversed, start timer.
                for(const blockOutline of blockOutlines) {
                    if(blockOutline?.isValid()) {
                        blockOutline.triggerEvent('not_persistent');
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



function* getBlockNear(initialBlockTypeID: string, initialBlock: Block, radius: number = 1): Generator<Block, any, unknown> {
    const centerX: number = 0;
    const centerY: number = 0;
    const centerZ: number = 0;
    let _block: Block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if (centerX === x && centerY === y && centerZ === z) continue;
                _block = initialBlock.offset({x, y, z});
                if (!_block?.isValid() || !isLogIncluded(initialBlockTypeID, _block?.typeId)) continue;
                yield _block;
            }
        }
    }
}

export function getTreeTrunkSize(blockInteracted: Block, blockTypeId: string): Promise<TrunkBlockResult> {
    return new Promise<TrunkBlockResult>((fetchedTrunkSizeResolved) => {
        let i = 0;
        let centroidLog: VectorXZ = {
            x: 0, 
            z: 0
        };


        // (TODO) Possible to accurately get the trunk size, use a hashset to collect X and Z axis,
        // (TODO) Possible to accurately get the trunk height
        const visited = new Set<string>(); // To avoid revisiting blocks
        const queue: Block[] = [blockInteracted]; // Queue for the floodfill process
        const originalY = blockInteracted.y; // Store the original Y position

        const t = system.runJob((function* () {
            while (queue.length > 0) {
                const currentBlock = queue.shift();
                if ((!currentBlock || !currentBlock.isValid()) && !Vec3.equals(blockInteracted, currentBlock)) continue;
                const blockKey = JSON.stringify({x: currentBlock.x, z: currentBlock.z} as VectorXZ);
                if (visited.has(blockKey)) continue;
                visited.add(blockKey);

                // Accumulate the log coordinates to calculate the centroid
                centroidLog.x += currentBlock.x;
                centroidLog.z += currentBlock.z;
                i++;

                // Add the neighboring blocks within radius 1 (cardinal + diagonal) but limit Y within +2 and -2 range
                for (let y = -1; y <= 1; y++) {
                    const newY = currentBlock.y + y;
                    if (newY < originalY - 2 || newY > originalY + 2) continue; // Skip if out of allowed y-range

                    for (let x = -1; x <= 1; x++) {
                        for (let z = -1; z <= 1; z++) {
                            if (x === 0 && z === 0 && y === 0) continue; // Skip the current block itself
                            const neighborBlock = currentBlock.offset({ x: x, y: y, z: z });
                            const neighborLoc = JSON.stringify({x: neighborBlock.x, z: neighborBlock.z} as VectorXZ);
                            if (!neighborBlock?.isValid() || visited.has(neighborLoc) || !isLogIncluded(blockTypeId, neighborBlock.typeId)) continue;
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
                centroidLog = blockInteracted.center();
            } else {
                // Compute the average position of the logs
                centroidLog.x = (centroidLog.x / i) + 0.5;
                centroidLog.z = (centroidLog.z / i) + 0.5;
            }

            system.clearJob(t);
            fetchedTrunkSizeResolved({ center: centroidLog, size: i });
            return;
        })());
    });
}
