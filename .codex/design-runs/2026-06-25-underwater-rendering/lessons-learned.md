# Lessons Learned

- Underwater visual validation in `?agent=1` must publish submersion; otherwise captures can show camera-under-water geometry without the real underwater post stack.
- Underwater godrays should not radial-blur arbitrary bright scene pixels. Source-gate shafts to the sun/Snell aperture and tint them analytically.
- Close voxel terrain needs a mild water-medium wash because depth extinction alone has little distance to work with near the camera.
- Underwater particles should be world-anchored and wrapped around the camera; camera-attached particles break immersion when the player swims forward.
- Bubble rise must follow local planet-up, not world `+Y`, because the player can swim on any cube face.
