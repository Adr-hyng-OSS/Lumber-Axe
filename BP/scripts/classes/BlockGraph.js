import { Graph } from "./Graph";
import { Vector } from "modules/Vector";
export class BlockGraph extends Graph {
    constructor() {
        super();
        this.locations = new Set();
    }
    filter(predicate) {
        const filteredGraph = new BlockGraph();
        for (const vertex of this.adjacencyList.keys()) {
            if (predicate(vertex)) {
                filteredGraph.addVertex(vertex);
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
    bfs(vertex) {
        const queue = [vertex];
        const visitedBlocks = new Set();
        while (queue.length) {
            const currentVertex = queue.shift();
            const pos = JSON.stringify(currentVertex.location);
            if (!this.locations.has(pos)) {
                this.locations.add(pos);
                visitedBlocks.add(currentVertex);
                const neighbors = this.get(currentVertex) || [];
                neighbors.forEach(neighbor => {
                    const neighborPos = JSON.stringify(neighbor.location);
                    if (!this.locations.has(neighborPos)) {
                        queue.push(neighbor);
                    }
                });
            }
        }
        return visitedBlocks;
    }
    dfs(vertex, visited = new Set()) {
        const pos = JSON.stringify(vertex.location);
        if (!this.locations.has(pos)) {
            this.locations.add(pos);
            visited.add(vertex);
            const neighbors = this.get(vertex) || [];
            neighbors.forEach(neighbor => {
                const isReachable = Vector.distance(neighbor.location, vertex.location) < 3.0;
                const neighborPos = JSON.stringify(neighbor.location);
                return this.dfs(neighbor, visited);
            });
        }
        return visited;
    }
}
