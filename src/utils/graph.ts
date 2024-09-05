import { Vector3 } from "@minecraft/server";

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

export class Graph {
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
    if (!node) return;
    // Remove the node from its neighbors' adjacency lists
    node.neighbors.forEach(neighbor => {
        // neighbor.removeNeighbor(node);
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

  bfs(startLocation: Vector3, visit: (node: GraphNode) => void) {
      const startNode = this.getNode(startLocation);
      if (!startNode) {
          return;
      }

      const visited = new Set<GraphNode>();
      const queue: GraphNode[] = [startNode];

      while (queue.length > 0) {
          const node = queue.shift()!; // Get the first element in the queue

          if (!visited.has(node)) {
              visit(node); // Perform some action on the node (e.g., print or collect data)
              visited.add(node);

              // Add neighbors to the queue if they haven't been visited
              node.neighbors.forEach(neighbor => {
                  if (!visited.has(neighbor)) {
                      queue.push(neighbor);
                  }
              });
          }
      }
  }

  // Recursive DFS traversal
  dfsRecursive(startLocation: Vector3, visit: (node: GraphNode) => void, visited = new Set<GraphNode>()) {
      const startNode = this.getNode(startLocation);
      if (!startNode || visited.has(startNode)) {
          return;
      }

      visit(startNode); // Perform some action on the node (e.g., print or collect data)
      visited.add(startNode);

      // Visit all neighbors recursively
      startNode.neighbors.forEach(neighbor => {
          if (!visited.has(neighbor)) {
              this.dfsRecursive(neighbor.location, visit, visited);
          }
      });
  }

  dfsIterative(startLocation: Vector3, visit: (node: GraphNode) => void) {
      const startNode = this.getNode(startLocation);
      if (!startNode) {
          return;
      }

      const visited = new Set<GraphNode>();
      const stack: GraphNode[] = [startNode];

      while (stack.length > 0) {
          const node = stack.pop()!; // Get the last element in the stack

          if (!visited.has(node)) {
              visit(node); // Perform some action on the node (e.g., print or collect data)
              visited.add(node);

              // Add neighbors to the stack if they haven't been visited
              node.neighbors.forEach(neighbor => {
                  if (!visited.has(neighbor)) {
                      stack.push(neighbor);
                  }
              });
          }
      }
  }
}