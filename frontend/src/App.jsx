import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Bot, User, Mic, MicOff, Volume2, VolumeX, Sparkles } from 'lucide-react';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [sessionId] = useState(() => 'session_' + Math.random().toString(36).substring(2, 9));
  
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        handleSendMessage(transcript);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, [sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isSpeaking]);

  // Start listening helper
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  // Text-To-Speech with Auto-Mic Loop
  const speakText = (text, isConversationOver = false) => {
    if (!('speechSynthesis' in window) || !autoSpeak) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.4;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);

    utterance.onend = () => {
      setIsSpeaking(false);
      // ONLY turn mic back on if the conversation is NOT finished
      if (!isConversationOver) {
        setTimeout(() => {
          startListening();
        }, 400);
      }
    };

    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      startListening();
    }
  };

  const handleSendMessage = async (textToSend) => {
    const userText = textToSend || input;
    if (!userText.trim() || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    // Friendly error message to display when the AI fails or hits rate limits
    const FALLBACK_ERROR_MESSAGE = "Sorry, the AI isn't available right now. Please try again in a moment.";

    try {
      const res = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: userText
        }),
      });

      const data = await res.json();

      // If the API returns an error status (like 429 Rate Limit or 503 Unavailable)
      if (data.error || !res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', text: FALLBACK_ERROR_MESSAGE }]);
        speakText(FALLBACK_ERROR_MESSAGE, true); // Speak error message and stop mic loop
      } else {
        let aiText = data.response;
        const isConversationOver = aiText.includes('[END_CONVERSATION]');

        // Clean tag out before displaying and speaking
        aiText = aiText.replace('[END_CONVERSATION]', '').trim();

        setMessages((prev) => [...prev, { role: 'assistant', text: aiText }]);
        speakText(aiText, isConversationOver);
      }
    } catch (err) {
      // Handles network disconnection or server crashes
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: FALLBACK_ERROR_MESSAGE }
      ]);
      speakText(FALLBACK_ERROR_MESSAGE, true);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsListening(false);
    await fetch('http://localhost:5000/api/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    setMessages([]);
  };

  return (
    <div className="app-container">
      <div className="chat-card">
        {/* Modern Header */}
        <header className="header">
          <div className="brand">
            <div className="logo-glow">
              <Sparkles className="logo-icon" size={20} />
            </div>
            <div>
              <h1 className="title">AI Voice</h1>
              <span className="status-badge">
                <span className="status-dot"></span> Active
              </span>
            </div>
          </div>
          <div className="actions">
            <button 
              onClick={() => {
                setAutoSpeak(!autoSpeak);
                if (autoSpeak) window.speechSynthesis.cancel();
              }} 
              className={`control-btn ${!autoSpeak ? 'muted' : ''}`}
              title={autoSpeak ? "Mute AI Voice" : "Unmute AI Voice"}
            >
              {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button onClick={clearChat} className="control-btn danger" title="Clear Memory">
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        {/* Dynamic Voice Status Bar */}
        {(isListening || isSpeaking) && (
          <div className={`voice-status-bar ${isListening ? 'listening' : 'speaking'}`}>
            <div className="pulse-orb"></div>
            <span>{isListening ? 'Listening for your voice...' : 'AI is speaking...'}</span>
          </div>
        )}

        {/* Chat Feed */}
        <div className="chat-feed">
          {messages.length === 0 && (
            <div className="hero-state">
              <div className="hero-icon">
                <Bot size={36} />
              </div>
              <h3>Hands-Free Voice AI</h3>
              <p>Tap the mic to start talking. The assistant will respond out loud and automatically listen when finished.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-row ${msg.role}`}>
              <div className="avatar-wrapper">
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className="bubble">{msg.text}</div>
            </div>
          ))}

          {loading && (
            <div className="chat-row assistant">
              <div className="avatar-wrapper">
                <Bot size={16} />
              </div>
              <div className="bubble loading-bubble">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Dock */}
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="input-dock">
          <button 
            type="button" 
            onClick={toggleListening} 
            className={`mic-trigger ${isListening ? 'active' : ''}`}
          >
            {isListening ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : "Message or tap mic to speak..."}
          />

          <button type="submit" className="send-trigger" disabled={loading || !input.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;