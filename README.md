# Voxel Game

A 3D voxel-based game built with React Three.js and Rapier physics.

## Features

- 3D voxel world rendering
- First-person player controls (WASD + Space)
- Physics-based movement and jumping
- Real-time 3D graphics with Three.js
- Physics simulation with Rapier

## Controls

- **W / Arrow Up**: Move forward
- **S / Arrow Down**: Move backward  
- **A / Arrow Left**: Move left
- **D / Arrow Right**: Move right
- **Space**: Jump

## Technologies Used

- **React**: UI framework
- **Three.js**: 3D graphics library
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Useful helpers for React Three Fiber
- **@react-three/rapier**: Physics engine integration
- **Vite**: Build tool and dev server

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`

## Development

This project uses Vite for fast development and hot module replacement. The main game logic is in:

- `src/components/Player.tsx` - Player movement and controls
- `src/components/Planet.tsx` - Voxel world generation
- `src/App.tsx` - Main application setup

## Physics

The game uses Rapier physics engine for realistic movement, jumping, and collision detection.

## Graphics

Built with React Three Fiber for declarative 3D scene composition and Three.js for WebGL rendering. 