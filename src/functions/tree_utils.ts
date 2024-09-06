import { Block, Dimension, Entity, Vector3, system } from "@minecraft/server";

import { validLogBlocks, serverConfigurationCopy, VisitedBlockResult } from "../index";
import { Graph, GraphNode } from "utils/graph";

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
        visited.add(JSON.stringify(firstBlock.location)); // Mark as visited

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

                const node = graph.getNode(pos);
                if (!node) continue;

                if (shouldSpawnOutline) {
                    const outline = dimension.spawnEntity('yn:block_outline', { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.5 });
                    outline.lastLocation = JSON.parse(JSON.stringify(outline.location));
                    blockOutlines.push(outline);
                }

                yield;

                // First, gather all valid neighbors
                const neighborNodes: GraphNode[] = [];
                for (const neighborBlock of getBlockNear(dimension, block.location)) {
                    if (!neighborBlock?.isValid() || !isLogIncluded(neighborBlock?.typeId)) continue;
                    if (neighborBlock.typeId !== blockTypeId) continue;

                    const serializedLocation = JSON.stringify(neighborBlock.location);

                    // Check if the neighbor node has already been visited
                    if (visited.has(serializedLocation)) continue;

                    let neighborNode = graph.getNode(neighborBlock.location);
                    if (!neighborNode) {
                        neighborNode = graph.addNode(neighborBlock.location);
                    }

                    // Connect the current node to its neighbor
                    node.addNeighbor(neighborNode);
                    neighborNode.addNeighbor(node);

                    neighborNodes.push(neighborNode);  // Store the valid neighbor nodes

                    // Mark this neighbor as visited and add to the queue for further processing
                    visited.add(serializedLocation);
                    queue.push(neighborBlock);
                    yield;
                }

                // Now, connect all the neighbors of this node to each other
                for (let i = 0; i < neighborNodes.length; i++) {
                    for (let j = i + 1; j < neighborNodes.length; j++) {
                        const nodeA = neighborNodes[i];
                        const nodeB = neighborNodes[j];
                        // Ensure they are connected to each other
                        nodeA.addNeighbor(nodeB);
                        nodeB.addNeighbor(nodeA);
                    }
                }

                // Logging node and neighbor details
                // node.neighbors.forEach((n) => {
                //     console.info(`${JSON.stringify(node.location)} ${node.neighbors.size} -> 
                //         ${JSON.stringify(n.location)}: ${n.neighbors.size}`);
                // });

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