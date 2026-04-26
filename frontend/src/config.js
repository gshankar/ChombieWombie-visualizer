export const STYLES = {
  '2d': [
    { id: 'circular', name: 'Circular Out' },
    { id: 'circular-inner', name: 'Circular In' },
    { id: 'circular-dual', name: 'Circular Dual' },
    { id: 'sunrise', name: 'Neon Sunrise' },
    { id: 'bars', name: 'Linear Bars' },
    { id: 'wave', name: 'Oscilloscope' }
  ],
  '3d': [
    { id: '3d-sphere', name: 'Neon Sphere' },
    { id: '3d-terrain', name: 'Grid Terrain' },
    { id: '3d-tunnel', name: 'Warp Tunnel' },
    { id: '3d-stars', name: 'Cyber Starfield' }
  ]
};

export const DEFAULT_CONFIG = {
  engine: '2d',
  sensitivity: 5,
  colors: ['#00f2ff', '#ff00ea'],
  style: 'circular'
};
