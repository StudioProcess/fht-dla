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
let gui, gui_cluster_size;
let growth = { growing:false };

let params = {
  bg_color: '#fff',
  particle_color: '#000',
  particle_opacity: 1,
  // particle_scaleProp: false,
  particle_scaleX: 1,
  particle_scaleY: 1,
  particle_detail: 32,
  particle_tri: null,
  particle_quad: null,
  particle_penta: null,
  particle_hexa: null,
  particle_preRotation: 0,
  particle_rotation: 0,
  particle_align: true,
  
  spawn_angle: 360,
  spawn_direction: 0,
  spawn_radius: 1,
  
  particle_size: 0.010,

  particle_mode: 'brownian',
  particle_stickyness: 1,
  
  cluster_size: '0',
  cluster_growthRate: 1,
  cluster_growBy: 1000,
  cluster_grow: null,
  cluster_stop: null,
  cluster_clear: null,
};

const shader = {
  vs: `
    precision highp float;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    
    uniform vec3  global_color;
    uniform float global_opacity;
    uniform vec2  global_scale;
    uniform mat4  global_prerotation_matrix;
    uniform mat4  global_rotation_matrix;
    uniform bool  align;
    
    attribute vec3 position;
    attribute vec3 offset;
    attribute vec4 color;
    attribute float size;
    attribute vec3 rotation; // holds: cos(t), sin(t), -sin(t)
    
    varying vec4 vColor;
    
    void main() {
      vColor = vec4(global_color, global_opacity) * color;
      mat4 rotation_matrix = mat4(1.0);
      if (align) {
        rotation_matrix[0][0] = rotation.x;
        rotation_matrix[0][1] = rotation.y;
        rotation_matrix[1][0] = rotation.z;
        rotation_matrix[1][1] = rotation.x;
      }
      vec4 vPosition = global_prerotation_matrix * vec4(position, 1.0);
      vPosition = vPosition * vec4(global_scale, 1.0, 1.0) * size;
      vPosition = global_rotation_matrix * rotation_matrix * vPosition;
      vPosition += vec4(offset, 1.0); 
      gl_Position = projectionMatrix * modelViewMatrix * vPosition;
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
  setCanvasBackground(params.bg_color);
  
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
  spawner = new dla.Spawner(params.spawn_radius, params.spawn_direction, params.spawn_angle);
  scene.add( spawner.object );
  
  geo = new THREE.InstancedBufferGeometry();
  setParticleGeometry(params.particle_detail);
  geo.addAttribute( 'offset', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES*3), 3) );
  geo.addAttribute( 'color', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES*4), 4) );
  geo.addAttribute( 'size', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES*1), 1) );
  geo.addAttribute( 'rotation', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES*3), 3) );
  geo.attributes.offset.dynamic = true;
  geo.attributes.color.dynamic = true;
  geo.attributes.size.dynamic = true;
  geo.attributes.rotation.dynamic = true;
  
  geo.maxInstancedCount = 0; // start drawing nothing
  // geo.setDrawRange(0, 10); // this controls data PER instance
  
  mat = new THREE.RawShaderMaterial({
    uniforms: { 
      "global_color":   { value: new THREE.Color(params.particle_color) },
      "global_opacity": { value: params.particle_opacity },
      "global_scale":   { value: [params.particle_scaleX, params.particle_scaleY] },
      "global_prerotation_matrix": { value: new THREE.Matrix4() },
      "global_rotation_matrix":    { value: new THREE.Matrix4() },
      "align":          { value: params.particle_align },
    },
    vertexShader: shader.vs,
    fragmentShader: shader.fs,
    // side: THREE.DoubleSide,
    transparent: true
  });
  setParticleRotation(params.particle_rotation);
  setParticlePreRotation(params.particle_preRotation);
  
  mesh = new THREE.Mesh( geo, mat );
  mesh.frustumCulled = false;
  scene.add( mesh );
  console.log(mesh);
  // setParticleRotation(params.particle_rotation);
  
  createGUI();
  
  Math.seedrandom(0);
}

function loop(time) { // eslint-disable-line no-unused-vars
  
  updateGrowth();
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
  
  else if (e.key == 'r') {
    resetCamera();
  }
  
});


function resetCamera() {
  camera.position.set(0,0,0);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  controls.target.set(0,0,0);
}

function createGUI() {
  gui = new GUI();

  gui.addColor(params, 'bg_color').onChange(setCanvasBackground);
  
  gui.addColor(params, 'particle_color').onChange(v => {
    mat.uniforms.global_color.value = new THREE.Color(v);
  });
  gui.add(params, 'particle_opacity', 0, 1, 0.01).onChange(v => {
    mat.uniforms.global_opacity.value = v;
  });
  gui.add(params, 'particle_preRotation', 0, 180).onChange(setParticlePreRotation);
  gui.add(params, 'particle_scaleX', 0, 5, 0.01).onChange(v => {
    mat.uniforms.global_scale.value[0] = v;
  });
  gui.add(params, 'particle_scaleY', 0, 5, 0.01).onChange(v => {
    mat.uniforms.global_scale.value[1] = v;
  });
  gui.add(params, 'particle_rotation', 0, 180).onChange(setParticleRotation);
  gui.add(params, 'particle_align').onChange(v => {
    mat.uniforms.align.value = v;
  });
  let gui_particle_detail = gui.add(params, 'particle_detail', 3, 32, 1).onFinishChange(setParticleGeometry);
  params.particle_tri = () => { gui_particle_detail.setValue(3); setParticleGeometry(3); };
  gui.add(params, 'particle_tri');
  params.particle_quad = () => { gui_particle_detail.setValue(4); setParticleGeometry(4); };
  gui.add(params, 'particle_quad');
  params.particle_penta = () => { gui_particle_detail.setValue(5); setParticleGeometry(5); };
  gui.add(params, 'particle_penta');
  params.particle_hexa = () => { gui_particle_detail.setValue(6); setParticleGeometry(6); };
  gui.add(params, 'particle_hexa');
  

  gui.add(params, 'spawn_angle', 0, 360).onChange(v => {
    spawner.angle = v;
  });
  gui.add(params, 'spawn_direction', -180, 180).onChange(v => {
    spawner.direction = v;
  });
  gui.add(params, 'spawn_radius', 0, 2).onChange(v => {
    spawner.radius = v;
  });
  
  gui.add(params, 'particle_size', 0.005, 0.02, 0.0001);
  gui.add(params, 'particle_mode', ['nearest', 'brownian']);
  gui.add(params, 'particle_stickyness', 0, 1, 0.01);
  
  gui_cluster_size = gui.add(params, 'cluster_size');
  gui_cluster_size.domElement.style.pointerEvents = 'none';
  gui_cluster_size.domElement.querySelector('input').style.background = 'none';
  gui.add(params, 'cluster_growthRate', 1, 10, 1);
  gui.add(params, 'cluster_growBy', 1, 10000);
  params.cluster_grow = () => { 
    if (params.particle_mode == 'nearest') growNearest();
    else if (params.particle_mode == 'brownian') {
      lockGUI();
      setTimeout(() => {growBrownian(); lockGUI(false)}, 100);
    }
  };
  gui.add(params, 'cluster_grow');
  
  params.cluster_stop = () => { stopGrowing() };
  gui.add(params, 'cluster_stop');
  params.cluster_clear = () => { clearCluster() };
  gui.add(params, 'cluster_clear');
}

// Update buffer data for a single particle
function updateParticleBuffer(index, p) {
  geo.attributes.offset.setXY(index, p.x, p.y);
  geo.attributes.offset.needsUpdate = true;
  geo.attributes.size.setX(index, p.radius*2);
  geo.attributes.size.needsUpdate = true;
  geo.attributes.color.setXYZW(index, 1, 1, 1, 1);
  geo.attributes.color.needsUpdate = true;
  let cos = Math.cos(p.parentDirection);
  let sin = Math.sin(p.parentDirection);
  geo.attributes.rotation.setXYZ(index, cos, sin, -sin);
  geo.attributes.rotation.needsUpdate = true;
}


function growNearest() {
  for (let i=0; i<params.cluster_growBy; i++) {
    let s = spawner.getSpawn();
    let p = new dla.Particle(s[0], s[1], params.particle_size/2);
    cluster.stickOn(p);
    // console.log(p);
    updateParticleBuffer(particleCount++, p);
  }
  geo.maxInstancedCount = particleCount;
  gui_cluster_size.setValue(particleCount);
}

function updateGrowth() {
  if (growth.growing) {
    if (growth.added >= growth.target) {
      growth.growing = false;
      return;
    }
    let steps = Math.min(params.cluster_growthRate, growth.target-growth.added); // don't overshoot target
    if (growth.mode == 'brownian') {
      growthStepBrownian(steps);
      growth.added += steps;
    }
  }
}

function growBrownian() {
  growth =  {
    growing: true,
    target: params.cluster_growBy,
    added: 0,
    mode: 'brownian'
  };
}

function stopGrowing() {
  growth.growing = false;
}

// grow by a number particle
function growthStepBrownian(n = 1) {
  let added = 0;
  let outside = 0;
  let didntstick = 0;
  while (added < n) {
    let s = spawner.getSpawn();
    let p = new dla.Particle(s[0], s[1], params.particle_size/2);
    let stuckTo = false;
    while (!stuckTo) {
      p.step();
      if ( !spawner.checkInside(p) ) {
        outside++;
        break;
      }
      stuckTo = p.checkStuck(cluster);
      if ( stuckTo ) {
        if (Math.random() > params.particle_stickyness) {
          didntstick++;
          break;
        }
        p.stickTo(stuckTo);
        cluster.add(p);
        added++;
        updateParticleBuffer(particleCount++, p);
      }
    }
  }
  geo.maxInstancedCount = particleCount;
  gui_cluster_size.setValue(particleCount);
  console.log(`added ${added} / outside ${outside} / didntstick ${didntstick}`);
}

function clearCluster() {
  cluster = new dla.Cluster(0,0,params.particle_size/2); 
  particleCount = 0;
  geo.maxInstancedCount = particleCount;
  gui_cluster_size.setValue(particleCount);
}

function lockGUI(lock = true) {
  if (lock) {
    gui.domElement.style.pointerEvents = 'none';
    gui.domElement.style.opacity = 0.5;
  } else {
    gui.domElement.style.pointerEvents = 'auto';
    gui.domElement.style.opacity = 1;
  }
}

function setCanvasBackground(colstr) {
  renderer.domElement.style.backgroundColor = colstr;
}


function setParticleGeometry(detail) {
  detail = Math.floor(detail); // sanitize input
  let circle = new THREE.CircleGeometry( 0.5, detail );
  geo.fromGeometry(circle);
}

function setParticleRotation(deg) {
  mat.uniforms.global_rotation_matrix.value = new THREE.Matrix4().makeRotationZ( - deg / 180 * Math.PI );
} 

function setParticlePreRotation(deg) {
  mat.uniforms.global_prerotation_matrix.value = new THREE.Matrix4().makeRotationZ( - deg / 180 * Math.PI );
} 
