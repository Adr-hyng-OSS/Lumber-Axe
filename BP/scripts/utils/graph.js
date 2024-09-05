class GraphNode {
    constructor(location) {
        this.location = location;
        this.neighbors = new Set();
    }
    addNeighbor(node) {
        this.neighbors.add(node);
    }
    removeNeighbor(node) {
        this.neighbors.delete(node);
    }
}
export class Graph {
    constructor() {
        this.nodes = new Map();
    }
    getNode(location) {
        return this.nodes.get(this.serializeLocation(location));
    }
    addNode(location) {
        const key = this.serializeLocation(location);
        let node = this.nodes.get(key);
        if (!node) {
            node = new GraphNode(location);
            this.nodes.set(key, node);
        }
        return node;
    }
    removeNode(location) {
        const key = this.serializeLocation(location);
        const node = this.nodes.get(key);
        if (node) {
            node.neighbors.forEach(neighbor => {
                neighbor.removeNeighbor(node);
            });
            this.nodes.delete(key);
        }
    }
    serializeLocation(location) {
        return JSON.stringify(location);
    }
    getSize() {
        return this.nodes.size;
    }
    bfs(startLocation, visit) {
        const startNode = this.getNode(startLocation);
        if (!startNode) {
            return;
        }
        const visited = new Set();
        const queue = [startNode];
        while (queue.length > 0) {
            const node = queue.shift();
            if (!visited.has(node)) {
                visit(node);
                visited.add(node);
                node.neighbors.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                });
            }
        }
    }
    dfsRecursive(startLocation, visit, visited = new Set()) {
        const startNode = this.getNode(startLocation);
        if (!startNode || visited.has(startNode)) {
            return;
        }
        visit(startNode);
        visited.add(startNode);
        startNode.neighbors.forEach(neighbor => {
            if (!visited.has(neighbor)) {
                this.dfsRecursive(neighbor.location, visit, visited);
            }
        });
    }
    dfsIterative(startLocation, visit) {
        const startNode = this.getNode(startLocation);
        if (!startNode) {
            return;
        }
        const visited = new Set();
        const stack = [startNode];
        while (stack.length > 0) {
            const node = stack.pop();
            if (!visited.has(node)) {
                visit(node);
                visited.add(node);
                node.neighbors.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        stack.push(neighbor);
                    }
                });
            }
        }
    }
}
