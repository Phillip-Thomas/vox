import React, { useState } from 'react';
import { WORLD_CONFIG } from '../../constants/world';
import './TerrainControls.css';

const TerrainControls = ({ onParametersChange, isVisible, onToggleVisibility }) => {
  const [parameters, setParameters] = useState({
    noiseScale: WORLD_CONFIG.NOISE_SCALE,
    octaves: WORLD_CONFIG.NOISE_OCTAVES,
    persistence: WORLD_CONFIG.NOISE_PERSISTENCE,
    maxHeight: WORLD_CONFIG.TERRAIN_MAX_HEIGHT,
    baseHeight: WORLD_CONFIG.TERRAIN_BASE_HEIGHT,
    seed: WORLD_CONFIG.NOISE_SEED,
  });

  const [appliedParameters, setAppliedParameters] = useState(parameters);
  const [hasChanges, setHasChanges] = useState(false);

  const handleParameterChange = (key, value) => {
    const newParameters = {
      ...parameters,
      [key]: value
    };
    setParameters(newParameters);
    
    // Check if there are changes compared to applied parameters
    const hasChanges = JSON.stringify(newParameters) !== JSON.stringify(appliedParameters);
    setHasChanges(hasChanges);
  };

  const applyChanges = () => {
    onParametersChange(parameters);
    setAppliedParameters(parameters);
    setHasChanges(false);
  };

  const resetToDefaults = () => {
    const defaultParams = {
      noiseScale: WORLD_CONFIG.NOISE_SCALE,
      octaves: WORLD_CONFIG.NOISE_OCTAVES,
      persistence: WORLD_CONFIG.NOISE_PERSISTENCE,
      maxHeight: WORLD_CONFIG.TERRAIN_MAX_HEIGHT,
      baseHeight: WORLD_CONFIG.TERRAIN_BASE_HEIGHT,
      seed: WORLD_CONFIG.NOISE_SEED,
    };
    setParameters(defaultParams);
    setAppliedParameters(defaultParams);
    onParametersChange(defaultParams);
    setHasChanges(false);
  };

  const generateRandomSeed = () => {
    const randomSeed = Math.floor(Math.random() * 10000);
    handleParameterChange('seed', randomSeed);
  };

  if (!isVisible) {
    return (
      <div className="terrain-controls-toggle">
        <button onClick={onToggleVisibility} className="toggle-button">
          🏔️ Terrain Controls
        </button>
      </div>
    );
  }

  return (
    <div className="terrain-controls">
      <div className="controls-header">
        <h3>🏔️ Terrain Controls</h3>
        <button onClick={onToggleVisibility} className="close-button">×</button>
      </div>
      
      <div className="controls-grid">
        {/* Noise Scale */}
        <div className="control-group">
          <label>Noise Scale</label>
          <input
            type="range"
            min="0.005"
            max="0.1"
            step="0.005"
            value={parameters.noiseScale}
            onChange={(e) => handleParameterChange('noiseScale', parseFloat(e.target.value))}
          />
          <span className="value">{parameters.noiseScale.toFixed(3)}</span>
          <small>Controls terrain feature size</small>
        </div>

        {/* Octaves */}
        <div className="control-group">
          <label>Octaves</label>
          <input
            type="range"
            min="1"
            max="8"
            step="1"
            value={parameters.octaves}
            onChange={(e) => handleParameterChange('octaves', parseInt(e.target.value))}
          />
          <span className="value">{parameters.octaves}</span>
          <small>Number of noise layers</small>
        </div>

        {/* Persistence */}
        <div className="control-group">
          <label>Persistence</label>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.1"
            value={parameters.persistence}
            onChange={(e) => handleParameterChange('persistence', parseFloat(e.target.value))}
          />
          <span className="value">{parameters.persistence.toFixed(1)}</span>
          <small>Detail strength</small>
        </div>

        {/* Max Height */}
        <div className="control-group">
          <label>Max Height</label>
          <input
            type="range"
            min="10"
            max="80"
            step="5"
            value={parameters.maxHeight}
            onChange={(e) => handleParameterChange('maxHeight', parseInt(e.target.value))}
          />
          <span className="value">{parameters.maxHeight}</span>
          <small>Mountain peak height</small>
        </div>

        {/* Base Height */}
        <div className="control-group">
          <label>Base Height</label>
          <input
            type="range"
            min="0"
            max="30"
            step="2"
            value={parameters.baseHeight}
            onChange={(e) => handleParameterChange('baseHeight', parseInt(e.target.value))}
          />
          <span className="value">{parameters.baseHeight}</span>
          <small>Minimum terrain level</small>
        </div>

        {/* Seed */}
        <div className="control-group">
          <label>Seed</label>
          <div className="seed-controls">
            <input
              type="number"
              min="0"
              max="9999"
              value={parameters.seed}
              onChange={(e) => handleParameterChange('seed', parseInt(e.target.value) || 0)}
              className="seed-input"
            />
            <button onClick={generateRandomSeed} className="random-seed-button">
              🎲
            </button>
          </div>
          <small>Terrain generation seed</small>
        </div>
      </div>

      <div className="controls-actions">
        <button 
          onClick={applyChanges} 
          className={`generate-button ${hasChanges ? 'has-changes' : ''}`}
          disabled={!hasChanges}
        >
          {hasChanges ? '🔄 Generate Terrain' : '✅ Terrain Up to Date'}
        </button>
        
        <button onClick={resetToDefaults} className="reset-button">
          Reset to Defaults
        </button>
      </div>

      <div className="controls-info">
        <small>💡 Tip: Press T to toggle controls • Cursor is free while controls are open • Adjust parameters and click Generate to apply</small>
      </div>
    </div>
  );
};

export default TerrainControls; 