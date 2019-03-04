// [Witten & Sanders, 1981]-style DLA
export let stepSize = 1; // as a factor to the radius
export let stickTolerance = 2;

export class Particle {
  constructor(x = 0, y = 0, radius = 0.05) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.radiusSquared = radius*radius;
    this.parent = null;
    this.parentDirection = 0; // in radians, ccw from positive x-axis
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
    this.parent = p; // save to whom i'm sticking to
    this.parentDirection = v.clone().negate().angle();
  }
  
  // checkStuck(c) {
  //   // quick check: outside the clusters radius?
  //   if (this.distanceSquared(c.particles[0]) > c.radiusSquared) {
  //     return false;
  //   }
  //   let nearest = c.nearestParticle(this);
  //   if (nearest.distanceSquared < (this.radiusSquared + nearest.particle.radiusSquared) * stickTolerance) {
  //     return nearest.particle;
  //   }
  //   return false;
  // }
  
  checkStuck(c) {
    // quick check: outside the clusters radius?
    if (this.distanceSquared(c.particles[0]) > c.radiusSquared) {
      return false;
    }
    for (let i=c.particles.length-1; i>=0; i--) { // check outer particles first
      let p = c.particles[i];
      if (this.distanceSquared(p) < (this.radiusSquared + p.radiusSquared) * stickTolerance) {
        return p;
      }
    }
    return false;
  }
}


export class Cluster {
  particles = []; // public class fields: since chrome 72
  size = 0;
  radius = 0;
  radiusSquared = 0;
  
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
  _useFloor = true;
  
  constructor(radius = 1, direction = 0, angle = 90) {
    this._radius = radius;
    this._radiusSquared = radius*radius;
    this._offsetInner = 0;
    this._clusterMarkerRadius = 0;
    this._direction = direction; // degrees. 0 is north. clockwise
    this._angle = angle; // degrees
    
    this.geometry = new THREE.BufferGeometry(); // spawner arc geometry
    this.geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array((this._segments+1)*3), 3) );
    this.geometryInner = new THREE.BufferGeometry(); // inner spawner arc geometry
    this.geometryInner.addAttribute('position', new THREE.BufferAttribute(new Float32Array((this._segments+1)*3), 3) );
    this.geometryClusterMarker= new THREE.BufferGeometry(); 
    this.geometryClusterMarker.addAttribute('position', new THREE.BufferAttribute(new Float32Array((this._segments+1)*3), 3) );
    
    this.material = new THREE.LineBasicMaterial({color: '#66EFFF', linewidth: 1});
    this.clusterMarkerMaterial = new THREE.LineBasicMaterial({color: '#FFBFAA', linewidth: 1});
    
    this.line = new THREE.Line(this.geometry, this.material);
    this.lineInner = new THREE.Line(this.geometryInner, this.material);
    this.clusterMarker = new THREE.Line(this.geometryClusterMarker, this.clusterMarkerMaterial);
    this.cross = new THREE.LineSegments(this.makeCrossGeo(), this.clusterMarkerMaterial);
    this.topmarker = new THREE.Line(this.makeTopmarkerGeo(), this.material);
    this.floor = new THREE.Line(this.makeFloorGeo(), this.material);
    this.floor.visible = this._useFloor;
    
    this.object = new THREE.Group();
    this.object.add(this.line);
    this.object.add(this.lineInner);
    this.object.add(this.clusterMarker);
    this.object.add(this.cross);
    this.object.add(this.topmarker);
    this.object.add(this.floor);
    
    this.updateObject();
  }
  
  // get the cartesian location for a parameter value
  getLocation(t, radius = this._radius) {
    let startAngle = 90 - (this._direction +  this._angle/2);
    let endAngle = startAngle +this._angle;
    let a = (startAngle + (endAngle - startAngle) * t) / 180 * Math.PI;
    return [ Math.cos(a) * radius, Math.sin(a) * radius, this._z ];
  }
  
  getSpawn() {
    if (this._offsetInner <= 0) {
      return this.getLocation(Math.random());
    }
    let minRadius = Math.max( 0, this._radius - this._offsetInner );
    let radius = Math.random() * (this._radius - minRadius) + minRadius; // determine random radius
    return this.getLocation(Math.random(), radius);
  }
  
  makeCrossGeo() {
    const r = this._radius * 0.05;
    let vertices = [-r/2,0,0,  r/2,0,0,  0,-r,0,  0,r,0];
    let geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3) );
    return geo;
  }
  
  makeFloorGeo() {
    const r = this._radius * 1.1;
    let vertices = [-r,0,0,  r,0,0];
    let geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3) );
    return geo;
  }
  
  makeTopmarkerGeo() {
    const r = this._radius * 0.01;
    let vertices = [0,-r,0,  0,r,0];
    let geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3) );
    return geo;
  }
  
  updateObject() {
    let vertices = [];
    let verticesInner = [];
    let verticesClusterMarker = [];
    for (let i=0; i<this._segments+1; i++) {
      vertices.push( ...this.getLocation(i/this._segments) );
      verticesInner.push( ...this.getLocation(i/this._segments, Math.max(0, this._radius - this._offsetInner)) );
      verticesClusterMarker.push( ...this.getLocation(i/this._segments, this._clusterMarkerRadius ));
    }
    let attr = this.geometry.attributes.position;
    attr.array.set(vertices);
    attr.needsUpdate = true;
    attr = this.geometryInner.attributes.position; attr.array.set(verticesInner); attr.needsUpdate = true;
    attr = this.geometryClusterMarker.attributes.position; attr.array.set(verticesClusterMarker); attr.needsUpdate = true;
    
    this.cross.rotation.z = (-this.direction) / 180 * Math.PI;
    this.topmarker.rotation.z = this.cross.rotation.z;
    let rot = (90-this.direction) / 180 * Math.PI; // convert to math angle
    this.topmarker.position.x = Math.cos(rot) * this._radius;
    this.topmarker.position.y = Math.sin(rot) * this._radius;
    this.floor.scale.x = this._radius;
  }
  
  get segments() { return this._segments; }
  set segments(n) { this._segments = Math.max(n, 1); this.updateObject(); }
  
  get radius() { return this._radius; }
  set radius(r) { this._radius = r; this._radiusSquared = r*r; this.updateObject(); }
  
  get offsetInner() { return this._offsetInner; }
  set offsetInner(o) { this._offsetInner = o; this.updateObject(); }
  
  get clusterMarkerRadius() { return this._clusterMarkerRadius; }
  set clusterMarkerRadius(r) { this._clusterMarkerRadius = r; this.updateObject(); }
  
  get angle() { return this._angle; }
  set angle(r) { this._angle = r; this.updateObject(); }
  
  get direction() { return this._direction; }
  set direction(r) { this._direction = r; this.updateObject(); }
  
  get useFloor() { return this._useFloor; }
  set useFloor(b) { this._useFloor = b; if (b) this.floor.visible = true; else this.floor.visible = false; }
  
  checkInside(p) {
    let inCircle = p.x*p.x + p.y*p.y < this._radiusSquared + p.radiusSquared;
    if (!this._useFloor) return inCircle;
    let aboveFloor = this._direction > -90 && this._direction < 90 ? p.y > 0 : p.y <= 0; // choose which side is 'above' the floor
    return inCircle && aboveFloor; // above the floor as well
  }
}
