import type { ReactNode } from 'react';
import { useSettings } from '../settings/SettingsContext';
import { MUSIC_TRACK_IDS, type MusicChoice, type Settings } from '../settings/settings';
import { MUSIC_TRACKS } from '../audio/music';
import { audio, type SoundEffect } from '../audio/audioEngine';
import { Button } from './common/Button';
import './SettingsPage.css';

interface SettingsPageProps {
  onBack: () => void;
  backLabel?: string;
}

const MUSIC_CHOICES: readonly MusicChoice[] = ['auto', ...MUSIC_TRACK_IDS];

function musicLabel(choice: MusicChoice): string {
  return choice === 'auto' ? 'Follow the action' : MUSIC_TRACKS[choice].name;
}

function musicDescription(choice: MusicChoice): string {
  return choice === 'auto'
    ? 'The title theme on the main menu, a running pulse while a picture is shooting, the lounge everywhere else.'
    : MUSIC_TRACKS[choice].description;
}

/**
 * Player preferences: sound, music and display. Stored on this device,
 * separate from the studio save (settings/settings.ts), so they survive a new
 * studio and never travel with one. Changes apply as they are made - there is
 * no Save button to forget.
 */
export function SettingsPage({ onBack, backLabel = 'Back to the studio' }: SettingsPageProps) {
  const { settings, updateSettings, resetSettings } = useSettings();

  // A slider released, or a sample asked for, plays a sound at the level just
  // set - the only honest way to choose a volume.
  function sample(effect: SoundEffect) {
    audio.unlock();
    audio.play(effect);
  }

  return (
    <div className="stack settings-page">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>Settings</h1>
        <Button onClick={onBack}>{backLabel}</Button>
      </div>
      <p className="choice-description">
        Kept on this device, apart from your studio - starting a new studio leaves them as they are. Changes apply
        straight away.
      </p>

      {!audio.supported && (
        <p className="settings-page__note" role="note">
          This browser can&rsquo;t play the game&rsquo;s sound, so the settings below won&rsquo;t be heard.
        </p>
      )}

      <section className="card stack" aria-labelledby="settings-sound">
        <h2 id="settings-sound" style={{ margin: 0 }}>Sound</h2>

        <VolumeRow
          label="Master volume"
          value={settings.masterVolume}
          onChange={(masterVolume) => updateSettings({ masterVolume })}
          onCommit={() => sample('confirm')}
        />

        <SettingRow
          label="Sound effects"
          hint="Receipts, Inbox arrivals, the outbid alarm, premiere night."
          control={<Switch label="Sound effects" checked={settings.sfxEnabled} onChange={(sfxEnabled) => updateSettings({ sfxEnabled })} />}
        />
        <VolumeRow
          label="Effects volume"
          value={settings.sfxVolume}
          disabled={!settings.sfxEnabled}
          onChange={(sfxVolume) => updateSettings({ sfxVolume })}
          onCommit={() => sample('cash')}
        />
        <SettingRow
          label="Button clicks"
          hint="A soft tick on every press. Off keeps the effects that mean something."
          control={
            <Switch
              label="Button clicks"
              checked={settings.interfaceClicks}
              disabled={!settings.sfxEnabled}
              onChange={(interfaceClicks) => updateSettings({ interfaceClicks })}
            />
          }
        />
        <div className="settings-page__samples">
          <span className="stat-label">Hear them</span>
          <div className="row" style={{ gap: 8 }}>
            {(
              [
                ['cash', 'Purchase'],
                ['notify', 'Inbox'],
                ['alert', 'Outbid'],
                ['premiere', 'Premiere'],
                ['hit', 'Hit'],
                ['flop', 'Flop'],
              ] as [SoundEffect, string][]
            ).map(([effect, label]) => (
              <button key={effect} type="button" className="btn btn-sm" disabled={!settings.sfxEnabled} onClick={() => sample(effect)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card stack" aria-labelledby="settings-music">
        <h2 id="settings-music" style={{ margin: 0 }}>Music</h2>
        <SettingRow
          label="Music"
          hint="Looping score, made live in the browser."
          control={<Switch label="Music" checked={settings.musicEnabled} onChange={(musicEnabled) => updateSettings({ musicEnabled })} />}
        />
        <VolumeRow
          label="Music volume"
          value={settings.musicVolume}
          disabled={!settings.musicEnabled}
          onChange={(musicVolume) => updateSettings({ musicVolume })}
        />
        <div className="stack" style={{ gap: 8 }}>
          <span className="stat-label" id="settings-track">What plays</span>
          <div className="settings-page__choices" role="radiogroup" aria-labelledby="settings-track">
            {MUSIC_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={settings.music === choice}
                disabled={!settings.musicEnabled}
                className={`settings-page__choice${settings.music === choice ? ' settings-page__choice--on' : ''}`}
                onClick={() => updateSettings({ music: choice })}
              >
                <span className="settings-page__choice-name">{musicLabel(choice)}</span>
                <span className="settings-page__choice-desc">{musicDescription(choice)}</span>
              </button>
            ))}
          </div>
        </div>
        <SettingRow
          label="Quiet in the background"
          hint="Silence everything while you're in another tab or window."
          control={
            <Switch label="Quiet in the background" checked={settings.muteInBackground} onChange={(muteInBackground) => updateSettings({ muteInBackground })} />
          }
        />
      </section>

      <section className="card stack" aria-labelledby="settings-display">
        <h2 id="settings-display" style={{ margin: 0 }}>Display</h2>
        <SettingRow
          label="Theme"
          control={
            <div className="row" style={{ gap: 8 }} role="radiogroup" aria-label="Theme">
              {(['light', 'dark'] as Settings['theme'][]).map((theme) => (
                <Button
                  key={theme}
                  role="radio"
                  aria-checked={settings.theme === theme}
                  variant={settings.theme === theme ? 'primary' : 'secondary'}
                  onClick={() => updateSettings({ theme })}
                >
                  {theme === 'light' ? 'Light' : 'Dark'}
                </Button>
              ))}
            </div>
          }
        />
      </section>

      <div className="row">
        <Button variant="text" onClick={resetSettings}>Restore default sound settings</Button>
      </div>
    </div>
  );
}

function SettingRow({ label, hint, control }: { label: string; hint?: string; control: ReactNode }) {
  return (
    <div className="settings-page__row">
      <div>
        <div className="settings-page__label">{label}</div>
        {hint && <p className="settings-page__hint">{hint}</p>}
      </div>
      {control}
    </div>
  );
}

function Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`settings-switch${checked ? ' settings-switch--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-switch__knob" aria-hidden="true" />
      <span className="settings-switch__text">{checked ? 'On' : 'Off'}</span>
    </button>
  );
}

function VolumeRow({
  label,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  const percent = Math.round(value * 100);
  return (
    <label className={`settings-page__volume${disabled ? ' settings-page__volume--off' : ''}`}>
      <span className="settings-page__label">{label}</span>
      <input
        type="range"
        className="tier-slider"
        min={0}
        max={100}
        step={1}
        value={percent}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={`${percent}%`}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
      <span className="settings-page__percent typed">{percent}%</span>
    </label>
  );
}
