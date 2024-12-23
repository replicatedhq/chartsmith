export class EditorTyper {
  private content: string;
  private currentIndex: number;
  private onUpdate: (text: string) => void;
  private resolve: (() => void) | null;
  private typingSpeed: number;
  private aborted: boolean;

  constructor(content: string, onUpdate: (text: string) => void, typingSpeed = 30) {
    this.content = content;
    this.currentIndex = 0;
    this.onUpdate = onUpdate;
    this.resolve = null;
    this.typingSpeed = typingSpeed;
    this.aborted = false;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.typeNextCharacter();
    });
  }

  abort(): void {
    this.aborted = true;
    if (this.resolve) {
      this.resolve();
    }
  }

  private typeNextCharacter() {
    if (this.aborted) {
      return;
    }

    if (this.currentIndex < this.content.length) {
      const nextChar = this.content[this.currentIndex];
      this.onUpdate(this.content.slice(0, this.currentIndex + 1));
      this.currentIndex++;
      
      // Type faster for whitespace
      const delay = nextChar === ' ' || nextChar === '\n' ? this.typingSpeed / 2 : this.typingSpeed;
      setTimeout(() => this.typeNextCharacter(), delay);
    } else if (this.resolve) {
      this.resolve();
    }
  }
}