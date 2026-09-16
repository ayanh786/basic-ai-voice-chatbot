import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

app = Flask(__name__)
CORS(app)  # Allows React frontend to make requests to Flask backend

# Initialize Gemini Client
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

# Configure Flask app logger
logging.basicConfig(level=logging.ERROR)

# In-memory storage for chat histories (Key: session_id, Value: list of message objects)
# For production, replace this with a database (e.g., Redis, SQLite, MongoDB)
chat_sessions = {}

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    session_id = data.get("session_id", "default_session")
    user_message = data.get("message", "")

    if not user_message:
        return jsonify({"error": "Message content is required."}), 400

    # Initialize chat history for session if not exists
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []

    # Format user message for Gemini SDK
    chat_sessions[session_id].append({
        "role": "user",
        "parts": [{"text": user_message}]
    })

    try:
        model_name = 'gemini-3.5-flash-lite'
        
        response = client.models.generate_content(
            model=model_name,
            contents=chat_sessions[session_id],
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are a friendly, spoken-voice AI assistant. "
                    "Keep every response strictly between 15 and 35 words long, consisting of 2 short, complete sentences. "
                    "Avoid bullet points, bolding, or Markdown formatting. "
                    "IMPORTANT: If the user says goodbye, indicates the chat is over, or says goodnight, "
                    "say a polite farewell and append the exact tag '[END_CONVERSATION]' at the very end of your response."
                ),
                max_output_tokens=500
            )
        )

        ai_response_text = response.text

        # Append assistant response back to chat history
        chat_sessions[session_id].append({
            "role": "model",
            "parts": [{"text": ai_response_text}]
        })

        return jsonify({
            "response": ai_response_text,
            "session_id": session_id
        })

    except Exception as e:
        # Log the error details directly in your Flask terminal logs
        app.logger.error(f"Gemini API Error ({model_name}): {str(e)}", exc_info=True)
        
        # Clean up history if message failed
        if session_id in chat_sessions and chat_sessions[session_id]:
            chat_sessions[session_id].pop()
            
        return jsonify({"error": "Internal Server Error"}), 500

@app.route('/api/clear', methods=['POST'])
def clear_history():
    data = request.json
    session_id = data.get("session_id", "default_session")
    if session_id in chat_sessions:
        chat_sessions[session_id] = []
    return jsonify({"message": "Conversation history cleared."})


if __name__ == '__main__':
    app.run(port=5000, debug=True)