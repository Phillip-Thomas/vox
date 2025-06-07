// Simple noise function for procedural generation
class SimplexNoise {
  constructor(seed = 1) {
    this.seed = seed;
  }

  // Simple hash function
  hash(x, y) {
    let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  // Interpolation function
  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Smooth interpolation
  smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  // 2D noise
  noise2D(x, y) {
    // Scale the coordinates
    const scale = 0.1;
    x *= scale;
    y *= scale;

    // Get integer coordinates
    const xi = Math.floor(x);
    const yi = Math.floor(y);

    // Get fractional coordinates
    const xf = x - xi;
    const yf = y - yi;

    // Get noise values at corners
    const a = this.hash(xi, yi);
    const b = this.hash(xi + 1, yi);
    const c = this.hash(xi, yi + 1);
    const d = this.hash(xi + 1, yi + 1);

    // Interpolate
    const u = this.smoothstep(xf);
    const v = this.smoothstep(yf);

    const i1 = this.lerp(a, b, u);
    const i2 = this.lerp(c, d, u);

    return this.lerp(i1, i2, v);
  }

  // Fractal noise with multiple octaves
  fractalNoise2D(x, y, octaves = 4, persistence = 0.5) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue;
  }
}

export default SimplexNoise; 