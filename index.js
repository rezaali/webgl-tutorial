// Setup Canvas
var canvas = document.body.appendChild( document.createElement( 'canvas' ) );

// Get WebGL Context
var gl = require('gl-context')( canvas, render );

// Import StackGL Webgl
var glGeometry = require('gl-geometry');
var glShader = require('gl-shader');
var clear = require('gl-clear')();
var glslify = require('glslify');

// Import Math Libraries
var mat4 = require('gl-matrix').mat4;

// Import Web Helper Libraries
var fit = require('canvas-fit');
var isMobile = require('is-mobile');

// Import YCAM GRP Libraries
var ycam = require('ycam');
var cga = require('cga');
var cam = require('nsc')( canvas, { position: [ 0.0, 0.0, -2.0 ] } );

// Set the canvas size to fill the window and its pixel density
var mobile = isMobile( navigator.userAgent );
var dpr = mobile ? 1 : ( window.devicePixelRatio || 1 );
window.addEventListener( 'resize', fit( canvas, null, dpr ), false );

//Setup Matricies
var projection = mat4.create();
var model = mat4.create();
var view = mat4.create();

//Setup Shaders
var vertexShader = glslify( './shaders/shader.vert' );
var fragmentShader = glslify( './shaders/shader.frag' );
var shader = glShader( gl, vertexShader, fragmentShader );

// Setup Sketch Parameters
var outline = glGeometry( gl );
outline.attr( 'aPosition', ycam.positions, { size: 2 } );

var outlineExpanded = glGeometry( gl );
var ycamExpanded = cga.expandPolygon2( ycam.positions, 0.05 );
outlineExpanded.attr( 'aPosition', ycamExpanded, { size: 2 } );

var hull = glGeometry( gl );
hull.attr( 'aPosition', ycamExpanded, { size: 2 } );
hull.faces( cga.convexHull2( ycamExpanded ) );

var triangles = glGeometry( gl );
triangles.attr( 'aPosition', ycam.positions, { size: 2 } );
triangles.faces( cga.triangulatePolygon2( ycam.positions ) );

function update() {
  // Set Perspective Projection
  var aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
  var fieldOfView = Math.PI / 4.0;
  var near = 0.01;
  var far  = 1000.0;
  mat4.perspective( projection, fieldOfView, aspectRatio, near, far );
  cam.view( view );
  cam.update();
}

function render() {
  update();

  gl.viewport( 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight );
  clear( gl );

  // Set Blending
  gl.disable( gl.DEPTH_TEST );
  gl.enable( gl.BLEND );
  gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

  drawGeo( outline, gl.LINE_LOOP, [ 0, 1, 1, 0 ] );
  drawGeo( outlineExpanded, gl.LINE_LOOP, [ 0, 1, 1, 1 ] );
  drawGeo( hull, gl.LINE_LOOP, [ 1, 0, 0, 1 ] );
  drawGeo( triangles, gl.LINE_LOOP, [ 1, 1, 0, 1 ] );
}

function drawGeo( geo, mode, color ) {
  geo.bind( shader );
  if( isMobile ) { shader.uniforms.dpr = dpr * 2.0; } else { shader.uniforms.dpr = dpr; }
  shader.uniforms.uPointSize = 1.0;
  shader.uniforms.uProjection = projection;
  shader.uniforms.uView = view;
  shader.uniforms.uModel = model;
  shader.uniforms.uColor = color;
  geo.draw( mode );
  geo.unbind();
}
