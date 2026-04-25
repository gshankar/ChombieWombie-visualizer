export const VHSShader = {
  uniforms: {
    "tDiffuse": { value: null },
    "time": { value: 0.0 },
    "amount": { value: 0.5 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float amount;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv;
      float d = amount * 0.01;
      
      // RGB Shift
      float r = texture2D(tDiffuse, uv + vec2(d, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(d, 0.0)).b;
      
      // Simple Scanlines
      float scanline = sin(uv.y * 800.0 + time * 10.0) * 0.04;
      
      gl_FragColor = vec4(r - scanline, g - scanline, b - scanline, 1.0);
    }
  `
};

export const GlitchShader = {
  uniforms: {
    "tDiffuse": { value: null },
    "time": { value: 0.0 },
    "byp": { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform int byp;
    varying vec2 vUv;
    
    void main() {
      if (byp == 1) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }
      vec2 uv = vUv;
      float g = sin(time * 10.0) * 0.01;
      if (sin(time) > 0.98) {
        uv.x += g;
      }
      gl_FragColor = texture2D(tDiffuse, uv);
    }
  `
};

export const CRTShader = {
  uniforms: {
    "tDiffuse": { value: null },
    "time": { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv;
      
      // Curvature
      vec2 dc = uv - 0.5;
      uv = uv + dc * dot(dc, dc) * 0.1;
      
      if (uv.y > 1.0 || uv.x > 1.0 || uv.x < 0.0 || uv.y < 0.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      vec4 color = texture2D(tDiffuse, uv);
      
      // Scanlines
      float s = sin(uv.y * 1200.0) * 0.05;
      color.rgb -= s;
      
      // Vignette
      float v = 1.0 - dot(dc, dc) * 1.5;
      color.rgb *= v;
      
      gl_FragColor = color;
    }
  `
};
