export class Graph {
    constructor() {
        this.adjacencyList = new Map();
        this.keyAdjacencyList = new Map();
    }
    show() {
        this.keyAdjacencyList.forEach((blocks, key) => {
            if (blocks.length) {
                console.log(key, ": ", blocks.map(b => JSON.stringify(b) + ", "));
            }
        });
    }
    get size() {
        return this.adjacencyList.size;
    }
    get(arg) {
        return this.keyAdjacencyList.get(JSON.stringify(arg)) || this.adjacencyList.get(arg);
    }
    set(arg) {
        this.adjacencyList.set(arg, []);
        this.keyAdjacencyList.set(JSON.stringify(arg), []);
    }
    has(vertex) {
        return this.keyAdjacencyList.has(JSON.stringify(vertex));
    }
    clear() {
        this.adjacencyList.clear();
    }
    addVertex(vertex) {
        if (!this.has(vertex)) {
            this.set(vertex);
            if (!this.firstVertex)
                this.firstVertex = vertex;
            this.previousVertex = vertex;
        }
    }
    removeVertex(vertex) {
        const vertexString = JSON.stringify(vertex);
        if (this.has(vertex)) {
            this.adjacencyList.delete(vertex);
            this.keyAdjacencyList.delete(vertexString);
            this.adjacencyList.forEach((value, key) => {
                const index = value.indexOf(vertex);
                if (index > -1) {
                    value.splice(index, 1);
                }
            });
        }
    }
    addEdge(vertex1, vertex2) {
        if (this.has(vertex1) && this.has(vertex2)) {
            this.get(vertex1)?.push(vertex2);
            this.get(vertex2)?.push(vertex1);
        }
    }
    removeEdge(vertex1, vertex2) {
        if (this.has(vertex1) && this.has(vertex2)) {
            const vertex1Edges = this.get(vertex1);
            const vertex2Edges = this.get(vertex2);
            if (vertex1Edges && vertex2Edges) {
                const index1 = vertex1Edges.indexOf(vertex2);
                const index2 = vertex2Edges.indexOf(vertex1);
                if (index1 > -1) {
                    vertex1Edges.splice(index1, 1);
                }
                if (index2 > -1) {
                    vertex2Edges.splice(index2, 1);
                }
            }
        }
    }
    bfs(vertex) {
        const queue = [vertex];
        const visited = new Set();
        while (queue.length) {
            const currentVertex = queue.shift();
            if (!visited.has(currentVertex)) {
                visited.add(currentVertex);
                const neighbors = this.get(currentVertex) || [];
                neighbors.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                });
            }
        }
        return visited;
    }
    dfs(vertex, visited = new Set()) {
        if (!visited.has(vertex)) {
            visited.add(vertex);
            console.log(vertex);
            const neighbors = this.get(vertex) || [];
            neighbors.forEach(neighbor => {
                this.dfs(neighbor, visited);
            });
        }
        return visited;
    }
    traverse(vertex, traversalType) {
        if (traversalType === 'bfs') {
            return this.bfs(vertex);
        }
        else if (traversalType === 'dfs') {
            return this.dfs(vertex);
        }
    }
    [Symbol.iterator]() {
        let currentVertex = this.adjacencyList.keys().next();
        const vertices = Array.from(this.adjacencyList.keys());
        let index = 0;
        return {
            next: () => {
                if (index < vertices.length) {
                    return { value: vertices[index++], done: false };
                }
                else {
                    return { done: true, value: undefined };
                }
            }
        };
    }
    filter(predicate) {
        const filteredGraph = new Graph();
        for (const vertex of this.adjacencyList.keys()) {
            if (!predicate(vertex))
                continue;
            filteredGraph.addVertex(vertex);
            const neighbors = this.get(vertex);
            if (!neighbors)
                continue;
            for (const neighbor of neighbors) {
                if (!predicate(neighbor))
                    continue;
                filteredGraph.addEdge(vertex, neighbor);
            }
        }
        return filteredGraph;
    }
}
