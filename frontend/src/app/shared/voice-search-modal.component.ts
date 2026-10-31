import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';

export interface VoiceLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  samplePrompt: string;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

@Component({
  selector: 'app-voice-search-modal',
  standalone: true,
  template: `
    <div class="voice-modal-backdrop" (click)="close()">
      <div class="voice-modal-card" (click)="$event.stopPropagation()">
        <!-- Header: Title & Close -->
        <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
          <div class="d-flex align-items-center gap-2">
            <span class="voice-logo-badge">
              <i class="bi bi-mic-fill text-success"></i>
            </span>
            <div>
              <h3 class="h6 fw-bold mb-0 text-ink">Voice Search</h3>
              <small class="text-muted">Speak in your language to find groceries</small>
            </div>
          </div>
          <button
            type="button"
            class="btn-close"
            (click)="close()"
            aria-label="Close voice search"
          ></button>
        </div>

        <!-- Language Selector Chips -->
        <div class="mb-3">
          <label class="form-label small text-muted mb-1 d-block fw-semibold" style="font-size: 0.72rem;">
            SELECT SPOKEN LANGUAGE:
          </label>
          <div class="lang-chips-grid">
            @for (lang of languages; track lang.code) {
              <button
                type="button"
                class="lang-chip"
                [class.active]="selectedLanguage().code === lang.code"
                (click)="selectLanguage(lang)"
              >
                <span class="lang-flag">{{ lang.flag }}</span>
                <span class="lang-name">{{ lang.nativeName }}</span>
                <span class="lang-sub">{{ lang.name }}</span>
              </button>
            }
          </div>
        </div>

        <!-- Listening Visualizer Stage -->
        <div class="voice-stage text-center py-4 my-2 rounded-4">
          <!-- Animated Sound Wave Rings -->
          <div class="mic-pulsar-wrap mb-3">
            <div
              class="mic-pulse-ring"
              [class.pulsing]="isListening()"
              [class.processing]="isProcessing()"
            ></div>
            <div
              class="mic-pulse-ring ring-2"
              [class.pulsing]="isListening()"
            ></div>
            <button
              type="button"
              class="mic-action-btn"
              [class.active]="isListening()"
              (click)="toggleListening()"
              [title]="isListening() ? 'Tap to pause' : 'Tap to start speaking'"
            >
              @if (isProcessing()) {
                <span class="spinner-border spinner-border-sm text-dark" role="status"></span>
              } @else {
                <i class="bi" [class.bi-mic-fill]="isListening()" [class.bi-mic-mute-fill]="!isListening()"></i>
              }
            </button>
          </div>

          <!-- Animated Audio Waveform Bars (visible while listening) -->
          @if (isListening()) {
            <div class="waveform-bars d-flex justify-content-center align-items-center gap-1 mb-2">
              <span class="wave-bar bar-1"></span>
              <span class="wave-bar bar-2"></span>
              <span class="wave-bar bar-3"></span>
              <span class="wave-bar bar-4"></span>
              <span class="wave-bar bar-5"></span>
            </div>
          }

          <!-- Live Status & Transcript -->
          <div class="status-box px-3">
            @if (isListening()) {
              <div class="listening-label text-success fw-bold">
                <span class="pulse-dot"></span> Listening in {{ selectedLanguage().nativeName }}…
              </div>
              @if (liveTranscript()) {
                <div class="live-transcript mt-2">
                  "{{ liveTranscript() }}"
                </div>
              } @else {
                <div class="transcript-placeholder mt-2 text-muted small">
                  Say something like: <i>"{{ selectedLanguage().samplePrompt }}"</i>
                </div>
              }
            } @else if (isProcessing()) {
              <div class="processing-label text-primary fw-bold">
                <i class="bi bi-stars me-1 text-warning"></i> Finding matching groceries…
              </div>
              <div class="live-transcript mt-1">"{{ liveTranscript() }}"</div>
            } @else if (liveTranscript()) {
              <div class="recognized-label text-success fw-bold">
                <i class="bi bi-check-circle-fill me-1"></i> Recognized:
              </div>
              <div class="live-transcript mt-1 fw-bold fs-5 text-ink">
                "{{ liveTranscript() }}"
              </div>
            } @else {
              <div class="idle-label text-muted">
                Tap the microphone to speak or pick a quick grocery phrase below
              </div>
            }
          </div>
        </div>

        <!-- Quick Sample Voice Prompts (Instant 1-Tap Testing) -->
        <div class="sample-prompts-section mt-3 pt-2 border-top">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="text-muted small fw-semibold" style="font-size: 0.72rem;">
              <i class="bi bi-lightning-charge-fill text-warning me-1"></i> QUICK VOICE EXAMPLES (1-TAP TEST)
            </span>
          </div>
          <div class="sample-chips-wrap">
            @for (sample of currentSamplePrompts(); track sample) {
              <button
                type="button"
                class="sample-chip"
                (click)="useSamplePrompt(sample)"
              >
                <i class="bi bi-chat-quote-fill me-1 text-success"></i>
                <span>{{ sample }}</span>
              </button>
            }
          </div>
        </div>

        <!-- Error & Fallback Banner (if permission denied or unsupported) -->
        @if (errorMessage()) {
          <div class="alert alert-warning py-2 px-3 small mt-3 mb-0 d-flex align-items-start gap-2">
            <i class="bi bi-exclamation-triangle-fill text-warning flex-shrink-0 mt-1"></i>
            <div class="flex-grow-1">
              <span>{{ errorMessage() }}</span>
              <div class="mt-1">
                <small class="text-muted">You can still tap any of the quick grocery examples above to search instantly.</small>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .voice-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(11, 15, 21, 0.72);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .voice-modal-card {
      background: var(--card, #ffffff);
      color: var(--ink, #1e293b);
      border: 1.5px solid var(--card-border, #e2e8f0);
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
      width: 100%;
      max-width: 500px;
      padding: 1.35rem;
      position: relative;
      animation: popUp 0.24s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes popUp {
      from { transform: scale(0.92) translateY(12px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }

    .voice-logo-badge {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: rgba(5, 150, 105, 0.12);
      border: 1px solid rgba(5, 150, 105, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
    }

    .lang-chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .lang-chip {
      background: var(--chip-bg, #f1f5f9);
      border: 1px solid var(--chip-border, #e2e8f0);
      color: var(--ink, #334155);
      border-radius: 10px;
      padding: 0.32rem 0.65rem;
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.15s ease;
    }

    .lang-chip:hover {
      border-color: var(--leaf, #059669);
      background: var(--chip-hover-bg, #e2e8f0);
    }

    .lang-chip.active {
      background: rgba(5, 150, 105, 0.14);
      border-color: var(--leaf, #059669);
      color: var(--leaf, #059669);
      box-shadow: 0 2px 8px rgba(5, 150, 105, 0.2);
    }

    .lang-sub {
      font-size: 0.68rem;
      opacity: 0.75;
      font-weight: normal;
    }

    .voice-stage {
      background: var(--chip-bg, #f8fafc);
      border: 1px solid var(--line, #e2e8f0);
    }

    .mic-pulsar-wrap {
      position: relative;
      width: 84px;
      height: 84px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mic-pulse-ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: rgba(5, 150, 105, 0.2);
      pointer-events: none;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }

    .mic-pulse-ring.pulsing {
      animation: pulseRipple 1.4s ease-out infinite;
    }

    .mic-pulse-ring.ring-2.pulsing {
      animation: pulseRipple 1.4s ease-out infinite 0.4s;
    }

    .mic-pulse-ring.processing {
      background: rgba(59, 130, 246, 0.2);
      animation: pulseRipple 1s ease-out infinite;
    }

    @keyframes pulseRipple {
      0% {
        transform: scale(0.85);
        opacity: 0.8;
      }
      100% {
        transform: scale(1.6);
        opacity: 0;
      }
    }

    .mic-action-btn {
      position: relative;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--leaf, #059669);
      border: 3px solid #ffffff;
      color: #ffffff;
      font-size: 1.55rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(5, 150, 105, 0.4);
      transition: all 0.2s ease;
      z-index: 2;
    }

    .mic-action-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 10px 28px rgba(5, 150, 105, 0.55);
    }

    .mic-action-btn.active {
      background: #10b981;
      transform: scale(1.06);
    }

    /* Waveform visualizer */
    .waveform-bars {
      height: 24px;
    }

    .wave-bar {
      width: 4px;
      background: var(--leaf, #059669);
      border-radius: 999px;
      animation: waveBounce 0.8s ease-in-out infinite alternate;
    }

    .bar-1 { height: 8px; animation-delay: 0.1s; }
    .bar-2 { height: 18px; animation-delay: 0.3s; }
    .bar-3 { height: 24px; animation-delay: 0.5s; }
    .bar-4 { height: 16px; animation-delay: 0.2s; }
    .bar-5 { height: 10px; animation-delay: 0.4s; }

    @keyframes waveBounce {
      0% { transform: scaleY(0.3); }
      100% { transform: scaleY(1.2); }
    }

    .pulse-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      margin-right: 4px;
      animation: blink 0.9s infinite alternate;
    }

    @keyframes blink {
      0% { opacity: 0.3; }
      100% { opacity: 1; }
    }

    .live-transcript {
      font-size: 1.05rem;
      color: var(--ink, #1e293b);
      font-style: italic;
      line-height: 1.35;
    }

    .sample-chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }

    .sample-chip {
      background: var(--chip-bg, #f1f5f9);
      border: 1px solid var(--chip-border, #e2e8f0);
      color: var(--ink, #334155);
      border-radius: 8px;
      padding: 0.32rem 0.65rem;
      font-size: 0.76rem;
      font-weight: 550;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      transition: all 0.15s ease;
    }

    .sample-chip:hover {
      border-color: var(--leaf, #059669);
      background: rgba(5, 150, 105, 0.08);
      color: var(--leaf, #059669);
      transform: translateY(-1px);
    }
  `],
})
export class VoiceSearchModalComponent implements OnInit, OnDestroy {
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);

  @Output() querySelected = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  readonly languages: VoiceLanguage[] = [
    { code: 'en-IN', name: 'English', nativeName: 'English (IN)', flag: '🇬🇧', samplePrompt: 'Amul Butter 500g' },
    { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', samplePrompt: 'दूध और दो किलो आलू' },
    { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', samplePrompt: 'ನಂದಿನಿ ಹಾಲು ಮತ್ತು ಬಾಳೆಹಣ್ಣು' },
    { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', samplePrompt: 'ஆவின் பால் மற்றும் தக்காளி' },
    { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', samplePrompt: 'పాలు మరియు ఉల్లిపాయలు' },
    { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', samplePrompt: 'एक किलो कांदा आणि बटाटा' },
    { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳', samplePrompt: 'আলু এবং সর্ষের তেল' },
  ];

  readonly selectedLanguage = signal<VoiceLanguage>(this.languages[0]);
  readonly isListening = signal<boolean>(false);
  readonly isProcessing = signal<boolean>(false);
  readonly liveTranscript = signal<string>('');
  readonly errorMessage = signal<string>('');

  private recognition: any = null;

  currentSamplePrompts() {
    const lang = this.selectedLanguage().code;
    switch (lang) {
      case 'hi-IN':
        return ['Amul doodh 500ml', '2 kg aloo tamatar', 'Aashirvaad atta 5kg', 'Tata namak'];
      case 'kn-IN':
        return ['Nandini toned milk', '1 kg alugadde eerulli', 'Bale hannu bananas', 'Tata salt'];
      case 'ta-IN':
        return ['Aavin milk 500ml', 'Thakkali vengayam', 'Vazhaipazham bananas', 'Ponni arisi'];
      case 'te-IN':
        return ['Heritage milk 500ml', 'Ullipaya tamata', 'Arati pandu', 'Sona masoori biyyam'];
      case 'mr-IN':
        return ['Gokul dudh', 'Batata kanda 1kg', 'Poha and rava', 'Kele'];
      case 'bn-IN':
        return ['Amul milk', 'Aloo peyaj 1kg', 'Mustard oil 1L', 'Fortune rice'];
      default:
        return ['Amul butter 500g', 'Fresh bananas 1kg', 'Nandini milk', 'Lays potato chips'];
    }
  }

  ngOnInit() {
    const savedLangCode = localStorage.getItem('zap_voice_lang');
    if (savedLangCode) {
      const found = this.languages.find((l) => l.code === savedLangCode);
      if (found) this.selectedLanguage.set(found);
    }

    this.initSpeechRecognition();
  }

  ngOnDestroy() {
    this.stopListening();
  }

  selectLanguage(lang: VoiceLanguage) {
    this.selectedLanguage.set(lang);
    localStorage.setItem('zap_voice_lang', lang.code);
    if (this.isListening()) {
      this.stopListening();
      setTimeout(() => this.startListening(), 150);
    }
  }

  private initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.errorMessage.set(
        'Speech recognition is not natively supported in this browser. You can still test with the 1-tap quick examples below!'
      );
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening.set(true);
        this.errorMessage.set('');
      };

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const text = (final || interim).trim();
        if (text) {
          this.liveTranscript.set(text);
        }

        if (final) {
          this.handleSpeechFinalized(final.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('[Voice Search] Speech recognition notice:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.errorMessage.set('Microphone permission was denied. Please allow microphone access or tap the quick examples below.');
        } else if (event.error === 'no-speech') {
          this.errorMessage.set("Didn't catch that. Tap the mic to try speaking again.");
        } else {
          this.errorMessage.set(`Voice error (${event.error}). You can tap the sample chips below to search.`);
        }
        this.isListening.set(false);
      };

      this.recognition.onend = () => {
        this.isListening.set(false);
      };

      // Automatically start listening on open
      this.startListening();
    } catch (err: any) {
      this.errorMessage.set('Unable to start speech engine. You can tap the quick examples below.');
    }
  }

  toggleListening() {
    if (this.isListening()) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  startListening() {
    if (!this.recognition) {
      this.initSpeechRecognition();
      return;
    }

    this.errorMessage.set('');
    this.liveTranscript.set('');
    this.recognition.lang = this.selectedLanguage().code;

    try {
      this.recognition.start();
    } catch {
      // recognition may already be active
    }
  }

  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isListening.set(false);
  }

  async handleSpeechFinalized(spokenText: string) {
    this.stopListening();
    this.isProcessing.set(true);

    try {
      // Interpret the spoken text (transliterating regional terms like "doodh", "aloo", "ಹಾಲು", "दूध")
      const interpreted = await this.shop.interpretVoice(spokenText, this.selectedLanguage().code);
      const query = (interpreted.cleanQuery || spokenText).trim();

      setTimeout(() => {
        this.isProcessing.set(false);
        this.querySelected.emit(query);
      }, 350);
    } catch {
      this.isProcessing.set(false);
      this.querySelected.emit(spokenText);
    }
  }

  async useSamplePrompt(sample: string) {
    this.stopListening();
    this.liveTranscript.set(sample);
    this.isProcessing.set(true);

    try {
      const interpreted = await this.shop.interpretVoice(sample, this.selectedLanguage().code);
      const query = (interpreted.cleanQuery || sample).trim();

      setTimeout(() => {
        this.isProcessing.set(false);
        this.querySelected.emit(query);
      }, 300);
    } catch {
      this.isProcessing.set(false);
      this.querySelected.emit(sample);
    }
  }

  close() {
    this.stopListening();
    this.closed.emit();
  }

  @HostListener('window:keydown.escape')
  onEscape() {
    this.close();
  }
}
