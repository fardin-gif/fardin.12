import { dbService } from './firebase.js';

// Game state
let quizData = null;
let currentQuestionIndex = 0;
let balance = 20;
let studentName = '';
let timer = null;
let timeLeft = 0;
let canAnswer = true;
let answerLock = false;
let answers = [];

// DOM Elements
const nameEntry = document.getElementById('nameEntry');
const quizScreen = document.getElementById('quizScreen');
const studentNameInput = document.getElementById('studentName');
const startQuizBtn = document.getElementById('startQuizBtn');
const balanceDisplay = document.getElementById('balanceDisplay');
const balanceValue = document.getElementById('balanceValue');
const progressBar = document.getElementById('progressBar');
const questionCount = document.getElementById('questionCount');
const questionNumber = document.getElementById('questionNumber');
const subjectBadge = document.getElementById('subjectBadge');
const timerBox = document.getElementById('timerBox');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const nextBtn = document.getElementById('nextBtn');
const questionCard = document.getElementById('questionCard');

// ================== DEVICE‑BASED STORAGE ==================
function getStorageKey() {
    // Fixed per quiz – no student name involved
    return `quiz_${quizData.id}_progress`;
}

function saveProgress() {
    if (!quizData || !studentName) return;
    const progress = {
        quizId: quizData.id,
        studentName: studentName,
        currentQuestionIndex: currentQuestionIndex,
        balance: balance,
        answers: answers,
        timestamp: Date.now()
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(progress));
}

function loadProgress() {
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse saved progress', e);
        }
    }
    return null;
}

function clearProgress() {
    localStorage.removeItem(getStorageKey());
}
// ===========================================================

// Initialize quiz
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    
    if (!quizId) {
        showError('No quiz ID provided. Please use the link from your teacher.');
        return;
    }
    
    try {
        showLoading(true);
        
        quizData = await dbService.getQuiz(quizId);
        if (!quizData) {
            showError('Quiz not found. Please check your link.');
            return;
        }
        
        // Check for saved progress on this device
        const saved = loadProgress();
        if (saved) {
            // Restore saved state
            studentName = saved.studentName;
            balance = saved.balance;
            answers = saved.answers;
            
            // --- IMPROVED RESUME LOGIC ---
            // If the current question (saved.currentQuestionIndex) has already been answered,
            // we move to the next unanswered question.
            // We know a question is answered if the answers array length is greater than the current index.
            if (answers.length > saved.currentQuestionIndex) {
                // The student had already answered the question at saved.currentQuestionIndex
                // and the "Next" button was visible. Resume at the next question.
                currentQuestionIndex = answers.length; // this is the next unanswered index
            } else {
                // No answer recorded for the current question → resume at that question.
                currentQuestionIndex = saved.currentQuestionIndex;
            }
            
            // Safety: if the computed index is out of bounds (e.g., quiz was edited), reset.
            if (currentQuestionIndex >= quizData.questions.length) {
                currentQuestionIndex = 0;
                balance = 20;
                answers = [];
                clearProgress();
            } else {
                // Skip name entry and go straight to quiz
                nameEntry.classList.add('hidden');
                quizScreen.classList.remove('hidden');
                updateBalance();
                loadQuestion();
            }
        } else {
            // No saved progress – show name entry
            studentNameInput.addEventListener('input', () => {
                startQuizBtn.disabled = !studentNameInput.value.trim();
            });
            startQuizBtn.addEventListener('click', startQuiz);
        }
        
        // Next button listener (always needed)
        nextBtn.addEventListener('click', moveToNextQuestion);
        
    } catch (error) {
        console.error('Error loading quiz:', error);
        showError('Error loading quiz. Please try again.');
    } finally {
        showLoading(false);
    }
});

// Start quiz (only called when no saved progress)
function startQuiz() {
    studentName = studentNameInput.value.trim();
    if (!studentName) return;
    
    // Fresh start
    currentQuestionIndex = 0;
    balance = 20;
    answers = [];
    
    nameEntry.classList.add('hidden');
    quizScreen.classList.remove('hidden');
    
    // Save initial progress
    saveProgress();
    
    updateBalance();
    loadQuestion();
}

// Load current question
function loadQuestion() {
    // Safety: if index out of bounds (should not happen), reset
    if (currentQuestionIndex >= quizData.questions.length) {
        currentQuestionIndex = 0;
        balance = 20;
        answers = [];
        clearProgress();
    }

    const question = quizData.questions[currentQuestionIndex];
    answerLock = false;
    canAnswer = true;
    
    // Update UI
    questionNumber.textContent = `Q${currentQuestionIndex + 1}`;
    subjectBadge.textContent = question.label;
    questionText.textContent = question.questionText;
    
    // Update progress
    const progress = ((currentQuestionIndex + 1) / quizData.questions.length) * 100;
    progressBar.style.width = `${progress}%`;
    questionCount.textContent = `${currentQuestionIndex + 1}/${quizData.questions.length}`;
    
    // Create options
    createOptions(question.options);
    
    // Reset timer
    resetTimer(question.timeLimit);
    
    // Hide next button (it will appear after answering)
    nextBtn.classList.add('hidden');
    
    // Remove any leftover animation classes
    timerBox.classList.remove('timeout-animation');
    balanceDisplay.classList.remove('glow');
}

// Create option buttons
function createOptions(options) {
    optionsContainer.innerHTML = '';
    options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'option';
        button.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
        button.dataset.index = index;
        button.addEventListener('click', (e) => selectOption(e, index));
        optionsContainer.appendChild(button);
    });
}

// Select option with animations
function selectOption(e, selectedIndex) {
    if (!canAnswer || answerLock) return;
    
    const question = quizData.questions[currentQuestionIndex];
    const isCorrect = selectedIndex === question.correctIndex;
    
    // Lock answers
    canAnswer = false;
    answerLock = true;
    clearInterval(timer);
    
    // Disable all options
    document.querySelectorAll('.option').forEach(opt => {
        opt.disabled = true;
    });
    
    if (isCorrect) {
        // CORRECT ANSWER
        balance += 5;
        confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
        });
        e.currentTarget.classList.add('correct-feedback');
        document.querySelectorAll('.option')[question.correctIndex].classList.add('correct-feedback');
        balanceDisplay.classList.add('glow');
        setTimeout(() => balanceDisplay.classList.remove('glow'), 400);
    } else {
        // WRONG ANSWER
        balance = Math.max(20, balance - 2);
        e.currentTarget.classList.add('wrong-feedback');
        document.querySelectorAll('.option')[question.correctIndex].classList.add('correct-feedback');
        document.body.style.backgroundColor = '#ffcccb';
        setTimeout(() => document.body.style.backgroundColor = '', 200);
    }
    
    animateBalanceChange(balance);
    
    // Save answer
    answers.push({
        questionNumber: currentQuestionIndex + 1,
        selectedIndex,
        isCorrect,
        timeLeft: timeLeft
    });
    
    // Save progress after answer
    saveProgress();
    
    // Show next button
    nextBtn.classList.remove('hidden');
}

// Timer functions
function resetTimer(seconds) {
    timeLeft = seconds;
    timerBox.textContent = `${timeLeft}s`;
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        timerBox.textContent = `${timeLeft}s`;
        if (timeLeft <= 5 && timeLeft > 0) {
            timerBox.classList.add('timeout-animation');
        }
        if (timeLeft <= 0) {
            handleTimeout();
        }
    }, 1000);
}

// Handle timeout with animation
function handleTimeout() {
    if (answerLock) return;
    answerLock = true;
    canAnswer = false;
    clearInterval(timer);
    
    // Disable options
    document.querySelectorAll('.option').forEach(opt => {
        opt.disabled = true;
    });
    
    timerBox.classList.add('timeout-animation');
    
    // Save answer (no change in balance)
    answers.push({
        questionNumber: currentQuestionIndex + 1,
        selectedIndex: -1,
        isCorrect: false,
        timeLeft: 0
    });
    
    // Save progress after timeout
    saveProgress();
    
    // Show next button
    nextBtn.classList.remove('hidden');
}

// Move to next question
function moveToNextQuestion() {
    currentQuestionIndex++;
    
    if (currentQuestionIndex < quizData.questions.length) {
        loadQuestion();
    } else {
        endQuiz();
    }
}

// End quiz and save results
async function endQuiz() {
    try {
        showLoading(true);
        
        // Save to localStorage for result page (fallback)
        localStorage.setItem('eidiFinal', balance.toString());
        localStorage.setItem('student', studentName);
        
        // Save attempt to Firestore
        await dbService.saveAttempt({
            quizId: quizData.id,
            studentName: studentName,
            finalBalance: balance,
            answers: answers,
            totalQuestions: quizData.questions.length,
            correctAnswers: answers.filter(a => a.isCorrect).length
        });
        
        // Clear saved progress after successful completion
        clearProgress();
        
        // Redirect to result page
        window.location.href = `eidi.html?id=${quizData.id}&name=${encodeURIComponent(studentName)}&score=${balance}`;
        
    } catch (error) {
        console.error('Error saving attempt:', error);
        // Still redirect, but keep progress (so student can retry later)
        window.location.href = `eidi.html?id=${quizData.id}&name=${encodeURIComponent(studentName)}&score=${balance}`;
    } finally {
        showLoading(false);
    }
}

// Helper functions
function updateBalance() {
    balanceValue.textContent = balance;
}

function animateBalanceChange(newValue) {
    balanceValue.textContent = newValue;
    balanceValue.style.animation = 'balancePop 0.3s ease-out';
    setTimeout(() => {
        balanceValue.style.animation = '';
    }, 300);
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 20px;
        box-shadow: 0 0 50px rgba(0,0,0,0.5);
        text-align: center;
        z-index: 2000;
    `;
    errorDiv.innerHTML = `
        <h2>😕 Oops!</h2>
        <p>${message}</p>
        <button onclick="location.reload()" class="glow-button">Try Again</button>
    `;
    document.body.appendChild(errorDiv);
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        if (show) spinner.classList.remove('hidden');
        else spinner.classList.add('hidden');
    }
}

// Instruction Modal Handler (unchanged)
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('instructionModal');
    const continueBtn = document.getElementById('continueToQuiz');
    const nameInput = document.getElementById('studentName');
    
    if (modal) modal.style.display = 'flex';
    
    if (continueBtn) {
        continueBtn.addEventListener('click', function() {
            modal.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                modal.style.display = 'none';
                if (nameInput) nameInput.focus();
            }, 280);
        });
    }
    
    const style = document.createElement('style');
    style.textContent = `@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }`;
    document.head.appendChild(style);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) continueBtn.click();
    });
});
