export class Graph<T> {
  private adjacencyList: Map<T, T[]>;

  constructor() {
      this.adjacencyList = new Map();
  }

  /**
   * Adds vertex or Node to the graph.
   * @param vertex Vertex to insert
   */
  addVertex(vertex: T): void {
      if (!this.adjacencyList.has(vertex)) {
          this.adjacencyList.set(vertex, []);
      }
  }

  /**
   * Removes vertex or Node to the graph
   * @param vertex Vertex to remove
   */
  removeVertex(vertex: T): void {
      if (this.adjacencyList.has(vertex)) {
          this.adjacencyList.delete(vertex);
          // Remove vertex from all other adjacency lists
          this.adjacencyList.forEach((value, key) => {
              const index = value.indexOf(vertex);
              if (index > -1) {
                  value.splice(index, 1);
              }
          });
      }
  }

  /**
   * Connects the two vertex
   * @param vertex1 source vertex
   * @param vertex2 destination vertex
   */
  addEdge(vertex1: T, vertex2: T): void {
      if (this.adjacencyList.has(vertex1) && this.adjacencyList.has(vertex2)) {
          this.adjacencyList.get(vertex1)?.push(vertex2);
          this.adjacencyList.get(vertex2)?.push(vertex1);
      }
  }

  /**
   * Removes connection from the two vertex
   * @param vertex1 source vertex
   * @param vertex2 destination vertex
   */
  removeEdge(vertex1: T, vertex2: T): void {
      if (this.adjacencyList.has(vertex1) && this.adjacencyList.has(vertex2)) {
          const vertex1Edges = this.adjacencyList.get(vertex1);
          const vertex2Edges = this.adjacencyList.get(vertex2);
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

  /**
   * Traverses the Graph in Breadth First Search Manner
   * @param vertex Starting vertex or node to traverse from.
   */
  private bfs(vertex: T): void {
      const queue: T[] = [vertex];
      const visited: Set<T> = new Set();

      while (queue.length) {
          const currentVertex = queue.shift() as T;
          if (!visited.has(currentVertex)) {
              visited.add(currentVertex);
              console.log(currentVertex);
              const neighbors = this.adjacencyList.get(currentVertex) || [];
              neighbors.forEach(neighbor => {
                  if (!visited.has(neighbor)) {
                      queue.push(neighbor);
                  }
              });
          }
      }
  }

  /**
   * Traverses the Graph in Depth First Search Manner
   * @param vertex Starting vertex or node to traverse from.
   * @param visited (Optional) Set to traverse the whole operation.
   */
  private dfs(vertex: T, visited: Set<T> = new Set()): void {
      if (!visited.has(vertex)) {
          visited.add(vertex);
          console.log(vertex);
          const neighbors = this.adjacencyList.get(vertex) || [];
          neighbors.forEach(neighbor => {
              this.dfs(neighbor, visited);
          });
      }
  }

  /**
   * Traversing in a graph through either BFS or DFS approach.
   * @param vertex Starting vertex or node to traverse from.
   * @param traversalType type of traversing approach option: 'bfs' or 'dfs'
   */
  traverse(vertex: T, traversalType: 'bfs' | 'dfs'): void {
      if (traversalType === 'bfs') {
          this.bfs(vertex);
      } else if (traversalType === 'dfs') {
          this.dfs(vertex);
      }
  }
}
