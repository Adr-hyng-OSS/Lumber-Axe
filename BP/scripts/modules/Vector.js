var _a;
export class Vector {
    constructor(xOrObj, y, z) {
        if (typeof xOrObj === 'number' && typeof y === 'number' && typeof z === 'number') {
            this.x = xOrObj;
            this.y = y;
            this.z = z;
        }
        else if (typeof xOrObj === 'object' && xOrObj !== null) {
            this.x = xOrObj.x;
            this.y = xOrObj.y;
            this.z = xOrObj.z;
        }
        else {
            throw new Error('Invalid arguments provided to Vector constructor.');
        }
    }
    equals(other) {
        if (this.x === other.x && this.y === other.y && this.z === other.z)
            return true;
        else
            return false;
    }
    static equals(current, other) {
        if (current.x === other.x && current.y === other.y && current.z === other.z)
            return true;
        else
            return false;
    }
    length() {
        return Math.hypot(this.x, this.y, this.z);
    }
    lengthSquared() {
        return this.x ** 2 + this.y ** 2 + this.z ** 2;
    }
    normalized() {
        const magnitude = this.length();
        const DirectionX = this.x / magnitude;
        const DirectionY = this.y / magnitude;
        const DirectionZ = this.z / magnitude;
        return new Vector(DirectionX, DirectionY, DirectionZ);
    }
    static add(a, b) {
        const vector = new Vector(a.x, a.y, a.z);
        vector.x += b.x;
        vector.y += b.y;
        vector.z += b.z;
        return vector;
    }
    add(b) {
        const vector = new Vector(this.x, this.y, this.z);
        vector.x += b;
        vector.y += b;
        vector.z += b;
        return vector;
    }
    static cross(a, b) {
        return new Vector(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
    }
    static distance(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const distance = Math.hypot(dx, dy, dz);
        return distance;
    }
    static divide(a, b) {
        const vector = new Vector(a.x, a.y, a.z);
        if (typeof b === "number") {
            vector.x /= b;
            vector.y /= b;
            vector.z /= b;
        }
        else {
            vector.x /= b.x;
            vector.y /= b.y;
            vector.z /= b.z;
        }
        return vector;
    }
    static lerp(a, b, t) {
        const dest = new Vector(a.x, a.y, a.z);
        dest.x += (b.x - a.x) * t;
        dest.y += (b.y - a.y) * t;
        dest.z += (b.z - a.z) * t;
        return dest;
    }
    static max(a, b) {
        const vectors = [a, b];
        const arr = vectors.map(({ x, y, z }) => new Vector(x, y, z).length());
        const max = Math.max(...arr);
        const index = arr.indexOf(max);
        const vector3 = vectors[index];
        return new Vector(vector3.x, vector3.y, vector3.z);
    }
    static min(a, b) {
        const vectors = [a, b];
        const arr = vectors.map(({ x, y, z }) => new Vector(x, y, z).length());
        const min = Math.min(...arr);
        const index = arr.indexOf(min);
        const vector3 = vectors[index];
        return new Vector(vector3.x, vector3.y, vector3.z);
    }
    static multiply(a, b) {
        const vector = new Vector(a.x, a.y, a.z);
        if (typeof b === "number") {
            vector.x *= b;
            vector.y *= b;
            vector.z *= b;
        }
        else {
            vector.x *= b.x;
            vector.y *= b.y;
            vector.z *= b.z;
        }
        return vector;
    }
    static slerp(a, b, s) {
        function MathDot(a, b) {
            return a.map((x, i) => a[i] * b[i]).reduce((m, n) => m + n);
        }
        const θ = Math.acos(MathDot([a.x, a.y, a.z], [b.x, b.y, b.z]));
        const factor1 = Math.sin(θ * (1 - s)) / Math.sin(θ);
        const factor2 = Math.sin(θ * s) / Math.sin(θ);
        return new Vector(a.x * factor1 + b.x * factor2, a.y * factor1 + b.y * factor2, a.z * factor1 + b.z * factor2);
    }
    static subtract(a, b) {
        const vector = new Vector(a.x, a.y, a.z);
        vector.x -= b.x;
        vector.y -= b.y;
        vector.z -= b.z;
        return vector;
    }
    subtract(b) {
        const vector = new Vector(this.x, this.y, this.z);
        vector.x -= b;
        vector.y -= b;
        vector.z -= b;
        return vector;
    }
    clone() {
        return new Vector(this);
    }
}
_a = Vector;
Vector.back = new _a(0, 0, -1);
Vector.down = new _a(0, -1, 0);
Vector.forward = new _a(0, 0, 1);
Vector.left = new _a(-1, 0, 0);
Vector.one = new _a(1, 1, 1);
Vector.right = new _a(1, 0, 0);
Vector.up = new _a(0, 1, 0);
Vector.zero = new _a(0, 0, 0);
