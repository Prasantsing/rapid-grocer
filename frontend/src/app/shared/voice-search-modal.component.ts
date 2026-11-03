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
  templateUrl: './voice-search-modal.component.html',
  styleUrl: './voice-search-modal.component.scss',
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
