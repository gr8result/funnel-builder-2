import { useRef, useState } from "react";

export default function VoiceInput({ value, onChange, placeholder = "", label = "", textarea = false, ...props }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  function startListening() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onChange(transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      {label && <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {textarea ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            {...props}
            style={{ flex: 1, minHeight: 60, ...props.style }}
          />
        ) : (
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            {...props}
            style={{ flex: 1, ...props.style }}
          />
        )}
        <button
          type="button"
          aria-label={listening ? "Stop voice input" : "Start voice input"}
          onClick={listening ? stopListening : startListening}
          style={{
            background: listening ? '#10b981' : '#1e293b',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            width: 38,
            height: 38,
            cursor: 'pointer',
            fontSize: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: listening ? '2px solid #10b981' : 'none',
            transition: 'background 0.2s',
          }}
        >
          <span role="img" aria-label="mic">{listening ? '🎤' : '🎙️'}</span>
        </button>
      </div>
    </label>
  );
}
