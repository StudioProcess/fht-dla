// [Witten & Sanders, 1981]-style DLA
export let stepSize = 1; // as a factor to the radius
export let stickTolerance = 2;

export class Particle {
  constructor(x = 0, y = 0, radius = 0.05) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.radiusSquared = radius*radius;
  }
  
  // Perform a number of brownian motion steps
  step(n = 1) {
    let angle = Math.random() * 2 * Math.PI;
    this.x += Math.cos(angle) * stepSize*this.radius;
    this.y += Math.sin(angle) * stepSize*this.radius;
    if (n > 1) this.step(n-1);
  }
  
  // Distance squared to another particle
  distanceSquared(p) {
    let dx = p.x - this.x;
    let dy = p.y - this.y;
    return (dx * dx) + (dy * dy);
  }
  
  // Euclidian distance to another particle
  distance(p) {
    return Math.sqrt(this.distanceSquared(p));
  }
  
  // Move this particle so it touches another particle p
  stickTo(p) {
    let v = new THREE.Vector2(this.x - p.x, this.y - p.y); // vector from p to this
    v.setLength(this.radius + p.radius);
    this.x = p.x + v.x;
    this.y = p.y + v.y;
  }
  
  checkStuck(c) {
    // quick check: outside the clusters radius?
    if (this.distanceSquared(c.particles[0]) > c.radiusSquared) {
      return false;
    }
    let nearest = c.nearestParticle(this);
    if (nearest.distanceSquared < (this.radiusSquared + nearest.particle.radiusSquared) * stickTolerance) {
      return nearest.particle;
    }
    return false;
  }
}


export class Cluster {
  particles = []; // public class fields: since chrome 72
  size = 0;
  radius = 0;
  radiusSquared = 0;
  
  constructor(x = 0, y = 0, radius = 0.05) {
    let p = new Particle(x, y, radius);
    this.particles.push(p);
    this.size = 1;
    this.radius = p.radius;
    this.radiusSquared = p.radius * p.radius;
  }
  
  // Add particle to the cluster (without moving it), update cluster radius accordingly
  add(p) {
    // add
    this.particles.push(p);
    this.size++;
    // compute new cluster radius
    let radius = this.particles[0].distance(p) + p.radius;
    if (radius > this.radius) {
      this.radius = radius;
      this.radiusSquared = radius * radius;
    }
  }
  
  // Find nearest particle to p inside this cluster
  nearestParticle(p) {
    let nearest = null;
    let minDistSquared = Number.MAX_SAFE_INTEGER;
    for (let pi of this.particles) {
      let dist = p.distanceSquared(pi);
      if (dist < minDistSquared) {
        minDistSquared = dist;
        nearest = pi;
      }
    }
    return { particle: nearest, distanceSquared: minDistSquared };
  }
  
  // Stick p onto the nearest particle in the cluster
  stickOn(p) {
    // find nearest particle
    let nearest = this.nearestParticle(p).particle;
    // stick p on (moves p to touch nearest)
    p.stickTo(nearest);
    // add
    this.add(p);
  }
}


// Just a parametric geometry, with parameter: [0..1]
export class Spawner {
  _segments = 32;
  _z = 1;
  
  constructor(radius = 1, direction = 0, angle = 90) {
    this._radius = radius;
    this._radiusSquared = radius*radius;
    this._direction = direction; // degrees. 0 is north. clockwise
    this._angle = angle; // degrees
    this.geometry = this.makeGeometry();
    this.material = new THREE.LineBasicMaterial({color: '#00BFFF', linewidth: 2});
    this.object = new THREE.Line(this.geometry, this.material);
  }
  
  // get the cartesian location for a parameter value
  getLocation(t) {
    let startAngle = 90 - (this._direction +  this._angle/2);
    let endAngle = startAngle +this._angle;
    let a = (startAngle + (endAngle - startAngle) * t) / 180 * Math.PI;
    return [ Math.cos(a) * this._radius, Math.sin(a) * this._radius, this._z ];
  }
  
  getSpawn() {
    return this.getLocation(Math.random());
  }
  
  makeGeometry() {
    let vertices = [];
    for (let i=0; i<this._segments+1; i++) {
      vertices.push( ...this.getLocation(i/this._segments) );
    }
    let geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3) );
    return geo;
  }
  
  updateObject() {
    this.geometry = this.makeGeometry(this._segments);
    this.object.geometry = this.geometry;
  }
  
  get segments() { return this._segments; }
  set segments(n) { this._segments = Math.max(n, 1); this.updateObject(); }
  
  get radius() { return this._radius; }
  set radius(r) { this._radius = r; this._radiusSquared = r*r; this.updateObject(); }
  
  get angle() { return this._angle; }
  set angle(r) { this._angle = r; this.updateObject(); }
  
  get direction() { return this._direction; }
  set direction(r) { this._direction = r; this.updateObject(); }
  
  checkInside(p) {
    return p.x*p.x + p.y*p.y < this._radiusSquared;
  }
}
