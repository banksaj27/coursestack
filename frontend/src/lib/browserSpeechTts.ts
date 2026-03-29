/** Free fallback when ElevenLabs API rejects the account (e.g. 402 library / plan limits). */

export function cancelBrowserSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function browserSpeechAvailable(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

function speakOne(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!browserSpeechAvailable()) {
      reject(new Error("Speech synthesis is not available in this browser."));
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.onend = () => resolve();
    u.onerror = () =>
      reject(new Error("Browser speech was interrupted or failed."));
    window.speechSynthesis.speak(u);
  });
}

export async function speakPlainTextChunksBrowser(
  chunks: string[],
  isAborted: () => boolean,
  onChunkIndex?: (oneBased: number) => void,
  waitIfPaused?: () => Promise<void>,
): Promise<void> {
  for (let i = 0; i < chunks.length; i++) {
    if (isAborted()) return;
    if (waitIfPaused) await waitIfPaused();
    if (isAborted()) return;
    onChunkIndex?.(i + 1);
    const t = chunks[i]!.trim();
    if (!t) continue;
    await speakOne(t);
  }
}
