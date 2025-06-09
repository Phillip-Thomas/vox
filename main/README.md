# Voxel Game

A procedurally generated voxel game built with React Three Fiber, inspired by No Man's Sky.

## Features

- **Procedural Terrain Generation**: Using noise functions to create varied, natural-looking landscapes
- **First-Person Navigation**: WASD movement with mouse look controls
- **Voxel-Based World**: Efficient rendering of block-based terrain
- **Lofi Graphics**: Simple, clean aesthetic suitable for mobile devices

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000) to view the game in your browser.

## Controls

- **Click** to enter pointer lock mode
- **WASD** - Move around
- **Mouse** - Look around
- **Space** - Jump

## Project Structure

- `src/components/Game.js` - Main game component
- `src/components/Terrain.js` - Procedural terrain generation
- `src/components/Player.js` - Player movement and physics
- `src/utils/noise.js` - Noise functions for terrain generation

## Current Status

This is the initial bare minimum implementation featuring:
- Basic procedural terrain generation
- Character navigation with physics
- Simple voxel rendering

## Next Steps

Future features to implement:
- Infinite terrain generation (chunking system)
- Block placement/destruction
- More varied terrain types
- Mobile touch controls
- Multiplayer support
- Crafting system
- Base building

## Technical Details

- Built with React Three Fiber for 3D rendering
- Uses Three.js for 3D graphics
- Custom noise functions for procedural generation
- Optimized voxel rendering (only renders exposed faces) 