export const VHSShader = {
  uniforms: {
    "tDiffuse": { value: null },
    "time": { value: 0.0 },
    "amount": { value: 0.5 },
    "brightness": { value: 1.0 }
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
    uniform float brightness;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv;
      float d = amount * 0.01;
      
      // RGB Shift
      float r = texture2D(tDiffuse, uv + vec2(d, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(d, 0.0)).b;
      
      // ADDITIVE Scanlines (Adds glow instead of darkening)
      float scanline = sin(uv.y * 800.0 + time * 10.0) * 0.05;
      
      vec3 color = vec3(r, g, b);
      color += scanline * 0.1; // Additive glow
      
      gl_FragColor = vec4(color * brightness, 1.0);
    }
  `
};

export const GlitchShader = {
  uniforms: {
    "tDiffuse": { value: null },
    "time": { value: 0.0 },
    "byp": { value: 0 },
    "brightness": { value: 1.0 }
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
    uniform float brightness;
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
      gl_FragColor = texture2D(tDiffuse, uv) * brightness;
    }
  `
};

export const CRTShader = {
  uniforms: {
    "tDiffuse": { value: null },
    "time": { value: 0.0 },
    "brightness": { value: 1.0 }
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
    uniform float brightness;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv;
      
      // Curvature
      vec2 dc = uv - 0.5;
      uv = uv + dc * dot(dc, dc) * 0.05;
      
      if (uv.y > 1.0 || uv.x > 1.0 || uv.x < 0.0 || uv.y < 0.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      vec4 color = texture2D(tDiffuse, uv);
      
      // ADDITIVE Scanlines (Less darkening)
      float s = sin(uv.y * 1200.0) * 0.05;
      color.rgb += s * 0.1; // Glow instead of shadow
      
      // Very subtle Vignette (Minimal darkening)
      float v = 1.0 - dot(dc, dc) * 0.3;
      color.rgb *= v;
      
      gl_FragColor = color * brightness;
    }
  `
};
