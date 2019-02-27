import * as util from './util.js';
import * as tilesaver from './tilesaver.js';
import * as dla from './dla.js';
import { GUI } from '../node_modules/dat.gui/build/dat.gui.module.js';

const W = 1280;
const H = 800;
const TILES = 8;
const MAX_PARTICLES = 100000; // size of preallocated geometry

let particleCount = 0; // total particle count / cluster size
let renderer, scene, camera, controls;
let geo, mat, mesh;
let cluster, spawner;
let gui;

let params = {
  spawn_direction: 0,
  spawn_angle: 45,
  spawn_radius: 1,
  
  particle_size: 0.010,
  particle_detail: 32,
  particle_mode: 'nearest',
  
  cluster_size: 100,
  cluster_grow: null,
};

const shader = {
  vs: `
    precision highp float;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    // uniform float time;
    
    attribute vec3 position;
    attribute vec3 offset;
    attribute vec4 color;
    attribute float size;
    
    varying vec4 vColor;
    
    void main() {
      vColor = color;
      vec3 vPosition = position * size + offset;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( vPosition, 1.0 );
    }`,
  fs: `
    precision highp float;
    // uniform float time;
    varying vec4 vColor;
    
    void main() {
      gl_FragColor = vColor;
    }`
};

(function main() {  
  
  setup(); // set up scene
  loop(); // start game loop

})();



function setup() {
  
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize( W, H );
  // renderer.setPixelRatio( window.devicePixelRatio );
  document.body.appendChild( renderer.domElement );
  
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera( -W/H, W/H, 1, -1, -1, 1000 ); // left, right, top, bottom, near, far
  controls = new THREE.OrbitControls( camera, renderer.domElement );
  controls.screenSpacePanning = true;
  controls.enableKeys = false;
  controls.enableRotate = false;
  controls.zoomSpeed = 1;
  // console.log(controls);
  tilesaver.init(renderer, scene, camera, TILES);
  
  
  cluster = new dla.Cluster(0,0,params.particle_size/2); 
  spawner = new dla.Spawner();
  scene.add( spawner.object );
  
  let circle = new THREE.CircleGeometry( 0.5, params.particle_detail );
  geo = new THREE.InstancedBufferGeometry().fromGeometry(circle);
  geo.addAttribute( 'offset', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES*3), 3) );
  geo.addAttribute( 'color', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES*4), 4) );
  geo.addAttribute( 'size', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES*1), 1) );
  geo.attributes.offset.dynamic = true;
  geo.attributes.color.dynamic = true;
  geo.attributes.size.dynamic = true;
  
  geo.maxInstancedCount = 100; // start drawing nothing
  // geo.setDrawRange(0, 100); // TODO: this or maxInstancedCount?
  
  mat = new THREE.RawShaderMaterial({
    vertexShader: shader.vs,
    fragmentShader: shader.fs,
    // side: THREE.DoubleSide,
    transparent: true
  });

  mesh = new THREE.Mesh( geo, mat );
  mesh.frustumCulled = false;
  scene.add( mesh );
  console.log(mesh);
  
  createGUI();
  
    Math.seedrandom(0);
}

function loop(time) { // eslint-disable-line no-unused-vars
  
  requestAnimationFrame( loop );
  renderer.render( scene, camera );
  
}

function xmarker() {
  let geo = new THREE.CircleBufferGeometry(0.5, 4);
  let mat = new THREE.MeshBasicMaterial({wireframe:true, side:THREE.DoubleSide});
  let mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.z = Math.PI / 4;
  return mesh;
}

document.addEventListener('keydown', e => {
  // console.log(e.key, e.keyCode, e);

  if (e.key == 'f') { // f .. fullscreen
    util.toggleFullscreen();
  }

  else if (e.key == 's') { // s .. save frame
    util.saveCanvas();
  }
  
  else if (e.key == 'x') { // x .. export hires
    let wasVisible = spawner.object.visible;
    if (wasVisible) spawner.object.visible = false;
    tilesaver.save();
    if (wasVisible) spawner.object.visible = true;
  }
  
  else if (e.key == 'Backspace') {
    resetCamera();
  }
  
  else if (e.key == '1') { camera.clearViewOffset(); tileFactor=1; }
  else if (e.key == '2') { setTile(2, 0, 0); }
  else if (e.key == '3') { setTile(3, 0, 0); }
  else if (e.key == '4') { setTile(4, 0, 0); }
  else if (e.key == '5') { setTile(5, 0, 0); }
  else if (e.key == '6') { setTile(6, 0, 0); }
  else if (e.key == '7') { setTile(7, 0, 0); }
  else if (e.key == '8') { setTile(8, 0, 0); }
  else if (e.key == '9') { setTile(9, 0, 0); }
  else if (e.key == 'ArrowLeft')  { setTile(tileFactor, tileX-1, tileY); }
  else if (e.key == 'ArrowRight') { setTile(tileFactor, tileX+1, tileY); }
  else if (e.key == 'ArrowUp')    { setTile(tileFactor, tileX, tileY-1); }
  else if (e.key == 'ArrowDown')  { setTile(tileFactor, tileX, tileY+1); }
});

let tileFactor = 1;
let tileX = 0;
let tileY = 0;

function setTile(factor, x, y) {
  // console.log(factor, x, y);
  tileFactor = factor;
  tileX = (x+factor) % factor;
  tileY = (y+factor) % factor;
  let fullWidth = W * factor;
  let fullHeight = H * factor;
  let tileWidth = W;
  let tileHeight = H;
  let offsetX = tileX * W;
  let offsetY = tileY * H;
  console.log(`TILE ${tileX},${tileY} / OFFSET ${offsetX},${offsetY} / TOTAL ${fullWidth}x${fullHeight}`);
  camera.setViewOffset( fullWidth, fullHeight, offsetX, offsetY, tileWidth, tileHeight );
}

function resetCamera() {
  camera.position.set(0,0,0);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  controls.target.set(0,0,0);
}

function createGUI() {
  gui = new GUI();

  gui.add(params, 'spawn_direction', -180, 180).onChange(v => {
    spawner.direction = v;
  });
  gui.add(params, 'spawn_angle', 0, 360).onChange(v => {
    spawner.angle = v;
  });
  gui.add(params, 'spawn_radius', 0, 2).onChange(v => {
    spawner.radius = v;
  });
  
  gui.add(params, 'particle_size', 0.001, 0.1, 0.001);
  gui.add(params, 'particle_detail', 3, 100);
  gui.add(params, 'particle_mode', ['nearest', 'brownian']);
  gui.add(params, 'cluster_size', 1, 10000);
  params.cluster_grow = function () { growNearest(); };
  gui.add(params, 'cluster_grow');
}

// Update buffer data for a single particle
function updateParticleBuffer(index, p) {
  geo.attributes.offset.setXY(index, p.x, p.y);
  geo.attributes.offset.needsUpdate = true;
  geo.attributes.size.setX(index, p.radius*2);
  geo.attributes.size.needsUpdate = true;
  geo.attributes.color.setXYZW(index, 1, 1, 1, 0.8);
  geo.attributes.color.needsUpdate = true;
}


function growNearest() {
  for (let i=0; i<params.cluster_size; i++) {
    let s = spawner.getSpawn();
    let p = new dla.Particle(s[0], s[1], params.particle_size/2);
    cluster.stickOn(p);
    // console.log(p);
    updateParticleBuffer(particleCount++, p);
    geo.maxInstancedCount = particleCount;
  }
}
