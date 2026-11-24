/**
 * GameAudio.ts - Zero-dependency procedural Web Audio API sound synthesizer
 * Implements audio feedback for all survival game actions as specified in gameLogicV1.txt Section 53.
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private masterGain: GainNode | null = null;

  private bgmAudio: HTMLAudioElement | null = null;
  private bgmStarted = false;
  private readonly BGM_VOLUME = 0.10;

  constructor() {
    if (typeof window !== "undefined") {
      (window as any).GameAudio = this;
    }
    // Attempt instant autoplay on site arrival, with user interaction fallbacks
    this.startBgm();
    this.setupUserInteractionListener();
  }

  private setupUserInteractionListener() {
    if (typeof window === "undefined") return;
    const startAudio = () => {
      this.initContext();
      this.startBgm();
      if (this.bgmAudio && !this.bgmAudio.paused) {
        window.removeEventListener("click", startAudio);
        window.removeEventListener("keydown", startAudio);
        window.removeEventListener("pointerdown", startAudio);
        window.removeEventListener("touchstart", startAudio);
        window.removeEventListener("mousemove", startAudio);
      }
    };
    window.addEventListener("click", startAudio);
    window.addEventListener("keydown", startAudio);
    window.addEventListener("pointerdown", startAudio);
    window.addEventListener("touchstart", startAudio);
    window.addEventListener("mousemove", startAudio, { once: true });
  }

  public startBgm() {
    if (typeof window === "undefined") return;
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio("/audio/bgm.wav");
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = this.enabled ? this.BGM_VOLUME : 0;
    }
    if (this.enabled && this.bgmAudio.paused) {
      this.bgmAudio.play().then(() => {
        this.bgmStarted = true;
      }).catch((e) => {
        // Autoplay policy might block until next interaction
        console.warn("BGM autoplay pending user interaction:", e);
      });
    }
  }

  public stopBgm() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.25;
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.enabled = !this.enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? 0.25 : 0;
    }
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.enabled ? this.BGM_VOLUME : 0;
      if (this.enabled && this.bgmAudio.paused) {
        this.bgmAudio.play().catch(() => {});
      }
    }
    return !this.enabled;
  }

  public isMuted(): boolean {
    return !this.enabled;
  }

  // 1. Footstep sound with surface awareness
  public playFootstep(surface: 'grass' | 'dirt' | 'sand' | 'water' | 'wood' = 'grass') {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    if (surface === 'water') {
      // Liquid squelch / soft splash
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320 + Math.random() * 40, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (surface === 'wood') {
      // Hollow resonant clatter
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220 + Math.random() * 30, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.07);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (surface === 'dirt' || surface === 'sand') {
      // Granular scuff / crisp friction
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(150 + Math.random() * 30, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.06);

      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.06);
    } else {
      // Lush grass muffled turf swish
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(95 + Math.random() * 20, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.06);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  }

  // 1b. Plant / Bush rustle sound
  public playRustle() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(450 + Math.random() * 60, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // 2. Tree Chop (wood impact with woody resonance)
  public playChop() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(260 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // 3. Mining Rock (metallic/mineral crack)
  public playMine() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(520 + Math.random() * 80, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.1);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // 4. Pickup Item (cheerful high blip)
  public playPickup() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // 5. Crafting Success (fanfare chime)
  public playCraft() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const notes = [440, 554, 659];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = this.ctx.currentTime + idx * 0.07;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.16);
    });
  }

  // 6. Pet Animal (warm heart chime)
  public playHeartChime() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const notes = [587, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = this.ctx.currentTime + idx * 0.1;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, start + 0.2);

      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  // 7. Eat Food (crunch / munch sound)
  public playEat() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    for (let i = 0; i < 3; i++) {
      const start = this.ctx.currentTime + i * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(280 + Math.random() * 50, start);
      osc.frequency.exponentialRampToValueAtTime(120, start + 0.06);

      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.06);
    }
  }

  // 8. Player or Enemy Hurt (low thud)
  public playHurt() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  // 9. Build Structure Placed (solid hammer tap)
  public playBuild() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // 10. Sword Attack Swing
  public playSwing() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.1);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // 11. Jump Hop Sound
  public playJump() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.12);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

export const GameAudio = new SoundSynthesizer();
