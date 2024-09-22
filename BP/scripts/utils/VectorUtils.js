import { Block } from "@minecraft/server";
export class Vec3 {
    constructor(xOrOther, y, z) {
        if (typeof xOrOther === "number" && y !== undefined && z !== undefined) {
            this.x = xOrOther;
            this.y = y;
            this.z = z;
        }
        else if (xOrOther instanceof Vec3 || xOrOther instanceof Block || typeof xOrOther === 'object') {
            this.x = xOrOther.x;
            this.y = xOrOther.y;
            this.z = xOrOther.z;
        }
        else {
            throw new Error("Invalid constructor arguments");
        }
    }
    static fromArray(array) {
        return new Vec3(array[0], array[1], array[2]);
    }
    static fromString(str) {
        const parts = str.trim().split(',').map(part => part.trim());
        if (parts.length !== 3) {
            throw new Error('Invalid vector format. Expected "x, y, z".');
        }
        const [x, y, z] = parts.map(part => parseFloat(part));
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            throw new Error('Invalid vector components. Ensure all components are numbers.');
        }
        return new Vec3(x, y, z);
    }
    length() {
        return Math.hypot(this.x, this.y, this.z);
    }
    lengthSquared() {
        return Math.pow(this.x, 2) + Math.pow(this.y, 2) + Math.pow(this.z, 2);
    }
    normalize() {
        const length = this.length();
        return length === 0 ? this : this.scale(1 / length);
    }
    add(other) {
        return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
    }
    static add(a, b) {
        return new Vec3(b.x + a.x, b.y + a.y, b.z + a.z);
    }
    sub(other) {
        return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    static sub(a, b) {
        return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
    }
    mul(other) {
        return new Vec3(this.x * other.x, this.y * other.y, this.z * other.z);
    }
    static mul(a, b) {
        return new Vec3(a.x * b.x, a.y * b.y, a.z * b.z);
    }
    div(other) {
        return new Vec3(this.x / other.x, this.y / other.y, this.z / other.z);
    }
    static div(a, b) {
        return new Vec3(a.x / b.x, a.y / b.y, a.z / b.z);
    }
    scale(scalar) {
        return new Vec3(this.x * scalar, this.y * scalar, this.z * scalar);
    }
    dot(other) {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }
    cross(other) {
        const x = this.y * other.z - this.z * other.y;
        const y = this.z * other.x - this.x * other.z;
        const z = this.x * other.y - this.y * other.x;
        return new Vec3(x, y, z);
    }
    equals(other) {
        return this.x === other.x && this.y === other.y && this.z === other.z;
    }
    static equals(a, b) {
        return b.x === a.x && b.y === a.y && b.z === a.z;
    }
    equalsEpsilon(other, tolerance = Vec3.EPSILON) {
        return (Math.abs(this.x - other.x) <= tolerance &&
            Math.abs(this.y - other.y) <= tolerance &&
            Math.abs(this.z - other.z) <= tolerance);
    }
    equalsApprox(other) {
        return this.equalsEpsilon(other, Vec3.EPSILON);
    }
    tripleScalar(b, c) {
        return this.dot(b.cross(c));
    }
    barycentricCoordinates(v1, v2, v3) {
        const v2MinusV1 = v2.sub(v1);
        const v3MinusV1 = v3.sub(v1);
        const pointMinusV1 = this.sub(v1);
        const dot00 = v2MinusV1.dot(v2MinusV1);
        const dot01 = v2MinusV1.dot(v3MinusV1);
        const dot02 = v2MinusV1.dot(pointMinusV1);
        const dot11 = v3MinusV1.dot(v3MinusV1);
        const dot12 = v3MinusV1.dot(pointMinusV1);
        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
        return new Vec3(1 - u - v, u, v);
    }
    rotate(angle, axis) {
        const cosAngle = Math.cos(angle);
        const sinAngle = Math.sin(angle);
        const oneMinusCos = 1 - cosAngle;
        const rotationMatrix = [
            [
                oneMinusCos * axis.x * axis.x + cosAngle,
                oneMinusCos * axis.x * axis.y - sinAngle * axis.z,
                oneMinusCos * axis.x * axis.z + sinAngle * axis.y
            ],
            [
                oneMinusCos * axis.y * axis.x + sinAngle * axis.z,
                oneMinusCos * axis.y * axis.y + cosAngle,
                oneMinusCos * axis.y * axis.z - sinAngle * axis.x
            ],
            [
                oneMinusCos * axis.z * axis.x - sinAngle * axis.y,
                oneMinusCos * axis.z * axis.y + sinAngle * axis.x,
                oneMinusCos * axis.z * axis.z + cosAngle
            ]
        ];
        return this.matrixProduct(rotationMatrix);
    }
    matrixProduct(matrix) {
        if (matrix.length !== 3 ||
            matrix[0].length !== 3 ||
            matrix[1].length !== 3 ||
            matrix[2].length !== 3) {
            throw new Error('Invalid matrix dimensions');
        }
        const x = this.x * matrix[0][0] + this.y * matrix[0][1] + this.z * matrix[0][2];
        const y = this.x * matrix[1][0] + this.y * matrix[1][1] + this.z * matrix[1][2];
        const z = this.x * matrix[2][0] + this.y * matrix[2][1] + this.z * matrix[2][2];
        return new Vec3(x, y, z);
    }
    abs() {
        return new Vec3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z));
    }
    distance(other) {
        return this.sub(other).length();
    }
    static distance(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const distance = Math.hypot(dx, dy, dz);
        return distance;
    }
    distanceSquared(other) {
        return this.sub(other).lengthSquared();
    }
    angle(other) {
        return Math.acos(this.dot(other) / (this.length() * other.length()));
    }
    projectOnto(other) {
        const lengthSquared = other.lengthSquared();
        if (lengthSquared === 0) {
            throw new Error('Cannot project onto a zero vector');
        }
        return other.scale(this.dot(other) / lengthSquared);
    }
    rejectFrom(other) {
        return this.sub(this.projectOnto(other));
    }
    reflect(other) {
        return this.sub(this.projectOnto(other).scale(2));
    }
    refract(normal, eta) {
        const dot = this.dot(normal);
        const k = 1 - eta * eta * (1 - dot * dot);
        return k < 0 ? new Vec3(0, 0, 0) : this.scale(eta).sub(normal.scale(eta * dot + Math.sqrt(k)));
    }
    lerp(other, t) {
        return this.add(other.sub(this).scale(t));
    }
    static lerp(a, b, t) {
        const dest = { x: a.x, y: a.y, z: a.z };
        dest.x += (b.x - a.x) * t;
        dest.y += (b.y - a.y) * t;
        dest.z += (b.z - a.z) * t;
        return new Vec3(dest);
    }
    slerp(other, t) {
        const dot = this.dot(other);
        const theta = Math.acos(dot);
        const sinTheta = Math.sin(theta);
        const scale1 = Math.sin((1 - t) * theta) / sinTheta;
        const scale2 = Math.sin(t * theta) / sinTheta;
        return this.scale(scale1).add(other.scale(scale2));
    }
    hermite(other, t, tangent1, tangent2) {
        const t2 = t * t;
        const t3 = t2 * t;
        const h1 = 2 * t3 - 3 * t2 + 1;
        const h2 = -2 * t3 + 3 * t2;
        const h3 = t3 - 2 * t2 + t;
        const h4 = t3 - t2;
        return this.scale(h1).add(other.scale(h2)).add(tangent1.scale(h3)).add(tangent2.scale(h4));
    }
    static quadracticBezier(start, control, end, t) {
        return {
            x: (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
            y: (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
            z: (1 - t) * (1 - t) * start.z + 2 * (1 - t) * t * control.z + t * t * end.z
        };
    }
    bezier(controlPoints, t) {
        const n = controlPoints.length;
        let result = new Vec3(0, 0, 0);
        for (let i = 0; i < n; i++) {
            const coefficient = this.binomialCoefficient(n - 1, i) * Math.pow(1 - t, n - 1 - i) * Math.pow(t, i);
            result = result.add(controlPoints[i].scale(coefficient));
        }
        return result;
    }
    binomialCoefficient(n, k) {
        if (k < 0 || k > n) {
            return 0;
        }
        if (k === 0 || k === n) {
            return 1;
        }
        return this.binomialCoefficient(n - 1, k - 1) + this.binomialCoefficient(n - 1, k);
    }
    catmullRom(controlPoints, t, alpha = 0.5) {
        const p0 = controlPoints[0];
        const p1 = controlPoints[1];
        const p2 = controlPoints[2];
        const p3 = controlPoints[3];
        const t2 = t * t;
        const t3 = t2 * t;
        const h1 = -alpha * t3 + 2 * alpha * t2 - alpha * t;
        const h2 = (2 - alpha) * t3 + (alpha - 3) * t2 + 1;
        const h3 = (alpha - 2) * t3 + (3 - 2 * alpha) * t2 + alpha * t;
        const h4 = alpha * t3 - alpha * t2;
        return p0.scale(h1).add(p1.scale(h2)).add(p2.scale(h3)).add(p3.scale(h4));
    }
    min(other) {
        return new Vec3(Math.min(this.x, other.x), Math.min(this.y, other.y), Math.min(this.z, other.z));
    }
    max(other) {
        return new Vec3(Math.max(this.x, other.x), Math.max(this.y, other.y), Math.max(this.z, other.z));
    }
    clamp(min, max) {
        return this.max(min).min(max);
    }
    floor() {
        return new Vec3(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    }
    ceil() {
        return new Vec3(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
    }
    round() {
        return new Vec3(Math.round(this.x), Math.round(this.y), Math.round(this.z));
    }
    sqrt() {
        return new Vec3(Math.sqrt(this.x), Math.sqrt(this.y), Math.sqrt(this.z));
    }
    pow(exponent) {
        return new Vec3(Math.pow(this.x, exponent), Math.pow(this.y, exponent), Math.pow(this.z, exponent));
    }
    exp() {
        return new Vec3(Math.exp(this.x), Math.exp(this.y), Math.exp(this.z));
    }
    log() {
        return new Vec3(Math.log(this.x), Math.log(this.y), Math.log(this.z));
    }
    sin() {
        return new Vec3(Math.sin(this.x), Math.sin(this.y), Math.sin(this.z));
    }
    cos() {
        return new Vec3(Math.cos(this.x), Math.cos(this.y), Math.cos(this.z));
    }
    tan() {
        return new Vec3(Math.tan(this.x), Math.tan(this.y), Math.tan(this.z));
    }
    asin() {
        return new Vec3(Math.asin(this.x), Math.asin(this.y), Math.asin(this.z));
    }
    acos() {
        return new Vec3(Math.acos(this.x), Math.acos(this.y), Math.acos(this.z));
    }
    atan() {
        return new Vec3(Math.atan(this.x), Math.atan(this.y), Math.atan(this.z));
    }
    sinh() {
        return new Vec3(Math.sinh(this.x), Math.sinh(this.y), Math.sinh(this.z));
    }
    cosh() {
        return new Vec3(Math.cosh(this.x), Math.cosh(this.y), Math.cosh(this.z));
    }
    tanh() {
        return new Vec3(Math.tanh(this.x), Math.tanh(this.y), Math.tanh(this.z));
    }
    asinh() {
        return new Vec3(Math.asinh(this.x), Math.asinh(this.y), Math.asinh(this.z));
    }
    acosh() {
        return new Vec3(Math.acosh(this.x), Math.acosh(this.y), Math.acosh(this.z));
    }
    atanh() {
        return new Vec3(Math.atanh(this.x), Math.atanh(this.y), Math.atanh(this.z));
    }
    sign() {
        return new Vec3(Math.sign(this.x), Math.sign(this.y), Math.sign(this.z));
    }
    fract() {
        return new Vec3(this.x - Math.floor(this.x), this.y - Math.floor(this.y), this.z - Math.floor(this.z));
    }
    mod(other) {
        return new Vec3(this.x % other.x, this.y % other.y, this.z % other.z);
    }
    step(edge) {
        return new Vec3(this.x < edge.x ? 0 : 1, this.y < edge.y ? 0 : 1, this.z < edge.z ? 0 : 1);
    }
    smoothstep(edge0, edge1) {
        const t = this.sub(edge0).div(edge1.sub(edge0)).clamp(Vec3.zero, Vec3.one);
        return t.mul(t).mul(new Vec3(3, 3, 3).sub(t.scale(2)));
    }
    toTangentSpace(normal, tangent) {
        const binormal = this.cross(normal);
        const tangentMatrix = [
            [tangent.x, binormal.x, normal.x],
            [tangent.y, binormal.y, normal.y],
            [tangent.z, binormal.z, normal.z]
        ];
        return this.matrixProduct(tangentMatrix);
    }
    perlinNoise(seed = 0) {
        const permutation = new Array(256);
        for (let i = 0; i < 256; i++) {
            permutation[i] = (seed + i) % 256;
        }
        const gradients = [
            new Vec3(1, 1, 0),
            new Vec3(-1, 1, 0),
            new Vec3(1, -1, 0),
            new Vec3(-1, -1, 0),
            new Vec3(1, 0, 1),
            new Vec3(-1, 0, 1),
            new Vec3(1, 0, -1),
            new Vec3(-1, 0, -1),
            new Vec3(0, 1, 1),
            new Vec3(0, -1, 1),
            new Vec3(0, 1, -1),
            new Vec3(0, -1, -1),
            new Vec3(1, 1, 0),
            new Vec3(0, -1, 1),
            new Vec3(-1, 1, 0),
            new Vec3(0, -1, -1)
        ];
        const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
        const dotProduct = (grad, x, y, z) => grad.x * x + grad.y * y + grad.z * z;
        const unitX = Math.floor(this.x) & 255;
        const unitY = Math.floor(this.y) & 255;
        const unitZ = Math.floor(this.z) & 255;
        const relX = this.x - Math.floor(this.x);
        const relY = this.y - Math.floor(this.y);
        const relZ = this.z - Math.floor(this.z);
        const u = fade(relX);
        const v = fade(relY);
        const w = fade(relZ);
        const A = permutation[unitX] + unitY;
        const AA = permutation[A] + unitZ;
        const AB = permutation[A + 1] + unitZ;
        const B = permutation[unitX + 1] + unitY;
        const BA = permutation[B] + unitZ;
        const BB = permutation[B + 1] + unitZ;
        const gradAA = gradients[permutation[AA] % 16];
        const gradAB = gradients[permutation[AB] % 16];
        const gradBA = gradients[permutation[BA] % 16];
        const gradBB = gradients[permutation[BB] % 16];
        const lerpX1 = dotProduct(gradAA, relX, relY, relZ);
        const lerpX2 = dotProduct(gradBA, relX - 1, relY, relZ);
        const lerpX3 = dotProduct(gradAB, relX, relY - 1, relZ);
        const lerpX4 = dotProduct(gradBB, relX - 1, relY - 1, relZ);
        const lerpX5 = dotProduct(gradAA, relX, relY, relZ - 1);
        const lerpX6 = dotProduct(gradBA, relX - 1, relY, relZ - 1);
        const lerpX7 = dotProduct(gradAB, relX, relY - 1, relZ - 1);
        const lerpX8 = dotProduct(gradBB, relX - 1, relY - 1, relZ - 1);
        const lerpY1 = this.lerp(new Vec3(lerpX1, lerpX2, lerpX3), v);
        const lerpY2 = this.lerp(new Vec3(lerpX4, lerpX5, lerpX6), v);
        const lerpY3 = this.lerp(new Vec3(lerpX7, lerpX8, lerpX1), v);
        const lerpY4 = this.lerp(new Vec3(lerpX2, lerpX3, lerpX4), v);
        const lerpZ1 = this.customLerp(lerpY1, lerpY2, w);
        const lerpZ2 = this.customLerp(lerpY3, lerpY4, w);
        const finalNoiseValue = this.customLerp(lerpZ1, lerpZ2, w);
        return finalNoiseValue;
    }
    customLerp(a, b, t) {
        const x = a.x + t * (b.x - a.x);
        const y = a.y + t * (b.y - a.y);
        const z = a.z + t * (b.z - a.z);
        return new Vec3(x, y, z);
    }
    geodesicDistance(other) {
        const radius = 1;
        const angle = this.angle(other);
        const distance = radius * angle;
        return distance;
    }
    catmullRomSpline(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        const h1 = -0.5 * t3 + t2 - 0.5 * t;
        const h2 = 1.5 * t3 - 2.5 * t2 + 1.0;
        const h3 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
        const h4 = 0.5 * t3 - 0.5 * t2;
        return p0.scale(h1).add(p1.scale(h2)).add(p2.scale(h3)).add(p3.scale(h4));
    }
    sphericalAngle(other) {
        const dotProduct = this.dot(other);
        const angle = Math.acos(dotProduct / (this.length() * other.length()));
        return angle;
    }
    complexConjugate() {
        return new Vec3(this.x, -this.y, -this.z);
    }
    nonUniformScale(scalingFactors) {
        return new Vec3(this.x * scalingFactors.x, this.y * scalingFactors.y, this.z * scalingFactors.z);
    }
    surfaceNormal(u, v) {
        const tangentU = this.partialDerivativeU(u, v);
        const tangentV = this.partialDerivativeV(u, v);
        const normal = tangentU.cross(tangentV).normalize();
        return normal;
    }
    partialDerivativeU(u, v) {
        const deltaU = 0.0001;
        const point1 = this.evaluateParametricSurface(u - deltaU, v);
        const point2 = this.evaluateParametricSurface(u + deltaU, v);
        const tangentU = point2.sub(point1).scale(1 / (2 * deltaU));
        return tangentU;
    }
    partialDerivativeV(u, v) {
        const deltaV = 0.0001;
        const point1 = this.evaluateParametricSurface(u, v - deltaV);
        const point2 = this.evaluateParametricSurface(u, v + deltaV);
        const tangentV = point2.sub(point1).scale(1 / (2 * deltaV));
        return tangentV;
    }
    evaluateParametricSurface(u, v) {
        const radius = 1.0;
        const x = radius * Math.cos(u) * Math.sin(v);
        const y = radius * Math.sin(u) * Math.sin(v);
        const z = radius * Math.cos(v);
        return new Vec3(x, y, z);
    }
    divergence() {
        const dx = this.x - 0;
        const dy = this.y - 0;
        const dz = this.z - 0;
        return dx + dy + dz;
    }
    curl() {
        const i = new Vec3(1, 0, 0);
        const j = new Vec3(0, 1, 0);
        const k = new Vec3(0, 0, 1);
        const f_z = this.add(k).z;
        const b_z = this.sub(k).z;
        const e_y = this.add(j).y;
        const c_y = this.sub(j).y;
        const d_x = this.add(i).x;
        const f_x = this.sub(i).x;
        const curl_x = f_z - b_z - (e_y - c_y);
        const curl_y = d_x - f_x - (f_z - b_z);
        const curl_z = e_y - this.y - (this.x - d_x);
        return new Vec3(curl_x, curl_y, curl_z);
    }
    gradient(scalarField, epsilon = 1e-6) {
        const dx = (scalarField(this.add(new Vec3(epsilon, 0, 0))) -
            scalarField(this.sub(new Vec3(epsilon, 0, 0)))) /
            (2 * epsilon);
        const dy = (scalarField(this.add(new Vec3(0, epsilon, 0))) -
            scalarField(this.sub(new Vec3(0, epsilon, 0)))) /
            (2 * epsilon);
        const dz = (scalarField(this.add(new Vec3(0, 0, epsilon))) -
            scalarField(this.sub(new Vec3(0, 0, epsilon)))) /
            (2 * epsilon);
        return new Vec3(dx, dy, dz);
    }
    toArray() {
        return [this.x, this.y, this.z];
    }
    toString() {
        return `${this.x}, ${this.y}, ${this.z}`;
    }
    static toString(other) {
        return `${other.x}, ${other.y}, ${other.z}`;
    }
}
Vec3.EPSILON = 1e-8;
Vec3.back = new Vec3(0, 0, -1);
Vec3.down = new Vec3(0, -1, 0);
Vec3.forward = new Vec3(0, 0, 1);
Vec3.left = new Vec3(-1, 0, 0);
Vec3.one = new Vec3(1, 1, 1);
Vec3.right = new Vec3(1, 0, 0);
Vec3.up = new Vec3(0, 1, 0);
Vec3.zero = new Vec3(0, 0, 0);
