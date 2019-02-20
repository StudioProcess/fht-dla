import * as util from './util.js';

const W = 1280;
const H = 800;

let renderer, scene, camera;
let controls; // eslint-disable-line no-unused-vars

const shader = {
  vs: `
    precision highp float;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    // uniform float time;
    uniform float scale;
    
    attribute vec3 position;
    attribute vec3 offset;
    // attribute vec4 color;
    
    // varying vec3 vPosition;
    // varying vec4 vColor;
    
    void main() {
      vec3 vPosition = position * scale + offset;
      // vColor = color;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( vPosition, 1.0 );
    }`,
  fs: `
    precision highp float;
    // uniform float time;
    uniform vec3 color;
    uniform float opacity;
    
    // varying vec3 vPosition;
    // varying vec4 vColor;
    
    void main() {
      gl_FragColor = vec4(color, opacity);
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
  controls = new THREE.OrbitControls( camera, renderer.domElement );
  camera.position.z = 2;
  
  
  const maxParticles = 100;
  const particleScale = 10;
  const particleDetail = 8;
  
  let offsets = [];
  for (let i=0; i<maxParticles; i++) {
    offsets.push( Math.random()*2-1, Math.random()*2-1, Math.random()*2-1 );
  }
  
  let circle = new THREE.CircleGeometry( 0.01, particleDetail );
  let geo = new THREE.BufferGeometry().fromGeometry(circle);
  let mat = new THREE.MeshBasicMaterial({ color: 0x1e90ff, wireframe: false });
  
  let igeo = new THREE.InstancedBufferGeometry().fromGeometry(circle);
  igeo.addAttribute( 'offset', new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3) );
  // igeo.maxInstancedCount = 3;
  
  
  let imat = new THREE.RawShaderMaterial( {
    uniforms: {
      "time":    { value: 1.0 },
      "color":   { value: new THREE.Color(0x1e90ff) },
      "opacity": { value: 0.3 },
      "scale":   { value: particleScale }
    },
    vertexShader: shader.vs,
    fragmentShader: shader.fs,
    side: THREE.DoubleSide,
    transparent: true
  } );

  let mesh = new THREE.Mesh( igeo, imat );
  
  scene.add( mesh );
  
}


function loop(time) { // eslint-disable-line no-unused-vars
  
  requestAnimationFrame( loop );
  renderer.render( scene, camera );
  
}


document.addEventListener('keydown', e => {
  // console.log(e.key, e.keyCode, e);
  
  if (e.key == 'f') { // f .. fullscreen
    util.toggleFullscreen();
  }
  
  else if (e.key == 's') { // s .. save frame
    util.saveCanvas();
  }
  
});
