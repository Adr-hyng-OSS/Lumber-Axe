import { Vector3 } from "@minecraft/server";

/**
 * Reminder:
 * - Make this generic or for block or entity class, instead of just storing vectors only.
 * 
*/

export class GraphNode {
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

type GraphTraversalType = "DFS" | "BFS";

export class Graph {
    private nodes: Map<string, GraphNode>;

    constructor() {
        this.nodes = new Map<string, GraphNode>();
    }

    getNode(location: Vector3): GraphNode | undefined {
        return this.nodes.get(this.serializeLocation(location));
    }

    addNode(location: Vector3): GraphNode;
    addNode(node: GraphNode): void;

    addNode(param: Vector3 | GraphNode): GraphNode | void {
        if (param instanceof GraphNode) {
            const key = this.serializeLocation(param.location);
            this.nodes.set(key, param);
            return; // Since it's a GraphNode, you don't return anything
        } else {
            const key = this.serializeLocation(param);
            let node = this.nodes.get(key);
            if (!node) {
                node = new GraphNode(param);
                this.nodes.set(key, node);
            }
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

    isEqual(otherGraph: Graph): boolean {
        // Step 1: Check if both graphs have the same number of nodes
        if (this.getSize() !== otherGraph.getSize()) {
            return false;
        }

        // Step 2: Compare each node and its neighbors
        for (const [locationKey, node] of this.nodes) {
            const otherNode = otherGraph.nodes.get(locationKey);

            if (!otherNode) {
            // If the node doesn't exist in the other graph, return false
            return false;
            }

            // Step 3: Compare neighbors of the current node with the other node
            if (node.neighbors.size !== otherNode.neighbors.size) {
            return false; // Different number of neighbors
            }

            // Check if all neighbors are the same
            for (const neighbor of node.neighbors) {
            const otherNeighbor = otherGraph.getNode(neighbor.location);

            if (!otherNeighbor || !otherNode.neighbors.has(otherNeighbor)) {
                return false; // If any neighbor is missing or different
            }
            }
        }

        // If all nodes and neighbors match, return true
        return true;
    }

    toJSON(): object {
        const serializedNodes: Record<string, { location: Vector3, neighbors: string[] }> = {};
    
        // Convert and sort each node and its neighbors into a plain object
        const sortedNodeEntries = Array.from(this.nodes.entries()).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
    
        sortedNodeEntries.forEach(([key, node]) => {
            // Sort neighbors by serialized location
            const sortedNeighbors = Array.from(node.neighbors)
                .map(neighbor => this.serializeLocation(neighbor.location))
                .sort((a, b) => a.localeCompare(b));
    
            serializedNodes[key] = {
                location: node.location,
                neighbors: sortedNeighbors
            };
        });
    
        return {
            nodes: serializedNodes
        };
    }
    
}