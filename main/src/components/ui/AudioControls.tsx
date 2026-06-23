import React from 'react';
import { useAudioSettings, setMusicMuted, setMusicVolume, setSfxVolume } from '../../audio/audioSettings.ts';
import { unlockMusicAudio } from '../../audio/musicEngine.ts';
import { unlockSfxAudio } from '../../audio/sfxEngine.ts';
import { theme } from '../../ui/theme.ts';

interface AudioControlsProps {
  compact?: boolean;
}

const AudioControls: React.FC<AudioControlsProps> = ({ compact = false }) => {
  const { musicVolume, sfxVolume, muted } = useAudioSettings();
  const musicPercent = Math.round(musicVolume * 100);
  const sfxPercent = Math.round(sfxVolume * 100);

  const unlock = () => {
    void unlockMusicAudio();
    void unlockSfxAudio();
  };

  const onVolumeInput = (value: number, setter: (next: number) => void) => {
    setter(value / 100);
    if (muted && value > 0) setMusicMuted(false);
  };

  return (
    <div style={{ display: 'grid', gap: compact ? 8 : 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{
          color: theme.color.textDim,
          fontSize: compact ? 12 : 13,
          letterSpacing: '0.08em',
          textTransform: 'uppercase'
        }}>
          Audio
        </div>
        <button
          onPointerDown={unlock}
          onClick={() => setMusicMuted(!muted)}
          style={{
            fontFamily: theme.font.ui,
            fontSize: 12,
            fontWeight: 700,
            color: muted ? theme.color.textFaint : theme.color.void,
            background: muted ? 'rgba(125,211,252,0.08)' : theme.color.accent,
            border: `1px solid ${muted ? 'rgba(125,211,252,0.24)' : theme.color.accent}`,
            borderRadius: theme.radius.sm,
            padding: '7px 10px',
            cursor: 'pointer'
          }}
        >
          {muted ? 'Muted' : 'On'}
        </button>
      </div>

      <VolumeSlider
        label="Music"
        value={musicPercent}
        compact={compact}
        onUnlock={unlock}
        onChange={value => onVolumeInput(value, setMusicVolume)}
      />
      <VolumeSlider
        label="SFX"
        value={sfxPercent}
        compact={compact}
        onUnlock={unlock}
        onChange={value => onVolumeInput(value, setSfxVolume)}
      />
    </div>
  );
};

interface VolumeSliderProps {
  label: string;
  value: number;
  compact: boolean;
  onUnlock: () => void;
  onChange: (value: number) => void;
}

const VolumeSlider: React.FC<VolumeSliderProps> = ({ label, value, compact, onUnlock, onChange }) => (
  <label style={{ display: 'grid', gap: compact ? 3 : 4 }}>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10,
      fontFamily: theme.font.mono,
      fontSize: 11,
      color: theme.color.textDim
    }}>
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <input
      aria-label={`${label} volume`}
      type="range"
      min={0}
      max={100}
      value={value}
      onPointerDown={onUnlock}
      onChange={event => onChange(Number(event.currentTarget.value))}
      style={{
        width: '100%',
        accentColor: theme.color.accent,
        cursor: 'pointer'
      }}
    />
  </label>
);

export default AudioControls;
