import { type WFCTile3DConfig } from '../../../src/wfc3d';

/**
 * Simple voxel tileset with basic terrain types
 */
export const voxelTileset: WFCTile3DConfig[] = [
  // Air - empty space
  {
    id: 'air',
    weight: 5,
    color: '#87CEEB',
    adjacency: {
      up: ['air', 'grass', 'dirt', 'stone'],
      down: ['air', 'grass', 'dirt', 'stone'],
      north: ['air', 'grass', 'dirt', 'stone'],
      south: ['air', 'grass', 'dirt', 'stone'],
      east: ['air', 'grass', 'dirt', 'stone'],
      west: ['air', 'grass', 'dirt', 'stone'],
    },
  },
  
  // Grass - top layer
  {
    id: 'grass',
    weight: 3,
    color: '#7CFC00',
    adjacency: {
      up: ['air'],
      down: ['dirt', 'stone'],
      north: ['air', 'grass', 'dirt'],
      south: ['air', 'grass', 'dirt'],
      east: ['air', 'grass', 'dirt'],
      west: ['air', 'grass', 'dirt'],
    },
  },

  // Dirt - middle layer
  {
    id: 'dirt',
    weight: 2,
    color: '#8B4513',
    adjacency: {
      up: ['air', 'grass', 'dirt'],
      down: ['dirt', 'stone'],
      north: ['air', 'grass', 'dirt', 'stone'],
      south: ['air', 'grass', 'dirt', 'stone'],
      east: ['air', 'grass', 'dirt', 'stone'],
      west: ['air', 'grass', 'dirt', 'stone'],
    },
  },

  // Stone - bottom layer
  {
    id: 'stone',
    weight: 1,
    color: '#696969',
    adjacency: {
      up: ['air', 'dirt', 'stone'],
      down: ['stone'],
      north: ['air', 'dirt', 'stone'],
      south: ['air', 'dirt', 'stone'],
      east: ['air', 'dirt', 'stone'],
      west: ['air', 'dirt', 'stone'],
    },
  },
];
