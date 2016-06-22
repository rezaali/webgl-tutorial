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
var mat3 = require('gl-matrix').mat3;

// Import Web Helper Libraries
var fit = require('canvas-fit');
var isMobile = require('is-mobile');
var keyPressed = require('key-pressed');

// Import YCAM GRP Libraries
var ycam = require('ycam');
var cga = require('cga');
var lgp = require('lgp');
var mda = require('mda');
var guf = require('guf');
var cam = require('nsc')( canvas, { position: [ 0.0, 0.0, -75.0 ] } );

// Set the canvas size to fill the window and its pixel density
var mobile = isMobile( navigator.userAgent );
var dpr = mobile ? 1 : ( window.devicePixelRatio || 1 );
window.addEventListener( 'resize', fit( canvas, null, dpr ), false );

//Setup Matricies
var projection = mat4.create();
var model = mat4.create();
var normalm4 = mat4.create();
var normalm3 = mat3.create();
var view = mat4.create();

//Setup Shaders
var vertexShader = glslify( './shaders/shader.vert' );
var fragmentShader = glslify( './shaders/shader.frag' );
var shader = glShader( gl, vertexShader, fragmentShader );

var vertexMeshShader = glslify( './shaders/solid.vert' );
var fragmentMeshShader = glslify( './shaders/solid.frag' );
var meshShader = glShader( gl, vertexMeshShader, fragmentMeshShader );

// Setup Sketch Parameters
var len = ycam.positions.length;
for( var i = 0; i < len; i++ ) {
  ycam.positions[i][0] *= 50;
  ycam.positions[i][1] *= 50;
}

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

// Mesh Variables
var mesh, meshOutput, meshOutputTriangles;
var positions, cells;
var meshGeo;

mesh = mda.ProfileGenerator( ycam.positions );
mda.ExtrudeOperator( mesh, 0, 10, 0.0 );
mda.ExtrudeOperator( mesh, 0, 0, 0.25 );
mda.ExtrudeOperator( mesh, 1, 0, 4.25 );
mda.PipeOperator( mesh, 0, 1, 1 );
mda.TriangulateOperator( mesh );
positions = mesh.getPositions();
cells = mesh.getCells();
meshGeo = createGeo( positions, cells );

function update() {
  // Set Perspective Projection
  var aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
  var fieldOfView = Math.PI / 4.0;
  var near = 0.01;
  var far  = 1000.0;
  mat4.perspective( projection, fieldOfView, aspectRatio, near, far );
  cam.view( view );
  cam.update();

  mat4.copy( normalm4, view );
  mat4.invert( normalm4, normalm4 );
  mat4.transpose( normalm4, normalm4 );
  mat3.fromMat4( normalm3, normalm4 );
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
  drawMesh( meshGeo, [ 1, 1, 1, 1 ] );
}

window.addEventListener( 'keydown', function( event ) {
  if( keyPressed( 'S' ) ) {
      lgp.imageWriter( 'ycam_tutorial.png', canvas.toDataURL('image/png') );
  }
  else if( keyPressed( 'P' ) ) {
    lgp.fileWriter( "ycam_tutorial.svg", lgp.svgSerializer( [ {
      polygon: ycam.positions,
      strokeWidth: 0.1,
    } ] ) );
  }
  else if( keyPressed( 'E' ) ) {
    lgp.fileWriter( "ycam_tutorial.stl", lgp.stlSerializer( { positions: positions, cells: cells } ) );
    lgp.fileWriter( "ycam_tutorial.obj", lgp.objSerializer( { positions: positions, cells: cells } ) );
    return;
}

}, false );

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

function drawMesh( geo, color ) {
  if( geo ) {
    gl.enable( gl.DEPTH_TEST );
    gl.enable( gl.BLEND );
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    geo.bind( meshShader );
    if( isMobile ) { meshShader.uniforms.dpr = dpr * 2.0; } else { meshShader.uniforms.dpr = dpr; }
    meshShader.uniforms.uPointSize = 1.0;
    meshShader.uniforms.uProjection = projection;
    meshShader.uniforms.uView = view;
    meshShader.uniforms.uNormalMatrix = normalm3;
    meshShader.uniforms.uModel = model;
    meshShader.uniforms.uColor = color;
    geo.draw( gl.TRIANGLES );
    geo.unbind();
  }
}

function createGeo( positions, cells ) {
  var newPositions = [];
  var newNormals = [];

  for( var i = 0; i < cells.length; i++ ) {
    var a = positions[ cells[ i ][ 0 ] ];
    var b = positions[ cells[ i ][ 1 ] ];
    var c = positions[ cells[ i ][ 2 ] ];
    var n = guf.calculateNormal( a, b, c );
    newPositions.push( a, b, c );
    newNormals.push( n, n, n );
  }
  var geo = glGeometry( gl );
  geo.attr( 'aPosition', newPositions );
  geo.attr( 'aNormal', newNormals );
  return geo;
}
