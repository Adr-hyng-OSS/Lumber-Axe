import { Block, Vector3 } from "@minecraft/server";

/**
 * Represents a 3D vector as an array of three numbers [x, y, z].
 */
export type Vector3Array = [number, number, number];

/**
 * Represents a 3D vector with x, y, and z components.
 */
export class Vec3 {
    static EPSILON: number = 1e-8;

    static back = new Vec3(0, 0, -1);
    static down = new Vec3(0, -1, 0);
    static forward = new Vec3(0, 0, 1);
    static left = new Vec3(-1, 0, 0);
    static one = new Vec3(1, 1, 1);
    static right = new Vec3(1, 0, 0);
    static up = new Vec3(0, 1, 0);
    static zero = new Vec3(0, 0, 0);

    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number);
    constructor(other: Vec3);
    constructor(other: Vector3);
    constructor(other: Block);
    constructor(xOrOther: number | Vec3 | Vector3 | Block, y?: number, z?: number) {
      if (typeof xOrOther === "number" && y !== undefined && z !== undefined) {
        // Handle the case where three numbers are passed
        this.x = xOrOther;
        this.y = y;
        this.z = z;
      } else if (xOrOther instanceof Vec3 || xOrOther instanceof Block || typeof xOrOther === 'object') {
        // Handle the case where another Vec3 is passed
        this.x = xOrOther.x;
        this.y = xOrOther.y;
        this.z = xOrOther.z;
      } else {
        throw new Error("Invalid constructor arguments");
      }
    }
    /**
     * Creates a Vec3 instance from an array of numbers.
     * @param array The array containing three numbers representing x, y, and z.
     * @returns A new Vec3 instance.
     */
    static fromArray(array: Vector3Array): Vec3 {
        return new Vec3(array[0], array[1], array[2]);
    }

    /**
     * Creates a Vec3 instance from a string in the format "x, y, z".
     * @param str The stringified vector.
     * @returns A new Vec3 instance.
     */
    static fromString(str: string): Vec3 {
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

    /**
     * Calculates the length of the vector.
     * @returns The length of the vector.
     */
    length(): number {
        return Math.hypot(this.x, this.y, this.z);
    }

    /**
     * Calculates the squared length of the vector.
     * @returns The squared length of the vector.
     */
    lengthSquared(): number {
        return Math.pow(this.x, 2) + Math.pow(this.y, 2) + Math.pow(this.z, 2);
    }

    /**
     * Normalizes the vector.
     * @returns The normalized vector.
     */
    normalize(): Vec3 {
        const length = this.length();
        return length === 0 ? this : this.scale(1 / length);
    }

    /**
     * Adds another vector to this vector.
     * @param other The vector to add.
     * @returns The resulting vector after addition.
     */
    add(other: Vec3 | Vector3): Vec3 {
        return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
    }
    static add(a: Vec3 | Vector3, b:  Vec3 | Vector3): Vec3 {
        return new Vec3(b.x + a.x, b.y + a.y, b.z + a.z);
    }

    /**
     * Subtracts another vector from this vector.
     * @param other The vector to subtract.
     * @returns The resulting vector after subtraction.
     */
    sub(other: Vec3 | Vector3): Vec3 {
        return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    static sub(a: Vec3 | Vector3, b: Vec3 | Vector3): Vec3 {
        return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    /**
     * Multiplies this vector component-wise with another vector.
     * @param other The vector to multiply with.
     * @returns The resulting vector after multiplication.
     */
    mul(other: Vec3 | Vector3): Vec3 {
        return new Vec3(this.x * other.x, this.y * other.y, this.z * other.z);
    }
    static mul(a: Vec3 | Vector3, b: Vec3 | Vector3): Vec3 {
        return new Vec3(a.x * b.x, a.y * b.y, a.z * b.z);
    }

    /**
     * Divides this vector component-wise by another vector.
     * @param other The vector to divide by.
     * @returns The resulting vector after division.
     */
    div(other: Vec3 | Vector3): Vec3 {
        return new Vec3(this.x / other.x, this.y / other.y, this.z / other.z);
    }
    static div(a: Vec3 | Vector3, b: Vec3 | Vector3): Vec3 {
        return new Vec3(a.x / b.x, a.y / b.y, a.z / b.z);
    }

    /**
     * Scales this vector by a scalar value.
     * @param scalar The scalar value to scale by.
     * @returns The resulting scaled vector.
     */
    scale(scalar: number): Vec3 {
        return new Vec3(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    /**
     * Calculates the dot product of this vector with another vector.
     * @param other The other vector.
     * @returns The dot product.
     */
    dot(other: Vec3 | Vector3): number {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }

    /**
     * Calculates the cross product of this vector with another vector.
     * @param other The other vector.
     * @returns The cross product vector.
     */
    cross(other: Vec3 | Vector3): Vec3 {
        const x = this.y * other.z - this.z * other.y;
        const y = this.z * other.x - this.x * other.z;
        const z = this.x * other.y - this.y * other.x;
        return new Vec3(x, y, z);
    }

    /**
     * Checks if this Vec3 object is equal to another Vec3 object.
     * @param other The other Vec3 object to compare with.
     * @returns Returns true if the two Vec3 objects are equal, false otherwise.
     */
    equals(other: Vec3 | Vector3 | Block): boolean {
        return this.x === other.x && this.y === other.y && this.z === other.z;
    }
    static equals(a: Vec3 | Vector3 | Block, b: Vec3 | Vector3 | Block): boolean {
        return b.x === a.x && b.y === a.y && b.z === a.z;
    }

    /**
     * Checks if the current Vec3 is approximately equal to another Vec3 within a given tolerance.
     * @param other The other Vec3 to compare with.
     * @param tolerance The tolerance value for the comparison. Defaults to Vec3.EPSILON.
     * @returns True if the Vec3 is approximately equal to the other Vec3 within the tolerance, false otherwise.
     */
    equalsEpsilon(other: Vec3, tolerance: number = Vec3.EPSILON): boolean {
        return (
            Math.abs(this.x - other.x) <= tolerance &&
            Math.abs(this.y - other.y) <= tolerance &&
            Math.abs(this.z - other.z) <= tolerance
        );
    }

    /**
     * Checks if this Vec3 is approximately equal to another Vec3.
     * @param other The other Vec3 to compare with.
     * @returns True if the Vec3 is approximately equal, false otherwise.
     */
    equalsApprox(other: Vec3): boolean {
        return this.equalsEpsilon(other, Vec3.EPSILON);
    }

    /**
     * Calculates the triple scalar product of this vector with two other vectors.
     * The triple scalar product is defined as the dot product of the cross product of two vectors with this vector.
     * @param b The second vector.
     * @param c The third vector.
     * @returns The triple scalar product of the three vectors.
     */
    tripleScalar(b: Vec3, c: Vec3): number {
        return this.dot(b.cross(c));
    }

    /**
     * Calculates the barycentric coordinates of a point within a triangle defined by three vertices.
     * @param v1 The first vertex of the triangle.
     * @param v2 The second vertex of the triangle.
     * @param v3 The third vertex of the triangle.
     * @returns The barycentric coordinates of the point.
     */
    barycentricCoordinates(v1: Vec3, v2: Vec3, v3: Vec3): Vec3 {
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

    /**
     * Rotates the vector by the specified angle around the given axis.
     * @param angle The angle of rotation in radians.
     * @param axis The axis of rotation represented as a Vec3 object.
     * @returns The rotated vector.
     */
    rotate(angle: number, axis: Vec3): Vec3 {
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

    /**
     * Calculates the product of this vector and a given matrix.
     * @param matrix The matrix to multiply with.
     * @returns The resulting vector after the matrix multiplication.
     * @throws Error if the matrix dimensions are invalid.
     */
    matrixProduct(matrix: number[][]): Vec3 {
        if (
            matrix.length !== 3 ||
            matrix[0].length !== 3 ||
            matrix[1].length !== 3 ||
            matrix[2].length !== 3
        ) {
            throw new Error('Invalid matrix dimensions');
        }
        const x = this.x * matrix[0][0] + this.y * matrix[0][1] + this.z * matrix[0][2];
        const y = this.x * matrix[1][0] + this.y * matrix[1][1] + this.z * matrix[1][2];
        const z = this.x * matrix[2][0] + this.y * matrix[2][1] + this.z * matrix[2][2];
        return new Vec3(x, y, z);
    }

    /**
     * Returns a new Vec3 with the absolute values of each component.
     * @returns A new Vec3 containing the absolute values of this Vec3's components.
     */
    abs(): Vec3 {
        return new Vec3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z));
    }

    /**
     * Calculates the distance between this Vec3 and another Vec3.
     * @param other The other Vec3.
     * @returns The distance between this Vec3 and the other Vec3.
     */
    distance(other: Vec3 | Vector3): number {
        return this.sub(other).length();
    }
    static distance(a: Vec3 | Vector3 | Block, b: Vec3 | Vector3 | Block): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const distance = Math.hypot(dx, dy, dz);

        return distance;
    }

    /**
     * Calculates the squared distance between this Vec3 and another Vec3.
     * @param other The other Vec3.
     * @returns The squared distance between this Vec3 and the other Vec3.
     */
    distanceSquared(other: Vec3): number {
        return this.sub(other).lengthSquared();
    }

    /**
     * Calculates the angle between this Vec3 and another Vec3 in radians.
     * @param other The other Vec3.
     * @returns The angle between this Vec3 and the other Vec3 in radians.
     */
    angle(other: Vec3): number {
        return Math.acos(this.dot(other) / (this.length() * other.length()));
    }

    /**
     * Projects this Vec3 onto another Vec3.
     * @param other The Vec3 onto which to project.
     * @returns The projection of this Vec3 onto the other Vec3.
     * @throws Error if the other Vec3 is a zero vector.
     */
    projectOnto(other: Vec3): Vec3 {
        const lengthSquared = other.lengthSquared();
        if (lengthSquared === 0) {
            throw new Error('Cannot project onto a zero vector');
        }
        return other.scale(this.dot(other) / lengthSquared);
    }

    /**
     * Rejects this Vec3 from another Vec3.
     * @param other The Vec3 from which to reject.
     * @returns The rejection of this Vec3 from the other Vec3.
     */
    rejectFrom(other: Vec3): Vec3 {
        return this.sub(this.projectOnto(other));
    }

    /**
     * Reflects this Vec3 across another Vec3.
     * @param other The Vec3 across which to reflect.
     * @returns The reflection of this Vec3 across the other Vec3.
     */
    reflect(other: Vec3): Vec3 {
        return this.sub(this.projectOnto(other).scale(2));
    }

    /**
     * Refracts this Vec3 through a surface with a given normal and refraction index.
     * @param normal The surface normal.
     * @param eta The refraction index.
     * @returns The refraction of this Vec3 through the surface.
     */
    refract(normal: Vec3, eta: number): Vec3 {
        const dot = this.dot(normal);
        const k = 1 - eta * eta * (1 - dot * dot);
        return k < 0 ? new Vec3(0, 0, 0) : this.scale(eta).sub(normal.scale(eta * dot + Math.sqrt(k)));
    }

    /**
     * Performs linear interpolation between this Vec3 and another Vec3.
     * @param other The other Vec3.
     * @param t The interpolation parameter.
     * @returns The interpolated Vec3.
     */
    lerp(other: Vec3, t: number): Vec3 {
        return this.add(other.sub(this).scale(t));
    }
    static lerp(a: Vec3 | Vector3 | Block, b: Vec3 | Vector3 | Block, t: number): Vec3 {
        const dest = { x: a.x, y: a.y, z: a.z};
        dest.x += (b.x - a.x) * t;
        dest.y += (b.y - a.y) * t;
        dest.z += (b.z - a.z) * t;
        return new Vec3(dest);
    }

    /**
     * Performs spherical linear interpolation between this Vec3 and another Vec3.
     * @param other The other Vec3.
     * @param t The interpolation parameter.
     * @returns The interpolated Vec3.
     */
    slerp(other: Vec3, t: number): Vec3 {
        const dot = this.dot(other);
        const theta = Math.acos(dot);
        const sinTheta = Math.sin(theta);
        const scale1 = Math.sin((1 - t) * theta) / sinTheta;
        const scale2 = Math.sin(t * theta) / sinTheta;
        return this.scale(scale1).add(other.scale(scale2));
    }

    /**
     * Performs Hermite interpolation between this Vec3 and another Vec3 with given tangents.
     * @param other The other Vec3.
     * @param t The interpolation parameter.
     * @param tangent1 The tangent at the start.
     * @param tangent2 The tangent at the end.
     * @returns The interpolated Vec3.
     */
    hermite(other: Vec3, t: number, tangent1: Vec3, tangent2: Vec3): Vec3 {
        const t2 = t * t;
        const t3 = t2 * t;
        const h1 = 2 * t3 - 3 * t2 + 1;
        const h2 = -2 * t3 + 3 * t2;
        const h3 = t3 - 2 * t2 + t;
        const h4 = t3 - t2;
        return this.scale(h1).add(other.scale(h2)).add(tangent1.scale(h3)).add(tangent2.scale(h4));
    }

    /**
     * Calculates the quadratic bezier curve of a vector based on current step.
     * @param start starting vector
     * @param control control vector
     * @param end end vector
     * @param t current steps from start to end
     * @returns 
     */
    static quadracticBezier(start: Vector3, control: Vector3, end: Vector3, t: number): Vector3 {
        return {
            x: (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x, 
            y: (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y, 
            z: (1 - t) * (1 - t) * start.z + 2 * (1 - t) * t * control.z + t * t * end.z
        };
    }
    /**
     * Calculates a point on the Bezier curve defined by control points.
     * @param controlPoints The control points of the Bezier curve.
     * @param t The parameter determining the point on the curve.
     * @returns The point on the Bezier curve.
     */
    bezier(controlPoints: Vec3[], t: number): Vec3 {
        const n = controlPoints.length;
        let result = new Vec3(0, 0, 0);
        for (let i = 0; i < n; i++) {
            const coefficient =
                this.binomialCoefficient(n - 1, i) * Math.pow(1 - t, n - 1 - i) * Math.pow(t, i);
            result = result.add(controlPoints[i].scale(coefficient));
        }
        return result;
    }

    /**
     * Calculates the binomial coefficient (n choose k).
     * @param n The total number of items.
     * @param k The number of items to choose.
     * @returns The binomial coefficient (n choose k).
     */
    binomialCoefficient(n: number, k: number): number {
        if (k < 0 || k > n) {
            return 0;
        }
        if (k === 0 || k === n) {
            return 1;
        }
        return this.binomialCoefficient(n - 1, k - 1) + this.binomialCoefficient(n - 1, k);
    }

    /**
     * Calculates Catmull-Rom interpolation.
     * @param controlPoints The control points array.
     * @param t The interpolation parameter.
     * @param alpha The tension parameter (default is 0.5).
     * @returns The interpolated vector.
     */
    catmullRom(controlPoints: Vec3[], t: number, alpha: number = 0.5): Vec3 {
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

    /**
     * Returns the component-wise minimum of this vector and another vector.
     * @param other The other vector.
     * @returns The component-wise minimum vector.
     */
    min(other: Vec3): Vec3 {
        return new Vec3(Math.min(this.x, other.x), Math.min(this.y, other.y), Math.min(this.z, other.z));
    }

    /**
     * Returns the component-wise maximum of this vector and another vector.
     * @param other The other vector.
     * @returns The component-wise maximum vector.
     */
    max(other: Vec3): Vec3 {
        return new Vec3(Math.max(this.x, other.x), Math.max(this.y, other.y), Math.max(this.z, other.z));
    }

    /**
     * Clamps this vector to a specified range.
     * @param min The minimum range vector.
     * @param max The maximum range vector.
     * @returns The clamped vector.
     */
    clamp(min: Vec3, max: Vec3): Vec3 {
        return this.max(min).min(max);
    }

    /**
     * Rounds each component of this vector downwards to the nearest integer.
     * @returns The vector with rounded components.
     */
    floor(): Vec3 {
        return new Vec3(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    }

    /**
     * Rounds each component of this vector upwards to the nearest integer.
     * @returns The vector with rounded components.
     */
    ceil(): Vec3 {
        return new Vec3(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
    }

    /**
     * Rounds each component of this vector to the nearest integer.
     * @returns The vector with rounded components.
     */
    round(): Vec3 {
        return new Vec3(Math.round(this.x), Math.round(this.y), Math.round(this.z));
    }

    /**
     * Calculates the square root of each component of this vector.
     * @returns The vector with square root of components.
     */
    sqrt(): Vec3 {
        return new Vec3(Math.sqrt(this.x), Math.sqrt(this.y), Math.sqrt(this.z));
    }

    /**
     * Raises each component of this vector to the power of a specified exponent.
     * @param exponent The exponent to raise each component to.
     * @returns The vector with components raised to the power of exponent.
     */
    pow(exponent: number): Vec3 {
        return new Vec3(Math.pow(this.x, exponent), Math.pow(this.y, exponent), Math.pow(this.z, exponent));
    }

    /**
     * Calculates the exponential of each component of this vector (e^x).
     * @returns The vector with exponential components.
     */
    exp(): Vec3 {
        return new Vec3(Math.exp(this.x), Math.exp(this.y), Math.exp(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the natural logarithm of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the natural logarithms of the components of the original Vec3.
     */
    log(): Vec3 {
        return new Vec3(Math.log(this.x), Math.log(this.y), Math.log(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the sine of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the sine values of the components of the original Vec3.
     */
    sin(): Vec3 {
        return new Vec3(Math.sin(this.x), Math.sin(this.y), Math.sin(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the cosine of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the cosine values of the components of the original Vec3.
     */
    cos(): Vec3 {
        return new Vec3(Math.cos(this.x), Math.cos(this.y), Math.cos(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the tangent of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the tangent values of the components of the original Vec3.
     */
    tan(): Vec3 {
        return new Vec3(Math.tan(this.x), Math.tan(this.y), Math.tan(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the arcsine (in radians) of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the arcsine values (in radians) of the components of the original Vec3.
     */
    asin(): Vec3 {
        return new Vec3(Math.asin(this.x), Math.asin(this.y), Math.asin(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the arccosine (in radians) of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the arccosine values (in radians) of the components of the original Vec3.
     */
    acos(): Vec3 {
        return new Vec3(Math.acos(this.x), Math.acos(this.y), Math.acos(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the arctangent (in radians) of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the arctangent values (in radians) of the components of the original Vec3.
     */
    atan(): Vec3 {
        return new Vec3(Math.atan(this.x), Math.atan(this.y), Math.atan(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the hyperbolic sine of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the hyperbolic sine values of the components of the original Vec3.
     */
    sinh(): Vec3 {
        return new Vec3(Math.sinh(this.x), Math.sinh(this.y), Math.sinh(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the hyperbolic cosine of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the hyperbolic cosine values of the components of the original Vec3.
     */
    cosh(): Vec3 {
        return new Vec3(Math.cosh(this.x), Math.cosh(this.y), Math.cosh(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the hyperbolic tangent of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the hyperbolic tangent values of the components of the original Vec3.
     */
    tanh(): Vec3 {
        return new Vec3(Math.tanh(this.x), Math.tanh(this.y), Math.tanh(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the inverse hyperbolic sine of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the inverse hyperbolic sine values of the components of the original Vec3.
     */
    asinh(): Vec3 {
        return new Vec3(Math.asinh(this.x), Math.asinh(this.y), Math.asinh(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the inverse hyperbolic cosine of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the inverse hyperbolic cosine values of the components of the original Vec3.
     */
    acosh(): Vec3 {
        return new Vec3(Math.acosh(this.x), Math.acosh(this.y), Math.acosh(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the inverse hyperbolic tangent of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the inverse hyperbolic tangent values of the components of the original Vec3.
     */
    atanh(): Vec3 {
        return new Vec3(Math.atanh(this.x), Math.atanh(this.y), Math.atanh(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the sign of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the sign values of the components of the original Vec3.
     */
    sign(): Vec3 {
        return new Vec3(Math.sign(this.x), Math.sign(this.y), Math.sign(this.z));
    }

    /**
     * Returns a new Vec3 where each component is the fractional part of the corresponding component of the original Vec3.
     * @returns A new Vec3 containing the fractional parts of the components of the original Vec3.
     */
    fract(): Vec3 {
        return new Vec3(this.x - Math.floor(this.x), this.y - Math.floor(this.y), this.z - Math.floor(this.z));
    }

    /**
     * Performs modulo operation element-wise with another Vec3.
     * @param other The Vec3 to perform modulo with.
     * @returns A new Vec3 containing the result of the modulo operation.
     */
    mod(other: Vec3): Vec3 {
        return new Vec3(this.x % other.x, this.y % other.y, this.z % other.z);
    }

    /**
     * Determines whether each component of this Vec3 is less than the corresponding component of the provided edge Vec3.
     * @param edge The edge Vec3 to compare against.
     * @returns A new Vec3 where each component is 0 if less than the edge, or 1 otherwise.
     */
    step(edge: Vec3): Vec3 {
        return new Vec3(this.x < edge.x ? 0 : 1, this.y < edge.y ? 0 : 1, this.z < edge.z ? 0 : 1);
    }

    /**
     * Performs smoothstep interpolation between two edge Vec3s.
     * @param edge0 The starting edge Vec3.
     * @param edge1 The ending edge Vec3.
     * @returns A new Vec3 containing the result of smoothstep interpolation.
     */
    smoothstep(edge0: Vec3, edge1: Vec3): Vec3 {
        const t = this.sub(edge0).div(edge1.sub(edge0)).clamp(Vec3.zero, Vec3.one);
        return t.mul(t).mul(new Vec3(3, 3, 3).sub(t.scale(2)));
    }

    /**
     * Transforms this Vec3 from world space to tangent space using the provided normal and tangent vectors.
     * @param normal The normal vector in tangent space.
     * @param tangent The tangent vector in tangent space.
     * @returns A new Vec3 transformed to tangent space.
     */
    toTangentSpace(normal: Vec3, tangent: Vec3): Vec3 {
        const binormal = this.cross(normal);
        const tangentMatrix = [
            [tangent.x, binormal.x, normal.x],
            [tangent.y, binormal.y, normal.y],
            [tangent.z, binormal.z, normal.z]
        ];
        return this.matrixProduct(tangentMatrix);
    }

    /**
     * Generates Perlin noise for this Vec3 using the specified seed.
     * @param seed The seed for generating Perlin noise. Default is 0.
     * @returns A new Vec3 containing the Perlin noise values.
     */
    perlinNoise(seed: number = 0): Vec3 {
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
        const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
        const dotProduct = (grad: Vec3, x: number, y: number, z: number) =>
            grad.x * x + grad.y * y + grad.z * z;
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

    /**
     * Performs a custom linear interpolation between two Vec3 objects.
     * @param a The starting Vec3 object.
     * @param b The ending Vec3 object.
     * @param t The interpolation factor between 0 and 1.
     * @returns The interpolated Vec3 object.
     */
    customLerp(a: Vec3, b: Vec3, t: number): Vec3 {
        const x = a.x + t * (b.x - a.x);
        const y = a.y + t * (b.y - a.y);
        const z = a.z + t * (b.z - a.z);
        return new Vec3(x, y, z);
    }

    /**
     * Calculates the geodesic distance between this Vec3 and another Vec3 assuming they are points on the surface of a unit sphere.
     * @param other The other Vec3 to calculate the distance to.
     * @returns The geodesic distance between this Vec3 and the other Vec3.
     */
    geodesicDistance(other: Vec3): number {
        const radius = 1;
        const angle = this.angle(other);
        const distance = radius * angle;
        return distance;
    }

    /**
     * Calculates a point on a Catmull-Rom spline given four control points and a parameter 't'.
     * @param p0 The first control point.
     * @param p1 The second control point.
     * @param p2 The third control point.
     * @param p3 The fourth control point.
     * @param t The parameter controlling the position along the spline (0 <= t <= 1).
     * @returns The point on the Catmull-Rom spline corresponding to parameter 't'.
     */
    catmullRomSpline(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
        const t2 = t * t;
        const t3 = t2 * t;
        const h1 = -0.5 * t3 + t2 - 0.5 * t;
        const h2 = 1.5 * t3 - 2.5 * t2 + 1.0;
        const h3 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
        const h4 = 0.5 * t3 - 0.5 * t2;
        return p0.scale(h1).add(p1.scale(h2)).add(p2.scale(h3)).add(p3.scale(h4));
    }

    /**
     * Calculates the spherical angle between this vector and another vector.
     * @param other The other vector.
     * @returns The spherical angle between this vector and the 'other' vector in radians.
     */
    sphericalAngle(other: Vec3): number {
        const dotProduct = this.dot(other);
        const angle = Math.acos(dotProduct / (this.length() * other.length()));
        return angle;
    }

    /**
     * Calculates the complex conjugate of this vector.
     * @returns The complex conjugate of this vector.
     */
    complexConjugate(): Vec3 {
        return new Vec3(this.x, -this.y, -this.z);
    }

    /**
     * Scales the vector non-uniformly by the provided scaling factors.
     * @param scalingFactors The scaling factors for each axis (x, y, z).
     * @returns The resulting vector after non-uniform scaling.
     */
    nonUniformScale(scalingFactors: Vec3): Vec3 {
        return new Vec3(this.x * scalingFactors.x, this.y * scalingFactors.y, this.z * scalingFactors.z);
    }

    /**
     * Calculates the surface normal of a parametric surface at the specified (u, v) coordinates.
     * @param u The u parameter.
     * @param v The v parameter.
     * @returns The surface normal vector at the specified (u, v) coordinates.
     */
    surfaceNormal(u: number, v: number): Vec3 {
        const tangentU = this.partialDerivativeU(u, v);
        const tangentV = this.partialDerivativeV(u, v);
        const normal = tangentU.cross(tangentV).normalize();
        return normal;
    }

    /**
     * Calculates the partial derivative of the parametric surface with respect to the u parameter.
     * @param u The u parameter.
     * @param v The v parameter.
     * @returns The partial derivative with respect to u at the specified (u, v) coordinates.
     * @private
     */
    private partialDerivativeU(u: number, v: number): Vec3 {
        const deltaU = 0.0001;
        const point1 = this.evaluateParametricSurface(u - deltaU, v);
        const point2 = this.evaluateParametricSurface(u + deltaU, v);
        const tangentU = point2.sub(point1).scale(1 / (2 * deltaU));
        return tangentU;
    }

    /**
     * Calculates the partial derivative of the parametric surface with respect to the v parameter.
     * @param u The u parameter.
     * @param v The v parameter.
     * @returns The partial derivative with respect to v at the specified (u, v) coordinates.
     * @private
     */
    private partialDerivativeV(u: number, v: number): Vec3 {
        const deltaV = 0.0001;
        const point1 = this.evaluateParametricSurface(u, v - deltaV);
        const point2 = this.evaluateParametricSurface(u, v + deltaV);
        const tangentV = point2.sub(point1).scale(1 / (2 * deltaV));
        return tangentV;
    }

    /**
     * Evaluates the parametric surface at the specified (u, v) coordinates.
     * @param u The u parameter.
     * @param v The v parameter.
     * @returns The point on the parametric surface corresponding to the specified (u, v) coordinates.
     * @private
     */
    private evaluateParametricSurface(u: number, v: number): Vec3 {
        const radius = 1.0;
        const x = radius * Math.cos(u) * Math.sin(v);
        const y = radius * Math.sin(u) * Math.sin(v);
        const z = radius * Math.cos(v);
        return new Vec3(x, y, z);
    }

    /**
     * Calculates the divergence of the vector.
     * The divergence is the sum of the differences between each component of the vector and 0.
     * @returns The divergence value.
     */
    divergence(): number {
        const dx = this.x - 0;
        const dy = this.y - 0;
        const dz = this.z - 0;
        return dx + dy + dz;
    }

    /**
     * Calculates the curl of the vector.
     * The curl is a vector that represents the rotation of a vector field.
     * @returns The curl vector.
     */
    curl(): Vec3 {
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

    /**
     * Calculates the gradient of a scalar field at the current position.
     * @param scalarField The scalar field function.
     * @param epsilon The small value used for numerical differentiation. Default is 1e-6.
     * @returns The gradient vector.
     */
    gradient(scalarField: (position: Vec3) => number, epsilon: number = 1e-6): Vec3 {
        const dx =
            (scalarField(this.add(new Vec3(epsilon, 0, 0))) -
                scalarField(this.sub(new Vec3(epsilon, 0, 0)))) /
            (2 * epsilon);
        const dy =
            (scalarField(this.add(new Vec3(0, epsilon, 0))) -
                scalarField(this.sub(new Vec3(0, epsilon, 0)))) /
            (2 * epsilon);
        const dz =
            (scalarField(this.add(new Vec3(0, 0, epsilon))) -
                scalarField(this.sub(new Vec3(0, 0, epsilon)))) /
            (2 * epsilon);
        return new Vec3(dx, dy, dz);
    }

    /**
     * Converts the Vec3 object to an array of numbers.
     * The array contains the x, y, and z values of the Vec3 object in that order.
     * @returns An array of numbers representing the x, y, and z values of the Vec3 object.
     */
    toArray(): Vector3Array {
        return [this.x, this.y, this.z];
    }

    /**
     * Returns a string representation of the Vec3 object.
     * The string is formatted as "(x, y, z)".
     * @returns A string representation of the Vec3 object.
     */
    toString(): string {
        return `${this.x}, ${this.y}, ${this.z}`;
    }

    /**
     * Creates a string representation of a Vec3.
     * @param other The Vec3 object.
     * @returns A string representing the vector.
     */
    static toString(other: Vec3 | Vector3 | Block): string {
        return `${other.x}, ${other.y}, ${other.z}`;
    }
}
