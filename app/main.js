import * as util from './util.js';
import * as tilesaver from './tilesaver.js';
import {Cluster, Particle} from './dla.js';

const W = 1280;
const H = 800;
const TILES = 8;

let renderer, scene, camera, ocamera;
let controls; // eslint-disable-line no-unused-vars

let cluster;

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
  camera = new THREE.PerspectiveCamera( 75, W / H, 0.01, 1000 );
  camera.position.z = 1;
  ocamera = new THREE.OrthographicCamera( -W/H, W/H, 1, -1, -1, 1 );
  controls = new THREE.OrbitControls( camera, renderer.domElement );
  
  const maxParticles = 200; // normal save canvas only seems to work up to 120k
  const particleDetail = 32;
  const particleSize = 0.100;
  
  let minRadius = 0.6;
  let maxRadius = 1.6;
  
  let offsets = [];
  let colors = [];
  let sizes = [];
  
  // // Random placement
  // Math.seedrandom(0);
  // for (let i=0; i<maxParticles; i++) {
  //   offsets.push( (Math.random()*2-1)*1, (Math.random()*2-1)*1, 0 );
  //   colors.push( 0, 0, Math.random()+0.6, 0.3 );
  //   sizes.push( Math.random()*0.5 );
  // }
  
  // Grid placement
  let horizontal = 17;
  let vertical = 11;
  Math.seedrandom(0);
  for (let y=0; y<vertical; y++) {
    for (let x=0; x<horizontal; x++) {
      offsets.push( -1.6 + x*3.2/(horizontal-1), -1 + y*2/(vertical-1), 0 );
      colors.push( Math.random()+0.1, 0, Math.random()+0.6, 1 );
      sizes.push(0.1);
    }
  }
  
  // Initial placement
  // for (let i=0; i<maxParticles; i++) {
  //   offsets.push( 0, 0, 0 );
  //   colors.push( 1, 1, 1, 0.8 );
  //   sizes.push( 0.1 );
  // }
  
  function pushParticle(p) { 
    offsets.push(p.x, p.y, 0);
    colors.push(1, 1, 1, 0.8);
    sizes.push(p.radius*2);
  }
  cluster = new Cluster(0,0,particleSize/2); pushParticle(cluster.particles[0]);
  Math.seedrandom(0);
  for (let i=0; i<maxParticles-1; i++) {
    // spawn particle outside of cluster
    let angle = Math.random() * 2 * Math.PI;
    let radius = Math.random() * (maxRadius*cluster.radius - minRadius*cluster.radius) + minRadius*cluster.radius;
    let x = Math.cos(angle) * radius;
    let y = Math.sin(angle) * radius;
    let p = new Particle(x, y, particleSize/2);
    cluster.stickOn(p);
    // console.log(p);
    pushParticle(p);
  }
  console.log(cluster);
  
  
  let circle = new THREE.CircleGeometry( 0.5, particleDetail );
  let igeo = new THREE.InstancedBufferGeometry().fromGeometry(circle);
  igeo.addAttribute( 'offset', new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3) );
  igeo.addAttribute( 'color', new THREE.InstancedBufferAttribute(new Float32Array(colors), 4) );
  igeo.addAttribute( 'size', new THREE.InstancedBufferAttribute(new Float32Array(sizes), 1) );
  igeo.attributes.offset.dynamic = true;
  igeo.attributes.color.dynamic = true;
  igeo.attributes.size.dynamic = true;
  // igeo.maxInstancedCount = 3;
  
  let imat = new THREE.RawShaderMaterial( {
    uniforms: {
      "time": { value: 1.0 },
    },
    vertexShader: shader.vs,
    fragmentShader: shader.fs,
    side: THREE.DoubleSide,
    transparent: true
  } );

  let mesh = new THREE.Mesh( igeo, imat );
  // mesh.frustumCulled = false;
  
  scene.add( mesh );
  
  let m0 = xmarker(); m0.scale.multiplyScalar(2*Math.sqrt(2)); scene.add(m0);
  let m1 = xmarker(); m1.position.set(1.6,0,1); scene.add(m1);
  let m2 = xmarker(); m2.position.set(0,1,1); scene.add(m2);
  let m3 = xmarker(); m3.position.set(-1.6,0,1); scene.add(m3);
  let m4 = xmarker(); m4.position.set(0,-1,1); scene.add(m4);
  
  // console.log(camera);
  // console.log(ocamera);
  // console.log(controls);
  console.log(mesh);
  
  tilesaver.init(renderer, scene, ocamera, TILES);
}

function updateParticleBuffer(index, p) {
  mesh.geometry.attributes.offset.setXY(index, p.x, p.y);
  // mesh.geometry.attributes.offset.needsUpdate = true;
  mesh.geometry.attributes.size.setX(index, p.radius);
  // mesh.geometry.attributes.size.needsUpdate = true;
}

function loop(time) { // eslint-disable-line no-unused-vars
  
  requestAnimationFrame( loop );
  renderer.render( scene, ocamera );
  
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
    tilesaver.save();
  }
  
  else if (e.key == '1') { ocamera.clearViewOffset(); tileFactor=1; }
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
  ocamera.setViewOffset( fullWidth, fullHeight, offsetX, offsetY, tileWidth, tileHeight );
}
