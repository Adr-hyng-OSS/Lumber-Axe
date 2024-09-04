import { Block, Dimension, Entity, EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, Player, System, Vector3, system } from "@minecraft/server";
import { MinecraftBlockTypes, MinecraftEnchantmentTypes} from "../modules/vanilla-types/index";

import { validLogBlocks, axeEquipments, stackDistribution, serverConfigurationCopy } from "../index";


function treeCut(player: Player, dimension: Dimension, location: Vector3, blockTypeId: string): void {
    const equipment = player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent;
    const currentHeldAxe = equipment.getEquipment(EquipmentSlot.Mainhand);
    if (!axeEquipments.includes(currentHeldAxe?.typeId)) return;
    if (player.isSurvival()) currentHeldAxe.lockMode = ItemLockMode.slot;

    const itemDurability: ItemDurabilityComponent = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId) as ItemDurabilityComponent;
    const enchantments: ItemEnchantableComponent = (currentHeldAxe.getComponent(ItemEnchantableComponent.componentId) as ItemEnchantableComponent);
    const level: number = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
    const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
    const unbreakingDamage: number = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
    
    system.run(async () => {

        const visited: Graph = (await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage) as VisitedBlockResult).graph;
        const size = visited.getSize();
        const totalDamage: number = size * unbreakingDamage;
        const postDamagedDurability: number = itemDurability.damage + totalDamage;
    
        // Check if durabiliy is exact that can chop the tree but broke the axe, then broke it.
        if (postDamagedDurability + 1 === itemDurability.maxDurability) {
            equipment.setEquipment(EquipmentSlot.Mainhand, undefined);
        // Check if the durability is not enough to chop the tree. Then don't apply the 3 damage.
        } else if (postDamagedDurability > itemDurability.maxDurability) {
            currentHeldAxe.lockMode = ItemLockMode.none;
            return;
        // Check if total durability will consume is still enough and not near the max durability
        } else if (postDamagedDurability < itemDurability.maxDurability){
            itemDurability.damage = itemDurability.damage +  totalDamage;
            currentHeldAxe.lockMode = ItemLockMode.none;
            equipment.setEquipment(EquipmentSlot.Mainhand, currentHeldAxe.clone());
        }
        
        //! Use this when fillBlocks is in stable.
        // for (const group of groupAdjacentBlocks(visited)) {
        //     const firstElement = JSON.parse(group[0]);
        //     const lastElement = JSON.parse(group[group.length - 1]);
        //     if (firstElement === lastElement) {
        //         dimension.getBlock(firstElement).setType(MinecraftBlockTypes.Air);
        //         continue;
        //     } else {
        //         dimension.fillBlocks(firstElement, lastElement, MinecraftBlockTypes.Air);
        //     }
        // }


        // const visitedNodes = visited.getConnectedComponents();  // Get all connected components (all nodes)

        // for (const node of visitedNodes) {
        //     const blockLocation = node.location;  // Extract the location (Vector3) from the node
 
        //     system.run(() => {
        //         dimension.setBlockType(blockLocation, MinecraftBlockTypes.Air);
        //     });
        // }
        
        // system.runTimeout( () => {
        //     for (const group of stackDistribution(size)) {
        //         system.run(() => dimension.spawnItem(new ItemStack(blockTypeId, group), location));
        //     }
        // }, 5);
    });
}

function isLogIncluded(blockTypeId: string): boolean {
    if(serverConfigurationCopy.excludedLog.values.includes(blockTypeId) || blockTypeId.includes('stripped_')) return false;
    if(serverConfigurationCopy.includedLog.values.includes(blockTypeId) || validLogBlocks.test(blockTypeId)) return true;
    return false;
}

export type VisitedBlockResult = {
    graph: Graph;
    blockOutlines: Entity[];
}

function getTreeLogs(dimension: Dimension, location: Vector3, blockTypeId: string, maxNeeded: number): Promise<VisitedBlockResult> {
    return new Promise<VisitedBlockResult>((resolve) => {
        const graph = new Graph();
        const blockOutlines: Entity[] = [];
        let queue: Block[] = []; // Solid Blocks (There's still non-logs)
        const firstBlock = dimension.getBlock(location);
        queue.push(firstBlock);
        graph.addNode(firstBlock.location);

        const traversingTreeInterval: number = system.runJob(function* () {
            while (queue.length > 0) {
                // Get the graph size
                const size = graph.getSize();

                // Check termination conditions
                if (size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || size >= maxNeeded) {
                    system.clearJob(traversingTreeInterval);
                    resolve({ graph, blockOutlines });
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
                blockOutlines.push(dimension.spawnEntity('yn:block_outline', { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.5 }));

                yield;

                // Get the neighbors and connect to main node.
                for (const neighborBlock of getBlockNear(dimension, block.location)) {
                    // Check if the neighbor is already in the graph
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
            resolve({ graph, blockOutlines });
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

function getBlockNearInitialize(dimension: Dimension, location: Vector3, radius: number = 1): Block[] {
    const centerX: number = location.x;
    const centerY: number = location.y;
    const centerZ: number = location.z;
    const blocks: Block[] = [];
    let _block: Block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if (centerX === x && centerY === y && centerZ === z) continue;
                _block = dimension.getBlock({ x, y, z });
                if (_block.isAir) continue;
                blocks.push(_block);
            }
        }
    }
    return blocks;
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

class GraphNode {
    public location: Vector3;
    public neighbors: Set<GraphNode>;

    constructor(location: Vector3) {
        this.location = location;
        this.neighbors = new Set<GraphNode>();
    }

    addNeighbor(node: GraphNode) {
        this.neighbors.add(node);
    }

    removeNeighbor(node: GraphNode) {
        this.neighbors.delete(node);
    }
}

class Graph {
    private nodes: Map<string, GraphNode>;

    constructor() {
        this.nodes = new Map<string, GraphNode>();
    }

    getNode(location: Vector3): GraphNode | undefined {
        return this.nodes.get(this.serializeLocation(location));
    }

    addNode(location: Vector3): GraphNode {
        const key = this.serializeLocation(location);
        let node = this.nodes.get(key);
        if (!node) {
            node = new GraphNode(location);
            this.nodes.set(key, node);
        }
        return node;
    }

    removeNode(location: Vector3) {
        const key = this.serializeLocation(location);
        const node = this.nodes.get(key);
        if (node) {
            // Remove the node from its neighbors' adjacency lists
            node.neighbors.forEach(neighbor => {
                neighbor.removeNeighbor(node);
            });
            this.nodes.delete(key);
        }
    }

    serializeLocation(location: Vector3): string {
        return JSON.stringify(location);
    }

    getSize(): number {
        return this.nodes.size;
    }
}


export {treeCut, isLogIncluded, getTreeLogs}