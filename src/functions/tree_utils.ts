import { Block, Dimension, Entity, Vector3, VectorXZ, system } from "@minecraft/server";

import { validLogBlocks, serverConfigurationCopy, VisitedBlockResult } from "../index";
import { Graph } from "utils/graph";

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
    isInspectingTree: boolean = true
): Promise<VisitedBlockResult> {
    return new Promise<VisitedBlockResult>((resolve) => {
        const graph = new Graph();
        const blockOutlines: Entity[] = [];
        const yOffsets: Map<number, boolean> = new Map();

        let queue: Block[] = [];
        const visited = new Set<string>(); // To track visited locations

        const traversingTreeInterval: number = system.runJob(function* () {
            const firstBlock = dimension.getBlock(location);
            queue.push(firstBlock);
            graph.addNode(firstBlock);
            visited.add(JSON.stringify(firstBlock.location));

            // Should spawn outline is indicator for inspection or breaking tree.
            // Inspection = True
            // Breaking = False

            // Gets the center of the trunk.
            let trunkNumberOfBlocks: number = isInspectingTree ? 0 : 1;
            let centroidLog: VectorXZ = {
                x: isInspectingTree ? 0 : firstBlock.x, 
                z: isInspectingTree ? 0 : firstBlock.z
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

            // Create Block Entity based on the trunk. 
            // (Create particle spawner entities when you are chopping it down for dust, and destroy particle, else just for inpsection particle)
            if(!isInspectingTree) {
                for(const yOffset of yOffsets.keys()) {
                    const outline = dimension.spawnEntity('yn:block_outline', { x: centroidLog.x, y: yOffset, z: centroidLog.z });
                    outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                    blockOutlines.push(outline);
                    yield;
                }
                // After all is traversed, start timer.
                for(const blockOutline of blockOutlines) {
                    if(blockOutline?.isValid()) blockOutline.triggerEvent('not_persistent');
                    yield;
                }
            } else {
                const bottomMostBlock = Array.from(yOffsets.keys()).sort((a, b) => a - b)[0];
                const outline = dimension.spawnEntity('yn:block_outline', { x: centroidLog.x, y: bottomMostBlock, z: centroidLog.z });
                outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                outline.triggerEvent('not_persistent');
                outline.triggerEvent('active_outline');
                blockOutlines.push(outline);
                yield;
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



export {isLogIncluded, getTreeLogs}