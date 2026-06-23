export type MusicLayerId = 'menu' | 'surface' | 'deepSpace' | 'shimmer' | 'warp';

export interface MusicLayerAsset {
  id: MusicLayerId;
  url: string;
}

export const MUSIC_LAYER_ASSETS: MusicLayerAsset[] = [
  { id: 'menu', url: '/audio/music/menu_ambientmain.ogg' },
  { id: 'surface', url: '/audio/music/surface_project_utopia.ogg' },
  { id: 'deepSpace', url: '/audio/music/deep_space_out_there.ogg' },
  { id: 'shimmer', url: '/audio/music/shimmer_dream_ambience.mp3' },
  { id: 'warp', url: '/audio/music/warp_surreal_truth.mp3' }
];
