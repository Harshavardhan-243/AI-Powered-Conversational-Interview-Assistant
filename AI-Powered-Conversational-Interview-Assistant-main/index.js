// =========================================================
// GLOBAL STATE
// =========================================================

let mediaRecorder = null;
let recordingChunks = [];
let recordedBlob = null;

let currentSubject = null;
let isSpeaking = false;
let currentAudio = null;


// =========================================================
// DOM ELEMENTS
// =========================================================

const welcomeState = document.getElementById("welcomeState");
const interviewState = document.getElementById("interviewState");

const subjectBtns = document.querySelectorAll(".subject-btn");

const subjectBadge = document.getElementById("subjectBadge");
const subjectIcon = document.getElementById("subjectIcon");
const questionNum = document.getElementById("questionNum");

const speakingBubble = document.getElementById("speakingBubble");

const startInterviewBtn =
    document.getElementById("startInterviewBtn");

const recordBtn =
    document.getElementById("recordBtn");

const micIcon =
    document.getElementById("micIcon");

const stopIcon =
    document.getElementById("stopIcon");

const recordingStatus =
    document.getElementById("recordingStatus");

const submitBtn =
    document.getElementById("submitBtn");

const endInterviewBtn =
    document.getElementById("endInterviewBtn");

const feedbackSection =
    document.getElementById("feedbackSection");

const getFeedbackArea =
    document.getElementById("getFeedbackArea");

const getFeedbackBtn =
    document.getElementById("getFeedbackBtn");

const feedbackContent =
    document.getElementById("feedbackContent");

const feedbackSubject =
    document.getElementById("feedbackSubject");

const scoreCircle =
    document.getElementById("scoreCircle");

const scoreValue =
    document.getElementById("scoreValue");

const feedbackText =
    document.getElementById("feedbackText");

const improvementText =
    document.getElementById("improvementText");

const newInterviewBtn =
    document.getElementById("newInterviewBtn");


// =========================================================
// SUBJECT ICONS
// =========================================================

const iconMap = {
    "Self Introduction": "fas fa-user text-blue-400",
    "Generative AI": "fas fa-brain text-purple-400",
    "Python": "fab fa-python text-yellow-400",
    "English": "fas fa-language text-green-400",
    "HTML": "fab fa-html5 text-orange-400",
    "CSS": "fab fa-css3-alt text-blue-400"
};


// =========================================================
// API URLs
// =========================================================

const startInterviewApiUrl = "/start-interview";
const submitAnswerApiUrl = "/submit-answer";
const getFeedbackApiUrl = "/get-feedback";


// =========================================================
// UI FUNCTIONS
// =========================================================

function showInterviewPanel(subject) {

    currentSubject = subject;

    subjectBtns.forEach((btn) => {
        btn.classList.toggle(
            "active",
            btn.dataset.subject === subject
        );
    });

    welcomeState.classList.add("hidden");
    interviewState.classList.remove("hidden");

    feedbackSection.classList.add("hidden");

    subjectBadge.textContent = subject;

    subjectIcon.className =
        (iconMap[subject] || "fas fa-question") +
        " text-2xl";

    questionNum.textContent = "1";

    speakingBubble.classList.add("hidden");

    startInterviewBtn.classList.remove("hidden");

    recordBtn.classList.add("hidden");
    recordBtn.disabled = true;

    submitBtn.classList.add("hidden");
    submitBtn.disabled = true;

    endInterviewBtn.disabled = true;

    recordingStatus.textContent =
        "Click Start Interview to begin";
}


function updateQuestionNumber(number) {
    questionNum.textContent = number;
}


function showSpeakingBubble() {
    speakingBubble.classList.remove("hidden");
}


function hideSpeakingBubble() {
    speakingBubble.classList.add("hidden");
}


function enableRecording() {

    if (isSpeaking) {
        return;
    }

    recordBtn.disabled = false;
    endInterviewBtn.disabled = false;

    recordingStatus.textContent =
        "Click to record";
}


function disableRecording() {

    recordBtn.disabled = true;
    submitBtn.disabled = true;
}


function showFeedbackSection() {

    feedbackSection.classList.remove("hidden");

    getFeedbackArea.classList.remove("hidden");

    feedbackContent.classList.add("hidden");

    endInterviewBtn.disabled = true;

    disableRecording();

    recordingStatus.textContent =
        "Interview ended";

    hideSpeakingBubble();
}


function displayFeedback(data) {

    feedbackSubject.textContent =
        data.subject || currentSubject || "Interview";

    const score =
        Number(data.candidate_score) || 0;

    scoreValue.textContent = score;

    // SVG circle circumference:
    // 2 × PI × 40 ≈ 251.2

    const circumference = 251.2;

    const offset =
        circumference -
        (Math.min(score, 5) / 5) *
        circumference;

    scoreCircle.style.strokeDashoffset =
        offset;

    feedbackText.textContent =
        data.feedback ||
        "No feedback available.";

    improvementText.textContent =
        data.areas_of_improvement ||
        "No suggestions available.";

    getFeedbackArea.classList.add("hidden");

    feedbackContent.classList.remove("hidden");
}


function resetToWelcome() {

    currentSubject = null;

    isSpeaking = false;

    if (mediaRecorder &&
        mediaRecorder.state !== "inactive") {

        mediaRecorder.stop();
    }

    mediaRecorder = null;

    recordingChunks = [];

    recordedBlob = null;

    if (currentAudio) {

        currentAudio.pause();

        currentAudio.src = "";

        currentAudio = null;
    }

    subjectBtns.forEach((btn) => {
        btn.classList.remove("active");
    });

    welcomeState.classList.remove("hidden");

    interviewState.classList.add("hidden");

    feedbackSection.classList.add("hidden");

    recordBtn.classList.remove(
        "bg-red-500",
        "text-white",
        "recording-active"
    );

    recordBtn.classList.add(
        "bg-zinc-800/80",
        "text-gray-400"
    );

    micIcon.classList.remove("hidden");

    stopIcon.classList.add("hidden");

    startInterviewBtn.classList.remove("hidden");

    recordBtn.classList.add("hidden");

    submitBtn.classList.add("hidden");

    submitBtn.disabled = true;

    endInterviewBtn.disabled = true;

    speakingBubble.classList.add("hidden");

    scoreCircle.style.strokeDashoffset = 251.2;

    scoreValue.textContent = "0";

    getFeedbackBtn.textContent =
        "Get Feedback";

    getFeedbackBtn.disabled = false;

    recordingStatus.textContent =
        "Click Start Interview to begin";
}


// =========================================================
// AUDIO PLAYBACK
// =========================================================

// Instead of using MediaSource directly,
// collect the streamed base64 audio and play it
// after the complete response is received.
//
// This is much more reliable on Render/browser.

async function playAudioStream(response, onComplete) {

    try {

        showSpeakingBubble();

        isSpeaking = true;

        recordBtn.disabled = true;

        recordingStatus.textContent =
            "Natalie is speaking...";

        if (currentAudio) {

            currentAudio.pause();

            currentAudio.src = "";

            currentAudio = null;
        }

        const reader =
            response.body.getReader();

        const decoder =
            new TextDecoder();

        let textBuffer = "";

        const audioChunks = [];

        while (true) {

            const {
                done,
                value
            } = await reader.read();

            if (done) {
                break;
            }

            textBuffer +=
                decoder.decode(
                    value,
                    { stream: true }
                );

            const lines =
                textBuffer.split("\n");

            textBuffer =
                lines.pop() || "";

            for (const line of lines) {

                if (!line.trim()) {
                    continue;
                }

                try {

                    const binary =
                        atob(line.trim());

                    const bytes =
                        new Uint8Array(
                            binary.length
                        );

                    for (
                        let i = 0;
                        i < binary.length;
                        i++
                    ) {

                        bytes[i] =
                            binary.charCodeAt(i);
                    }

                    audioChunks.push(bytes);

                } catch (error) {

                    console.error(
                        "Audio decode error:",
                        error
                    );
                }
            }
        }

        // Process final incomplete line
        if (textBuffer.trim()) {

            try {

                const binary =
                    atob(textBuffer.trim());

                const bytes =
                    new Uint8Array(
                        binary.length
                    );

                for (
                    let i = 0;
                    i < binary.length;
                    i++
                ) {

                    bytes[i] =
                        binary.charCodeAt(i);
                }

                audioChunks.push(bytes);

            } catch (error) {

                console.error(
                    "Final audio decode error:",
                    error
                );
            }
        }

        if (audioChunks.length === 0) {

            throw new Error(
                "No audio data received"
            );
        }

        const audioBlob =
            new Blob(
                audioChunks,
                {
                    type: "audio/mpeg"
                }
            );

        const audioUrl =
            URL.createObjectURL(audioBlob);

        currentAudio =
            new Audio(audioUrl);

        currentAudio.onended = () => {

            isSpeaking = false;

            hideSpeakingBubble();

            enableRecording();

            URL.revokeObjectURL(audioUrl);

            if (onComplete) {
                onComplete();
            }
        };

        currentAudio.onerror = (error) => {

            console.error(
                "Audio playback error:",
                error
            );

            isSpeaking = false;

            hideSpeakingBubble();

            enableRecording();

            URL.revokeObjectURL(audioUrl);

            if (onComplete) {
                onComplete();
            }
        };

        await currentAudio.play();

    } catch (error) {

        console.error(
            "Audio stream error:",
            error
        );

        isSpeaking = false;

        hideSpeakingBubble();

        enableRecording();

        if (onComplete) {
            onComplete();
        }
    }
}


// =========================================================
// RECORDING
// =========================================================

async function startRecording() {

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        let mimeType =
            "audio/webm;codecs=opus";

        if (
            !MediaRecorder.isTypeSupported(
                mimeType
            )
        ) {

            mimeType =
                "audio/webm";
        }

        mediaRecorder =
            new MediaRecorder(
                stream,
                { mimeType }
            );

        recordingChunks = [];

        recordedBlob = null;

        mediaRecorder.ondataavailable =
            (event) => {

                if (event.data.size > 0) {

                    recordingChunks.push(
                        event.data
                    );
                }
            };

        mediaRecorder.onstop = () => {

            recordedBlob =
                new Blob(
                    recordingChunks,
                    {
                        type: "audio/webm"
                    }
                );

            stream
                .getTracks()
                .forEach(
                    track => track.stop()
                );
        };

        mediaRecorder.start();

        recordBtn.classList.remove(
            "bg-zinc-800/80",
            "text-gray-400"
        );

        recordBtn.classList.add(
            "bg-red-500",
            "text-white",
            "recording-active"
        );

        micIcon.classList.add("hidden");

        stopIcon.classList.remove("hidden");

        recordingStatus.textContent =
            "Recording...";

        submitBtn.classList.add("hidden");

        submitBtn.disabled = true;

        endInterviewBtn.disabled = true;

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

        recordingStatus.textContent =
            "Microphone permission denied";

        alert(
            "Please allow microphone access in your browser."
        );
    }
}


function stopRecording() {

    if (
        !mediaRecorder ||
        mediaRecorder.state === "inactive"
    ) {
        return;
    }

    mediaRecorder.stop();

    recordBtn.classList.remove(
        "bg-red-500",
        "text-white",
        "recording-active"
    );

    recordBtn.classList.add(
        "bg-zinc-800/80",
        "text-gray-400"
    );

    micIcon.classList.remove("hidden");

    stopIcon.classList.add("hidden");

    recordingStatus.textContent =
        "Recording complete";

    submitBtn.classList.remove("hidden");

    submitBtn.disabled = false;

    endInterviewBtn.disabled = false;
}


// =========================================================
// START INTERVIEW
// =========================================================

async function startInterview() {

    if (!currentSubject) {

        alert(
            "Please select an interview topic first."
        );

        return;
    }

    startInterviewBtn.disabled = true;

    startInterviewBtn.classList.add("hidden");

    recordBtn.classList.remove("hidden");

    recordingStatus.textContent =
        "Connecting to AI interviewer...";

    try {

        const response =
            await fetch(
                startInterviewApiUrl,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        subject:
                            currentSubject
                    })
                }
            );

        if (!response.ok) {

            throw new Error(
                `Server error: ${response.status}`
            );
        }

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            contentType.includes(
                "text/plain"
            )
        ) {

            await playAudioStream(
                response,
                () => {
                    endInterviewBtn.disabled =
                        false;
                }
            );

        } else {

            const data =
                await response.json();

            console.log(
                "Start interview response:",
                data
            );

            enableRecording();
        }

    } catch (error) {

        console.error(
            "Start interview error:",
            error
        );

        recordingStatus.textContent =
            "Backend connection failed";

        hideSpeakingBubble();

        recordBtn.classList.add("hidden");

        startInterviewBtn.classList.remove("hidden");

        startInterviewBtn.disabled = false;
    }
}


// =========================================================
// SUBMIT ANSWER
// =========================================================

async function submitAnswer() {

    if (!recordedBlob) {

        alert(
            "Please record an answer first."
        );

        return;
    }

    disableRecording();

    recordingStatus.textContent =
        "Submitting your answer...";

    const formData =
        new FormData();

    formData.append(
        "audio",
        recordedBlob,
        "answer.webm"
    );

    try {

        const response =
            await fetch(
                submitAnswerApiUrl,
                {
                    method: "POST",
                    body: formData
                }
            );

        if (!response.ok) {

            throw new Error(
                `Server error: ${response.status}`
            );
        }

        const isComplete =
            response.headers.get(
                "X-Interview-Complete"
            ) === "true";

        const questionNumber =
            response.headers.get(
                "X-Question-Number"
            );

        if (questionNumber) {

            updateQuestionNumber(
                questionNumber
            );
        }

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        recordedBlob = null;

        recordingChunks = [];

        if (
            contentType.includes(
                "text/plain"
            )
        ) {

            await playAudioStream(
                response,
                () => {

                    if (isComplete) {

                        showFeedbackSection();

                    } else {

                        enableRecording();

                        endInterviewBtn.disabled =
                            false;
                    }
                }
            );

        } else {

            const data =
                await response.json();

            console.log(
                "Submit response:",
                data
            );

            if (isComplete) {

                showFeedbackSection();

            } else {

                enableRecording();

                endInterviewBtn.disabled =
                    false;
            }
        }

    } catch (error) {

        console.error(
            "Submit answer error:",
            error
        );

        recordingStatus.textContent =
            "Failed to submit answer";

        hideSpeakingBubble();

        enableRecording();
    }
}


// =========================================================
// END INTERVIEW
// =========================================================

async function endInterview() {

    const confirmed =
        confirm(
            "End interview and get feedback?"
        );

    if (!confirmed) {
        return;
    }

    disableRecording();

    endInterviewBtn.disabled = true;

    recordingStatus.textContent =
        "Generating feedback...";

    await getFeedback();
}


// =========================================================
// GET FEEDBACK
// =========================================================

async function getFeedback() {

    showFeedbackSection();

    getFeedbackBtn.textContent =
        "Generating...";

    getFeedbackBtn.disabled = true;

    try {

        const response =
            await fetch(
                getFeedbackApiUrl,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({})
                }
            );

        if (!response.ok) {

            throw new Error(
                `Server error: ${response.status}`
            );
        }

        const data =
            await response.json();

        if (data.success) {

            displayFeedback(
                data.feedback
            );

        } else {

            throw new Error(
                "Feedback generation failed"
            );
        }

    } catch (error) {

        console.error(
            "Feedback error:",
            error
        );

        getFeedbackBtn.textContent =
            "Error - Retry";

        getFeedbackBtn.disabled =
            false;
    }
}


// =========================================================
// EVENT LISTENERS
// =========================================================

function initializeApp() {

    console.log(
        "AI Interview Assistant initialized"
    );

    console.log(
        "Subject buttons:",
        subjectBtns.length
    );

    // Topic buttons

    subjectBtns.forEach((btn) => {

        btn.addEventListener(
            "click",
            () => {

                console.log(
                    "Selected topic:",
                    btn.dataset.subject
                );

                if (
                    currentSubject ===
                    btn.dataset.subject
                ) {
                    return;
                }

                resetToWelcome();

                showInterviewPanel(
                    btn.dataset.subject
                );
            }
        );
    });


    // Start interview

    startInterviewBtn.addEventListener(
        "click",
        startInterview
    );


    // Record / Stop

    recordBtn.addEventListener(
        "click",
        () => {

            if (
                isSpeaking ||
                recordBtn.disabled
            ) {
                return;
            }

            if (
                !mediaRecorder ||
                mediaRecorder.state === "inactive"
            ) {

                startRecording();

            } else {

                stopRecording();
            }
        }
    );


    // Submit

    submitBtn.addEventListener(
        "click",
        submitAnswer
    );


    // End interview

    endInterviewBtn.addEventListener(
        "click",
        endInterview
    );


    // Get feedback

    getFeedbackBtn.addEventListener(
        "click",
        getFeedback
    );


    // New interview

    newInterviewBtn.addEventListener(
        "click",
        resetToWelcome
    );
}


// =========================================================
// START APP AFTER HTML IS READY
// =========================================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

} else {

    initializeApp();
}