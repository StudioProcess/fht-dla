// Witten & Sanders, 1981 style DLA
let stepSize = 1;


export class Particle {
  constructor(x = 0, y = 0, radius = 0.05) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }
  
  step(n = 1) {
    let angle = Math.random() * 2 * Math.PI;
    this.x += Math.cos(angle) * stepSize;
    this.y += Math.sin(angle) * stepSize;
    if (n > 1) this.step(n-1);
  }
  
  distanceSquared(p) {
    let dx = p.x - this.x;
    let dy = p.y - this.y;
    return (dx * dx) + (dy * dy);
  }
  
  distance(p) {
    return Math.sqrt(this.distanceSquared(p));
  }
  
  // Move this particle so it touches p
  stickTo(p) {
    let v = new THREE.Vector2(this.x - p.x, this.y - p.y); // vector from p to this
    v.setLength(this.radius + p.radius);
    this.x = p.x + v.x;
    this.y = p.y + v.y;
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
  
  // Stick p onto the nearest particle in the cluster
  stickOn(p) {
    // find nearest particle
    let nearest = null;
    let minDistSquared = Number.MAX_SAFE_INTEGER;
    for (let pi of this.particles) {
      let dist = p.distanceSquared(pi);
      if (dist < minDistSquared) {
        minDistSquared = dist;
        nearest = pi;
      }
    }
    // stick p on (moves p to touch nearest)
    p.stickTo(nearest);
    // add
    this.add(p);
  }
}
