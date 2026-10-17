/** Browser speech. Most devices only have an English voice, so this is a fallback: prefer speakServer(). */
export function speakText(text: string, lang = "en-IN", slow = false) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = slow ? 0.72 : 0.95;
    utterance.pitch = 1.0;

    // Check if voice is available
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith(lang.slice(0, 2)) ||
          v.name.toLowerCase().includes(lang.slice(0, 2))
      );
      if (preferred) {
        utterance.voice = preferred;
      }
    }

    window.speechSynthesis.speak(utterance);
  } catch {
    // Graceful fallback if speech synthesis is disabled or blocked
  }
}
