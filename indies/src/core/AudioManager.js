/**
 * AudioManager.js - Web Audio API を活用したBGM・効果音合成＆音量管理クラス
 */

export class AudioManager {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;

    // 音量設定 (0.0 ～ 1.0)
    const saved = this.loadSettings();
    this.masterVolume = saved.masterVolume ?? 0.8;
    this.bgmVolume = saved.bgmVolume ?? 0.6;
    this.sfxVolume = saved.sfxVolume ?? 0.7;
    this.isMuted = saved.isMuted ?? false;

    this.bgmOscs = [];
    this.bgmInterval = null;
    this.isBgmPlaying = false;
  }

  /** Web Audio Context の初期化（ユーザー操作イベントで呼び出す） */
  initCtx() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      this.audioCtx = new AudioCtxClass();

      this.masterGain = this.audioCtx.createGain();
      this.bgmGain = this.audioCtx.createGain();
      this.sfxGain = this.audioCtx.createGain();

      this.bgmGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);

      this.applyVolumes();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /** 音量設定の読み込み */
  loadSettings() {
    try {
      const raw = localStorage.getItem('cyber_audio_settings');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  /** 音量設定の保存 */
  saveSettings() {
    try {
      localStorage.setItem('cyber_audio_settings', JSON.stringify({
        masterVolume: this.masterVolume,
        bgmVolume: this.bgmVolume,
        sfxVolume: this.sfxVolume,
        isMuted: this.isMuted
      }));
    } catch (e) {}
  }

  /** ゲインノードに音量を反映 */
  applyVolumes() {
    if (!this.masterGain) return;
    const now = this.audioCtx.currentTime;
    const effectiveMaster = this.isMuted ? 0 : this.masterVolume;

    this.masterGain.gain.setValueAtTime(effectiveMaster, now);
    this.bgmGain.gain.setValueAtTime(this.bgmVolume, now);
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, now);
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    this.applyVolumes();
    this.saveSettings();
  }

  setBgmVolume(val) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    this.applyVolumes();
    this.saveSettings();
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    this.applyVolumes();
    this.saveSettings();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.applyVolumes();
    this.saveSettings();
    return this.isMuted;
  }

  /** サイバーパンクアンビエント BGM の開始 */
  startBgm() {
    this.initCtx();
    if (!this.audioCtx || this.isBgmPlaying) return;
    this.isBgmPlaying = true;

    // 定期的にサイバーコードコードプログレッションを低音合成
    const chordNotes = [
      [110, 130.81, 164.81], // A minor
      [98, 123.47, 146.83],  // G major
      [87.31, 110, 130.81],  // F major
      [82.41, 103.83, 123.47] // E minor
    ];
    let step = 0;

    const playChordStep = () => {
      if (!this.isBgmPlaying || !this.audioCtx) return;
      const notes = chordNotes[step % chordNotes.length];
      step++;

      notes.forEach((freq) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        const now = this.audioCtx.currentTime;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);

        osc.connect(gain);
        gain.connect(this.bgmGain);

        osc.start(now);
        osc.stop(now + 4.0);
      });
    };

    playChordStep();
    this.bgmInterval = setInterval(playChordStep, 4000);
  }

  stopBgm() {
    this.isBgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  /** 効果音（SFX）の合成再生 */
  playSfx(type) {
    this.initCtx();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    switch (type) {
      case 'click': {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }

      case 'card_draw': {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.08);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }

      case 'card_play': {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.04); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.08); // G5

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }

      case 'attack': {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }

      case 'shield': {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(450, now + 0.15);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }

      case 'heal': {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.2);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }

      case 'overclock': {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.35);
        break;
      }

      case 'error': {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.setValueAtTime(110, now + 0.06);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }

      case 'slash': {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }

      case 'magic': {
        [600, 900, 1200].forEach((freq, i) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.04);
          osc.frequency.exponentialRampToValueAtTime(1600, now + i * 0.04 + 0.12);

          gain.gain.setValueAtTime(0.2, now + i * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.04 + 0.12);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now + i * 0.04);
          osc.stop(now + i * 0.04 + 0.12);
        });
        break;
      }

      case 'buy': {
        [523.25, 659.25, 1046.50].forEach((freq, i) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.05);

          gain.gain.setValueAtTime(0.25, now + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.15);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.15);
        });
        break;
      }

      case 'boss_appear': {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.6);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.6);
        break;
      }

      case 'victory': {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);

          gain.gain.setValueAtTime(0.25, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.3);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.3);
        });
        break;
      }

      default:
        break;
    }
  }
}
