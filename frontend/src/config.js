export const FEATURE_FLAGS = {
  enableBranding: false
};

export const STYLES = {
  '2d': [
    { id: 'circular', name: 'Circular Out' },
    { id: 'circular-inner', name: 'Circular In' },
    { id: 'circular-dual', name: 'Circular Dual' },
    { id: 'sunrise', name: 'Neon Sunrise' },
    { id: 'plasma', name: 'Cyber Plasma' },
    { id: 'cyber-nebula', name: 'Cyber Nebula' },
    { id: 'aurora', name: 'Aurora Flow' },
    { id: 'bars', name: 'Linear Bars' }
  ],
  '3d': [
    { id: '3d-sphere', name: 'Neon Sphere' },
    { id: '3d-terrain', name: 'Grid Terrain' },
    { id: '3d-tunnel', name: 'Warp Tunnel' },
    { id: '3d-stars', name: 'Cyber Starfield' },
    { id: '3d-cube', name: 'Bouncing Cube' },
    { id: '3d-city', name: 'Grid Runner' }
  ]
};

export const DEFAULT_CONFIG = {
  engine: '2d',
  sensitivity: 5,
  colors: ['#00f2ff', '#ff00ea'],
  style: 'circular'
};
