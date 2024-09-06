export class GraphNode {
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
    addNode(param) {
        if (param instanceof GraphNode) {
            const key = this.serializeLocation(param.location);
            this.nodes.set(key, param);
            return;
        }
        else {
            const key = this.serializeLocation(param);
            let node = this.nodes.get(key);
            if (!node) {
                node = new GraphNode(param);
                this.nodes.set(key, node);
            }
            return node;
        }
    }
    removeNode(location) {
        const key = this.serializeLocation(location);
        const node = this.nodes.get(key);
        if (!node)
            return;
        node.neighbors.forEach(neighbor => {
            neighbor.removeNeighbor(node);
            node.removeNeighbor(neighbor);
        });
        this.nodes.delete(key);
    }
    serializeLocation(location) {
        return JSON.stringify(location);
    }
    getSize() {
        return this.nodes.size;
    }
    traverse(startLocation, traversalType = "DFS", visit) {
        const startNode = this.getNode(startLocation);
        if (!startNode) {
            return;
        }
        const visited = new Set();
        const toVisit = [startNode];
        while (toVisit.length > 0) {
            const node = traversalType === "DFS" ? toVisit.pop() : toVisit.shift();
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
}
