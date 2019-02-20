import * as util from './util.js';

const W = 1280;
const H = 800;

let renderer, scene, camera, ocamera;
let controls; // eslint-disable-line no-unused-vars

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
  // ocamera = new THREE.OrthographicCamera( W/-2, W/2, H/2, H/-2, 0, 100 );
  controls = new THREE.OrbitControls( camera, renderer.domElement );
  
  const maxParticles = 10000;
  const particleDetail = 8;
  
  let offsets = [];
  let colors = [];
  let sizes = [];
  for (let i=0; i<maxParticles; i++) {
    offsets.push( (Math.random()*2-1)*1, (Math.random()*2-1)*1, 0 );
    colors.push( 0, 0, Math.random()+0.3, 0.3 );
    sizes.push( Math.random()*0.01 );
  }
  
  let circle = new THREE.CircleGeometry( 0.5, particleDetail );
  let igeo = new THREE.InstancedBufferGeometry().fromGeometry(circle);
  igeo.addAttribute( 'offset', new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3) );
  igeo.addAttribute( 'color', new THREE.InstancedBufferAttribute(new Float32Array(colors), 4) );
  igeo.addAttribute( 'size', new THREE.InstancedBufferAttribute(new Float32Array(sizes), 1) );
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
