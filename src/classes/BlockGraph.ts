import { Block} from "@minecraft/server";
import { Graph } from "./Graph";
import { Vector } from "modules/Vector";

export class BlockGraph extends Graph<Block> {
  locations: Set<string>;
  adjacencyVectorList: Map<string, Block[]>;
  
  constructor() {
    super();
    this.locations = new Set();
  }

  override filter(predicate: (vertex: Block) => boolean): BlockGraph {
    const filteredGraph = new BlockGraph();

    // Iterate over the keys (vertices) of the adjacency list
    for (const vertex of this.adjacencyList.keys()) {
        if (predicate(vertex)) {
            // If the vertex passes the predicate, add it to the new graph
            filteredGraph.addVertex(vertex);

            // Add edges for the vertex if it exists in the original graph
            const neighbors = this.get(vertex);
            if (neighbors) {
                for (const neighbor of neighbors) {
                    if (predicate(neighbor)) {
                        filteredGraph.addEdge(vertex, neighbor);
                    }
                }
            }
        }
    }
    return filteredGraph;
  }

  override bfs(vertex: Block): Set<Block> {
    const queue: Block[] = [vertex];
    // const visited: Set<string> = new Set();
    const visitedBlocks: Set<Block> = new Set();
    while (queue.length) {
      const currentVertex = queue.shift() as Block;
      const pos = JSON.stringify(currentVertex.location);
      if (!this.locations.has(pos)) {
        this.locations.add(pos);
        visitedBlocks.add(currentVertex);
        const neighbors = this.get(currentVertex) || [];
        neighbors.forEach(neighbor => {
          const neighborPos = JSON.stringify(neighbor.location)
          // console.warn(Vector.distance(neighbor.location, currentVertex.location), neighborPos, pos);
          if (!this.locations.has(neighborPos)) {
            queue.push(neighbor);
          }
        });
      }
    }
    return visitedBlocks;
  }

  protected override dfs(vertex: Block, visited: Set<Block> = new Set()): Set<Block> {
    const pos = JSON.stringify(vertex.location);
    if (!this.locations.has(pos)) {
      this.locations.add(pos);
      visited.add(vertex);
      const neighbors = this.get(vertex) || [];
      neighbors.forEach(neighbor => {
        const isReachable = Vector.distance(neighbor.location, vertex.location) < 3.0;
        const neighborPos = JSON.stringify(neighbor.location)
        // Check if it is reacheable like there's no gap.
        // console.warn(Vector.distance(neighbor.location, vertex.location), neighborPos, pos);
        return this.dfs(neighbor, visited);
      });
    }
    return visited;
  }
}