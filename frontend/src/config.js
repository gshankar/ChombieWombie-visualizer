export const STYLES = {
  '2d': [
    { id: 'circular', name: 'Circular: Outward' },
    { id: 'circular-inner', name: 'Circular: Inward' },
    { id: 'circular-dual', name: 'Circular: Dual' },
    { id: 'bars', name: 'Linear Bars' },
    { id: 'wave', name: 'Oscilloscope' }
  ],
  '3d': [
    { id: '3d-sphere', name: '3D: Audio Sphere' },
    { id: '3d-terrain', name: '3D: Retro Terrain' },
    { id: '3d-tunnel', name: '3D: Hyper Tunnel' }
  ]
};

export const DEFAULT_CONFIG = {
  engine: '2d',
  sensitivity: 5,
  colors: ['#00f2ff', '#ff00ea'],
  style: 'circular'
};
