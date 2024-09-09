import { Vector3 } from "@minecraft/server";

/**
 * Reminder:
 * - Make this generic or for block or entity class, instead of just storing vectors only.
 * 
*/

function hashVector3(vec: Vector3): number {
    const prime = 31;
    let hash = 1;

    // Convert the vector components to integers (assuming they might be floats) and apply the prime multiplier
    hash = prime * hash + Math.imul(vec.x | 0, prime);
    hash = prime * hash + Math.imul(vec.y | 0, prime);
    hash = prime * hash + Math.imul(vec.z | 0, prime);

    // Apply a bitwise shift to further mix the bits
    hash ^= (hash << 13);
    hash ^= (hash >> 7);
    hash ^= (hash << 17);

    return hash >>> 0; // Ensure it's an unsigned 32-bit integer
}

export class GraphNode {
  public location: Vector3;
  public neighbors: Set<GraphNode>;
  public index: number = 0;

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

type GraphTraversalType = "DFS" | "BFS";

export class Graph {
    private nodes: Map<string, GraphNode>;
    private hashes: number[];

    constructor() {
        this.nodes = new Map<string, GraphNode>();
        this.hashes = [];
    }

    getNode(location: Vector3): GraphNode | undefined {
        return this.nodes.get(this.serializeLocation(location));
    }

    addNode(location: Vector3): GraphNode;
    addNode(node: GraphNode): void;
    addNode(param: Vector3 | GraphNode): GraphNode | void {
        if (param instanceof GraphNode) {
            this.hashes.push(hashVector3(param.location));
            const key = this.serializeLocation(param.location);
            param.index = this.nodes.size;
            this.nodes.set(key, param);
            return; // Since it's a GraphNode, you don't return anything
        } else {
            const key = this.serializeLocation(param);
            let node = this.nodes.get(key);
            if (!node) {
                node = new GraphNode(param);
                this.nodes.set(key, node);
            }
            this.hashes.push(hashVector3(node.location));
            node.index = this.nodes.size - 1;
            return node; // Return the newly created or retrieved node
        }
    }

    removeNode(location: Vector3) {
        const key = this.serializeLocation(location);
        const node = this.nodes.get(key);
        if (!node) return;
        // Remove the node from its neighbors' adjacency lists
        node.neighbors.forEach(neighbor => {
            neighbor.removeNeighbor(node);
            node.removeNeighbor(neighbor);
        });
        this.hashes.splice(this.hashes.lastIndexOf(hashVector3(location)));
        this.nodes.delete(key);
    }

    serializeLocation(location: Vector3): string {
        return JSON.stringify(location);
    }

    getSize(): number {
        return this.nodes.size;
    }
    
    traverse(startLocation: Vector3, traversalType: GraphTraversalType = "DFS", visit: (node: GraphNode) => void) {
        const startNode = this.getNode(startLocation);
        if (!startNode) {
            return;
        }

        const visited = new Set<GraphNode>();

        // Choose a data structure based on traversal type
        const toVisit: GraphNode[] = [startNode]; // This will act as both the stack for DFS and queue for BFS

        while (toVisit.length > 0) {
            // For DFS, we pop from the end of the array (LIFO). For BFS, we shift from the start (FIFO).
            const node = traversalType === "DFS" ? toVisit.pop()! : toVisit.shift()!; // Remove from end for DFS, from start for BFS

            if (!visited.has(node)) {
                visit(node); // Perform some action on the node (e.g., print or collect data)
                visited.add(node);

                // Add neighbors to the toVisit structure if they haven't been visited
                node.neighbors.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        toVisit.push(neighbor); // For both DFS and BFS, we add neighbors to the end
                    }
                });
            }
        }
    }

    hash(): number {
        return this.hashes.reduce((accumulator, currentValue) => {return accumulator + currentValue},0);
    }

    *traverseIterative(startLocation: Vector3, traversalType: GraphTraversalType = "DFS"): Generator<GraphNode> {
        const startNode = this.getNode(startLocation);
        if (!startNode) {
            return;
        }

        const visited = new Set<GraphNode>();

        // Choose a data structure based on traversal type
        const toVisit: GraphNode[] = [startNode]; // Stack for DFS, queue for BFS

        while (toVisit.length > 0) {
            // For DFS, pop from the end (LIFO). For BFS, shift from the start (FIFO).
            const node = traversalType === "DFS" ? toVisit.pop()! : toVisit.shift()!;

            if (!visited.has(node)) {
                yield node; // Yield node instead of visiting it
                visited.add(node);

                // Add neighbors to the toVisit stack/queue
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