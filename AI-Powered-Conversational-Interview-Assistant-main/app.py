from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langgraph.checkpoint.memory import InMemorySaver
from langchain.agents import create_agent
import assemblyai as aai
import os
import base64
import requests
import tempfile
import json

load_dotenv()

# =========================
# API KEYS
# =========================

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MURF_API_KEY = os.getenv("MURF_API_KEY")
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

aai.settings.api_key = ASSEMBLYAI_API_KEY


# =========================
# LANGCHAIN / LANGGRAPH
# =========================

checkpointer = InMemorySaver()

model = init_chat_model(
    "google_genai:gemini-2.5-flash",
    api_key=GOOGLE_API_KEY
)

agent = create_agent(
    model=model,
    tools=[],
    checkpointer=checkpointer
)


# =========================
# INTERVIEW STATE
# =========================

question_count = 0
current_subject = ""
thread_id = "interview_session"


# =========================
# INTERVIEW PROMPT
# =========================

INTERVIEW_PROMPT = """You are Natalie, a friendly and conversational interviewer conducting a natural {subject} interview.

IMPORTANT GUIDELINES:
1. Ask exactly 5 questions total throughout the interview
2. Keep questions SHORT and CRISP (1-2 sentences maximum)
3. ALWAYS reference what the candidate ACTUALLY said in their previous answer - do NOT make up or assume their answers
4. Show genuine interest with brief acknowledgments based on their REAL responses
5. Adapt questions based on their ACTUAL responses - go deeper if they're strong, adjust if uncertain
6. Be warm and conversational but CONCISE
7. No lengthy explanations - just ask clear, direct questions

CRITICAL: Read the conversation history carefully. Only acknowledge what the candidate truly said, not what you think they might have said.

Keep it short, conversational, and adaptive!"""


# =========================
# FEEDBACK PROMPT
# =========================

FEEDBACK_PROMPT = """Based on our complete interview conversation, provide detailed feedback as JSON only:
{{
    "subject": "<topic>",
    "candidate_score": <1-5>,
    "feedback": "<detailed strengths with specific examples from their ACTUAL answers>",
    "areas_of_improvement": "<constructive suggestions based on gaps you noticed>"
}}
Be specific - reference ACTUAL things they said during the interview."""


# =========================
# FLASK APP
# =========================

app = Flask(__name__)

CORS(
    app,
    expose_headers=[
        "X-Question-Number",
        "X-Interview-Complete"
    ]
)


# =========================
# SERVE FRONTEND
# =========================

@app.route("/")
def home():
    return send_from_directory(
        os.path.dirname(os.path.abspath(__file__)),
        "index.html"
    )


@app.route("/index.js")
def javascript():
    return send_from_directory(
        os.path.dirname(os.path.abspath(__file__)),
        "index.js",
        mimetype="application/javascript"
    )


# =========================
# MURF TEXT TO SPEECH
# =========================

def stream_audio(text):
    BASE_URL = "https://global.api.murf.ai/v1/speech/stream"

    payload = {
        "text": text,
        "voiceId": "en-US-natalie",
        "model": "FALCON",
        "multiNativeLocale": "en-US",
        "sampleRate": 24000,
        "format": "MP3"
    }

    headers = {
        "Content-Type": "application/json",
        "api-key": MURF_API_KEY
    }

    response = requests.post(
        BASE_URL,
        headers=headers,
        data=json.dumps(payload),
        stream=True
    )

    response.raise_for_status()

    for chunk in response.iter_content(chunk_size=4096):
        if chunk:
            yield base64.b64encode(chunk).decode("utf-8") + "\n"


# =========================
# START INTERVIEW
# =========================

@app.route("/start-interview", methods=["POST"])
def start_interview():

    global question_count
    global current_subject
    global checkpointer
    global agent

    # Safer JSON handling
    data = request.get_json(silent=True) or {}

    current_subject = data.get(
        "subject",
        "Python"
    )

    question_count = 1

    # Create a fresh interview memory
    checkpointer = InMemorySaver()

    agent = create_agent(
        model=model,
        tools=[],
        checkpointer=checkpointer
    )

    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    formatted_prompt = INTERVIEW_PROMPT.format(
        subject=current_subject
    )

    response = agent.invoke(
        {
            "messages": [
                {
                    "role": "system",
                    "content": formatted_prompt
                },
                {
                    "role": "user",
                    "content": (
                        f"Start the interview with a warm greeting "
                        f"and ask the first question about "
                        f"{current_subject}. "
                        f"Keep it SHORT (1-2 sentences)."
                    )
                }
            ]
        },
        config=config
    )

    question = response["messages"][-1].content

    print(
        f"\n[Question {question_count}] {question}"
    )

    return Response(
        stream_audio(question),
        mimetype="text/plain"
    )


# =========================
# SPEECH TO TEXT
# =========================

def speech_to_text(audio_path):

    transcriber = aai.Transcriber()

    config = aai.TranscriptionConfig(
        speech_models=[
            "universal-3-pro",
            "universal-2"
        ],
        language_detection=True,
        speaker_labels=True
    )

    transcript = transcriber.transcribe(
        audio_path,
        config=config
    )

    return (
        transcript.text
        if transcript.text
        else ""
    )


# =========================
# SUBMIT ANSWER
# =========================

@app.route("/submit-answer", methods=["POST"])
def submit_answer():

    global question_count

    # Check whether audio exists
    if "audio" not in request.files:
        return jsonify({
            "success": False,
            "error": "No audio file received."
        }), 400

    audio_file = request.files["audio"]

    temp_path = tempfile.NamedTemporaryFile(
        delete=False,
        suffix=".webm"
    ).name

    try:

        audio_file.save(temp_path)

        answer = speech_to_text(
            temp_path
        )

    except Exception as error:

        print(
            f"Speech-to-text error: {error}"
        )

        return jsonify({
            "success": False,
            "error": "Failed to convert speech to text."
        }), 500

    finally:

        if os.path.exists(temp_path):
            os.unlink(temp_path)

    # If AssemblyAI returns empty text
    if not answer or answer.strip() == "":
        answer = "[Candidate provided a verbal response]"

    print(
        f"[Answer {question_count}] {answer}"
    )

    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    # Add candidate answer to conversation
    agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": answer
                }
            ]
        },
        config=config
    )

    # =========================
    # INTERVIEW COMPLETE
    # =========================

    if question_count >= 5:

        response = agent.invoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            "That was the 5th question. "
                            "Briefly acknowledge their ACTUAL answer "
                            "and let them know the interview is complete. "
                            "Keep it SHORT."
                        )
                    }
                ]
            },
            config=config
        )

        closing_message = response[
            "messages"
        ][-1].content

        print(
            f"\n[Closing] {closing_message}"
        )

        return Response(
            stream_audio(closing_message),
            mimetype="text/plain",
            headers={
                "X-Interview-Complete": "true"
            }
        )

    # =========================
    # NEXT QUESTION
    # =========================

    question_count += 1

    prompt = f"""The candidate just answered question {question_count - 1}.

Look at their ACTUAL answer above. Do NOT assume or make up what they said.

Now ask question {question_count} of 5:

1. Briefly acknowledge what they ACTUALLY said (1 sentence)
2. Ask your next question that builds on their REAL response (1-2 sentences)
3. If they said "I don't know" or gave a wrong answer, acknowledge that and ask something simpler
4. Keep the TOTAL response under 3 sentences

Be conversational but CONCISE.
Only reference what they truly said."""

    response = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        },
        config=config
    )

    question = response[
        "messages"
    ][-1].content

    print(
        f"\n[Question {question_count}] {question}"
    )

    return Response(
        stream_audio(question),
        mimetype="text/plain",
        headers={
            "X-Question-Number": str(question_count)
        }
    )


# =========================
# GET FEEDBACK
# =========================

@app.route("/get-feedback", methods=["POST"])
def get_feedback():

    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    response = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": (
                        f"{FEEDBACK_PROMPT}\n\n"
                        f"Review our complete "
                        f"{current_subject} interview conversation "
                        f"and provide detailed feedback."
                    )
                }
            ]
        },
        config=config
    )

    text = response[
        "messages"
    ][-1].content

    print(
        f"\n[Feedback Generated]\n{text}\n"
    )

    cleaned = text.strip()

    # Remove Markdown code fences if Gemini adds them
    if "```" in cleaned:

        cleaned = (
            cleaned
            .split("```")[1]
            .replace("json", "")
            .strip()
        )

    # =========================
    # SAFE JSON PARSING
    # =========================

    try:

        feedback = json.loads(
            cleaned
        )

    except json.JSONDecodeError as error:

        print(
            f"Feedback JSON parse error: {error}"
        )

        print(
            f"Raw feedback response: {text}"
        )

        return jsonify({
            "success": False,
            "error": "The AI returned invalid feedback JSON."
        }), 500

    return jsonify({
        "success": True,
        "feedback": feedback
    })


# =========================
# IMPORTANT:
# NO app.run() HERE
# =========================