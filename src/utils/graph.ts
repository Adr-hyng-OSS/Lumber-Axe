import { Block, IPlayerSpawnAfterEventSignal, Vector3 } from "@minecraft/server";
import { Vec3 } from "./VectorUtils";

/**
 * Hash function for a Block based on its location (Vector3).
 */
function hashBlock(block: Block): number {
    const prime = 31;
    let hash = 1;

    // Convert the block's coordinates to integers and apply the prime multiplier
    hash = prime * hash + Math.imul(block.x | 0, prime);
    hash = prime * hash + Math.imul(block.y | 0, prime);
    hash = prime * hash + Math.imul(block.z | 0, prime);

    // Apply a bitwise shift to further mix the bits
    hash ^= (hash << 13);
    hash ^= (hash >> 7);
    hash ^= (hash << 17);

    return hash >>> 0; // Ensure it's an unsigned 32-bit integer
}

/**
 * GraphNode class now stores a Block instead of just a Vector3.
 */
export class GraphNode {
    public block: Block;
    public neighbors: Set<GraphNode>;
    public index: number = 0;

    constructor(block: Block) {
        this.block = block;
        this.neighbors = new Set<GraphNode>();
    }

    addNeighbor(node: GraphNode) {
        this.neighbors.add(node);
    }

    removeNeighbor(node: GraphNode) {
        this.neighbors.delete(node);
    }
}

type GraphTraversalType = "DFS" | "BFS";

/**
 * Graph class now stores Block objects in the nodes and uses block location for hashing and lookup.
 */
export class Graph {
    private nodes: Map<string, GraphNode>;
    private hashes: number[];

    constructor() {
        this.nodes = new Map<string, GraphNode>();
        this.hashes = [];
    }

    getNode(param: Block): GraphNode | undefined;
    getNode(param: Vec3): GraphNode | undefined;
    getNode(param: Block | Vec3): GraphNode | undefined {
        let node;
        if(param instanceof Vec3) {
            node = this.nodes.get(Vec3.toString(param));
        } else {
            node = this.nodes.get(this.serializeLocation((<Block>param).location));
        }
        return node;
    }

    addNode(block: Block): GraphNode;
    addNode(node: GraphNode): void;
    addNode(param: Block | GraphNode): GraphNode | void {
        if (param instanceof GraphNode) {
            this.hashes.push(hashBlock(param.block));
            const key = this.serializeLocation(param.block.location);
            param.index = this.nodes.size;
            this.nodes.set(key, param);
            return; // Since it's a GraphNode, you don't return anything
        } else {
            const key = this.serializeLocation(param.location);
            let node = this.nodes.get(key);
            if (!node) {
                node = new GraphNode(param);
                this.nodes.set(key, node);
            }
            this.hashes.push(hashBlock(node.block));
            node.index = this.nodes.size - 1;
            return node; // Return the newly created or retrieved node
        }
    }

    removeNode(block: Block) {
        const key = this.serializeLocation(block.location);
        const node = this.nodes.get(key);
        if (!node) return;
        // Remove the node from its neighbors' adjacency lists
        node.neighbors.forEach(neighbor => {
            neighbor.removeNeighbor(node);
            node.removeNeighbor(neighbor);
        });
        this.hashes.splice(this.hashes.lastIndexOf(hashBlock(block)), 1);
        this.nodes.delete(key);
    }

    serializeLocation(location: Vector3): string {
        return JSON.stringify(location);
    }

    getSize(): number {
        return this.nodes.size;
    }

    traverse(startBlock: Block, traversalType: GraphTraversalType = "DFS", visit: (node: GraphNode) => void) {
        const startNode = this.getNode(startBlock);
        if (!startNode) {
            return;
        }

        const visited = new Set<GraphNode>();
        const toVisit: GraphNode[] = [startNode];

        while (toVisit.length > 0) {
            const node = traversalType === "DFS" ? toVisit.pop()! : toVisit.shift()!;

            if (!visited.has(node)) {
                visit(node);
                visited.add(node);

                node.neighbors.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        toVisit.push(neighbor);
                    }
                });
            }
        }
    }

    hash(): number {
        return this.hashes.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
    }

    *traverseIterative(startBlock: Block, traversalType: GraphTraversalType = "DFS"): Generator<GraphNode> {
        const startNode = this.getNode(startBlock);
        if (!startNode) {
            return;
        }

        const visited = new Set<GraphNode>();
        const toVisit: GraphNode[] = [startNode];

        while (toVisit.length > 0) {
            const node = traversalType === "DFS" ? toVisit.pop()! : toVisit.shift()!;

            if (!visited.has(node)) {
                yield node;
                visited.add(node);

                node.neighbors.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        toVisit.push(neighbor);
                    }
                });
            }
        }
    }

    isEqual(otherGraph: Graph): boolean {
        return this.hash() === otherGraph.hash();
    }
}
