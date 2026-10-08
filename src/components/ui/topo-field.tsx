import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

const topoFieldSource = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
</head>
<body style="margin:0;background:#000;overflow:hidden;">
<canvas id="topo-canvas" style="width:100%;height:100%;display:block;"></canvas>
<script>
const canvas = document.getElementById('topo-canvas');
const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false });
if (gl) {
  const vsSource = \`attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }\`;
  const fsSource = \`
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_dpr;
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    void main() {
      vec2 st = gl_FragCoord.xy / u_resolution.xy;
      st.x *= u_resolution.x / u_resolution.y;
      float gridSize = 48.0 * u_dpr;
      vec2 gridFract = fract(gl_FragCoord.xy / gridSize);
      float lineThickness = 1.0 / gridSize;
      float gridLines = step(1.0 - lineThickness, gridFract.x) + step(1.0 - lineThickness, gridFract.y);
      gridLines = clamp(gridLines, 0.0, 1.0) * 0.12;
      float noiseScale = 1.4;
      vec2 noisePos = st * noiseScale + vec2(u_time * 0.015, u_time * 0.025);
      float n = snoise(noisePos) * 0.5 + 0.5;
      float numBands = 10.0;
      float triangleWave = abs(fract(n * numBands) - 0.5) * 2.0;
      float topoLines = smoothstep(0.02, 0.00, triangleWave) * 0.45;
      vec3 color = vec3(0.0);
      color += vec3(1.0) * gridLines;
      color += vec3(1.0) * topoLines;
      gl_FragColor = vec4(color, 1.0);
    }
  \`;
  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const timeLocation = gl.getUniformLocation(program, "u_time");
  const dprLocation = gl.getUniformLocation(program, "u_dpr");
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(dprLocation, dpr);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  const start = performance.now();
  function render(time) {
    gl.uniform1f(timeLocation, (time - start) * 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
</script>
</body>
</html>`;

type TopoFieldMode = "dark" | "light";

export type TopoFieldProps = {
  mode?: TopoFieldMode | "auto";
  speed?: number;
  length?: number;
  density?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  className?: string;
  style?: CSSProperties;
};

const LIGHT_PAPER = "#eef1f6";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function glslFloat(value: number, digits = 3) {
  const fixed = Number(value).toFixed(digits);
  return fixed.includes(".") ? fixed : `${fixed}.0`;
}

function readAutomaticMode(): TopoFieldMode {
  if (typeof document === "undefined") return "dark";
  const declared = document.documentElement.dataset.theme;
  if (declared === "light" || declared === "dark") return declared;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useAutomaticMode(enabled: boolean) {
  const [autoMode, setAutoMode] = useState<TopoFieldMode>(readAutomaticMode);
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setAutoMode(readAutomaticMode());
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    media.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, [enabled]);
  return autoMode;
}

function patchTopoField(source: string, length: number, density: number, mode: TopoFieldMode) {
  let next = source
    .replace("float noiseScale = 1.4;", `float noiseScale = ${glslFloat(1.4 * length)};`)
    .replace("float numBands = 10.0;", `float numBands = ${glslFloat(10 * density, 2)};`);
  if (mode === "light") {
    next = next
      .replace(
        "gridLines = clamp(gridLines, 0.0, 1.0) * 0.12;",
        "gridLines = clamp(gridLines, 0.0, 1.0) * 0.55;",
      )
      .replace(
        "float topoLines = smoothstep(0.02, 0.00, triangleWave) * 0.45;",
        "float topoLines = smoothstep(0.03, 0.00, triangleWave) * 0.95;",
      )
      .replace(
        `vec3 color = vec3(0.0);
      color += vec3(1.0) * gridLines;
      color += vec3(1.0) * topoLines;`,
        `vec3 paper = vec3(0.933, 0.945, 0.965);
      vec3 ink = vec3(0.12, 0.14, 0.18);
      float lines = clamp(gridLines + topoLines, 0.0, 1.0);
      vec3 color = mix(paper, ink, lines);`,
      );
  }
  return next;
}

function buildFocusedDocument(mode: TopoFieldMode, length: number, density: number) {
  const patched = patchTopoField(topoFieldSource, length, density, mode);
  const background = mode === "light" ? LIGHT_PAPER : "#000000";
  const controls = `<script>
    var controls = { speed: 1, opacity: 1 };
    var origin = performance.now(), virtual = 0, last = origin;
    var now = performance.now.bind(performance);
    performance.now = function () {
      var real = now();
      virtual += (real - last) * (controls.speed || 1);
      last = real;
      return origin + virtual;
    };
    window.addEventListener('message', function (event) {
      if (!event.data || event.data.type !== 'threeui-controls') return;
      Object.assign(controls, event.data.controls || {});
      document.body.style.opacity = String(controls.opacity == null ? 1 : controls.opacity);
    });
  </script><style>html,body{margin:0;background:${background}!important;overflow:hidden;height:100%}</style>`;
  return patched.replace(/<head>/i, `<head>${controls}`);
}

export default function TopoField({
  mode = "dark",
  speed = 1,
  length = 1,
  density = 1,
  opacity = 1,
  hue = 0,
  saturation = 1,
  brightness = 1,
  className,
  style,
}: TopoFieldProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const automaticMode = useAutomaticMode(mode === "auto");
  const resolvedMode: TopoFieldMode = mode === "auto" ? automaticMode : mode;
  const safeSpeed = clamp(speed, 0, 3);
  const safeLength = clamp(length, 0.35, 2.5);
  const safeDensity = clamp(density, 0.25, 2.5);
  const safeOpacity = clamp(opacity, 0.05, 1);
  const source = useMemo(
    () => buildFocusedDocument(resolvedMode, safeLength, safeDensity),
    [resolvedMode, safeLength, safeDensity],
  );

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "threeui-controls", controls: { speed: safeSpeed, opacity: safeOpacity } },
      "*",
    );
  }, [safeSpeed, safeOpacity, source]);

  const filter =
    hue === 0 && saturation === 1 && brightness === 1
      ? undefined
      : `hue-rotate(${hue}deg) saturate(${saturation}) brightness(${brightness})`;

  return (
    <iframe
      ref={iframeRef}
      className={className}
      title="Topo Field"
      srcDoc={source}
      sandbox="allow-scripts"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        border: 0,
        background: resolvedMode === "light" ? LIGHT_PAPER : "#000",
        filter,
        ...style,
      }}
    />
  );
}
