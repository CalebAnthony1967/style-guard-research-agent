import { useCallback, useEffect, useRef, useState } from 'react';

/** Browser speech recognition for dictation and speech synthesis for playback. */
export function useVoice({ onTranscript } = {}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef(onTranscript);
  transcriptRef.current = onTranscript;

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(Recognition));
    if (!Recognition) return undefined;

    const recognition = new Recognition();
    recognition.lang = 'en-KE';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((r) => r[0].transcript).join(' ').trim();
      if (text) transcriptRef.current?.(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_`>]/g, ''));
    utterance.rate = 1.02;
    utterance.pitch = 0.98;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { listening, supported, start, stop, speak };
}