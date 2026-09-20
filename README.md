🤖 AI-Powered Conversational Interview Assistant

An AI-powered conversational interview practice application that simulates an interview, asks adaptive questions, processes spoken answers, and provides AI-generated feedback.

🚀 Live Demo

Deployed Application:
https://ai-powered-conversational-interview.onrender.com

✨ Features

AI-powered conversational interview experience

Adaptive interview questions based on candidate responses

Interview topics: Self Introduction, Generative AI, Python, English, HTML, CSS

Voice-based interview using Murf AI

Speech-to-text using AssemblyAI

AI-generated questions and feedback using Google Gemini

Score out of 5

Detailed feedback and areas for improvement

Five-question interview flow

Responsive black/purple interface

Deployed on Render

🛠️ Tech Stack

Frontend

HTML5

CSS3

JavaScript

Tailwind CSS

Font Awesome

Backend

Python

Flask

Flask-CORS

Gunicorn

AI & APIs

Google Gemini

LangChain

LangGraph

Murf AI

AssemblyAI

Deployment

GitHub

Render

🏗️ How It Works

User
  ↓
Frontend (HTML + JavaScript + Tailwind CSS)
  ↓
Flask Backend
  ├── Google Gemini → Interview questions & feedback
  ├── AssemblyAI → Speech-to-text
  └── Murf AI → Text-to-speech

📂 Project Structure

AI-Powered-Conversational-Interview-Assistant/
├── AI-Powered-Conversational-Interview-Assistant-main/
│   ├── app.py
│   ├── index.html
│   ├── index.js
│   └── requirements.txt
├── .gitignore
└── README.md

⚙️ Environment Variables

Create a .env file locally:

GOOGLE_API_KEY=your_google_gemini_api_key
MURF_API_KEY=your_murf_api_key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key

Never commit API keys to GitHub.

Your .gitignore should include:

.env
__pycache__/
*.pyc

For Render, add these values through the service's Environment Variables settings.

💻 Run Locally

1. Clone the repository

git clone https://github.com/Harshavardhan-243/AI-Powered-Conversational-Interview-Assistant.git

2. Enter the project directory

cd AI-Powered-Conversational-Interview-Assistant
cd AI-Powered-Conversational-Interview-Assistant-main

3. Create a virtual environment

Windows:

python -m venv venv
venv\Scripts\activate

4. Install dependencies

pip install -r requirements.txt

5. Add your environment variables

Create .env with:

GOOGLE_API_KEY=your_google_gemini_api_key
MURF_API_KEY=your_murf_api_key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key

6. Run the application

python app.py

For the production server:

gunicorn app:app

🌐 Render Deployment

Build Command

pip install -r requirements.txt

Start Command

gunicorn app:app

Root Directory

AI-Powered-Conversational-Interview-Assistant-main

The API keys are configured through Render Environment Variables.

🔌 API Endpoints

Method

Endpoint

Purpose

GET

/

Serves the interview application

GET

/index.js

Serves frontend JavaScript

POST

/start-interview

Starts an interview

POST

/submit-answer

Processes the candidate's answer

POST

/get-feedback

Generates interview feedback

🎯 Interview Flow

Select Topic
    ↓
Start Interview
    ↓
Gemini Generates Question
    ↓
Murf Speaks Question
    ↓
Candidate Records Answer
    ↓
AssemblyAI Transcribes Answer
    ↓
Gemini Generates Next Question
    ↓
Repeat for 5 Questions
    ↓
Generate Feedback
    ↓
Display Score + Feedback

🔮 Future Improvements

User authentication and interview history

Database storage for interview results

Resume-based personalized interviews

Difficulty levels

Real-time transcript display

Performance analytics

Multi-language interview support

Improved multi-user session management

👨‍💻 Author

Harsha Vardhan
B.Tech – Computer Science Engineering

GitHub:
https://github.com/Harshavardhan-243

⭐ If you find this project useful, consider giving the repository a star!