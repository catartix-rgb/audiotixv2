// datamoshVertex.glsl
// Pass-through for a fullscreen-ish quad. UV is preserved for fragment work.

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
