import React, { useState } from 'react';
import { 
  updateWorldGenerationConfig, 
  getWorldGenerationConfig 
} from '../utils/materialGenerator';
import { WorldGenerationConfig } from '../config/worldGeneration';
import { MATERIALS } from '../types/materials';

interface WorldGenerationControlsProps {
  onConfigUpdate?: (config: WorldGenerationConfig) => void;
}

export const WorldGenerationControls: React.FC<WorldGenerationControlsProps> = ({ 
  onConfigUpdate 
}) => {
  const [config, setConfig] = useState<WorldGenerationConfig>(getWorldGenerationConfig());

  const handleCoreRadiusChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRadius = Math.max(1.5, Math.min(3, parseFloat(event.target.value) || 1.5));
    const newConfig = { ...config, coreRadius: newRadius };
    setConfig(newConfig);
    updateWorldGenerationConfig(newConfig);
    onConfigUpdate?.(newConfig);
  };



  return (
    <div style={{ 
      position: 'absolute', 
      top: 10, 
      left: 10, 
      background: 'rgba(0, 0, 0, 0.7)', 
      padding: '15px', 
      borderRadius: '8px', 
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      minWidth: '250px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>World Generation</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Core Diameter: {(config.coreRadius * 2).toFixed(1)} blocks
        </label>
        <input
          type="range"
          min="1.5"
          max="3"
          step="0.25"
          value={config.coreRadius}
          onChange={handleCoreRadiusChange}
          style={{ width: '100%' }}
        />
        <div style={{ fontSize: '11px', color: '#ccc', marginTop: '2px' }}>
          Diameter of the lava core (3-6 blocks)
        </div>
      </div>

      <div style={{ fontSize: '12px', color: '#aaa', marginTop: '15px' }}>
        <strong>Layer Structure:</strong><br/>
        • Core: Lava blocks<br/>
        • Middle: Rarity-based materials<br/>
        • Surface: Grass layer
      </div>

      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '15px' }}>
        <strong>Material Rarity (Middle Layer):</strong><br/>
        • Dirt: {MATERIALS.dirt.rarity} (Very Common)<br/>
        • Stone: {MATERIALS.stone.rarity} (Common)<br/>
        • Wood: {MATERIALS.wood.rarity} (Uncommon)<br/>
        • Copper: {MATERIALS.copper.rarity} (Uncommon)<br/>
        • Silver: {MATERIALS.silver.rarity} (Rare)<br/>
        • Gold: {MATERIALS.gold.rarity} (Very Rare)
      </div>
    </div>
  );
}; 