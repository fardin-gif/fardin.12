// quiz.js (updated)
import { dbService } from './firebase.js';

// Game state
let quizData = null;
let currentQuestionIndex = 0;
let balance = 20;
let studentName = '';
let studentPhone = '';      // store full phone number including +88
let timer = null;
let timeLeft = 0;
let canAnswer = true;
let answerLock = false;
let answers = [];

// DOM Elements
const nameEntry = document.getElementById('nameEntry');
const quizScreen = document.getElementById('quizScreen');
const studentNameInput = document.getElementById('studentName');
const studentPhoneInput = document.getElementById('studentPhone');
const phoneError = document.getElementById('phoneError');
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
    return `quiz_${quizData.id}_progress`;
}

function saveProgress() {
    if (!quizData || !studentName) return;
    const progress = {
        quizId: quizData.id,
        studentName: studentName,
        studentPhone: studentPhone,
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

// Phone validation: expects 11 digits starting with "01"
function isValidPhone(phoneDigits) {
    return /^01\d{9}$/.test(phoneDigits);
}

// Update start button state based on name and phone
function updateStartButtonState() {
    const nameValid = studentNameInput.value.trim().length > 0;
    const phoneDigits = studentPhoneInput.value.trim();
    const phoneValid = isValidPhone(phoneDigits);
    
    if (nameValid && phoneValid) {
        startQuizBtn.disabled = false;
        if (phoneError) phoneError.classList.add('hidden');
    } else {
        startQuizBtn.disabled = true;
        if (phoneError && phoneDigits.length > 0 && !isValidPhone(phoneDigits)) {
            phoneError.classList.remove('hidden');
        } else if (phoneError) {
            phoneError.classList.add('hidden');
        }
    }
}

// Format and sanitize phone input (allow only digits, enforce max 11)
function sanitizePhoneInput(e) {
    let val = e.target.value.replace(/\D/g, ''); // remove non-digits
    if (val.length > 11) val = val.slice(0, 11);
    e.target.value = val;
    updateStartButtonState();
}

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
            studentPhone = saved.studentPhone || '';   // handle older saved data
            balance = saved.balance;
            answers = saved.answers;
            
            // Improved resume logic: skip already answered questions
            if (answers.length > saved.currentQuestionIndex) {
                currentQuestionIndex = answers.length;
            } else {
                currentQuestionIndex = saved.currentQuestionIndex;
            }
            
            // Safety: if out of bounds, reset
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
            // No saved progress – set up name entry with phone validation
            studentNameInput.addEventListener('input', updateStartButtonState);
            studentPhoneInput.addEventListener('input', sanitizePhoneInput);
            startQuizBtn.addEventListener('click', startQuiz);
            updateStartButtonState(); // initial disabled state
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
    const phoneDigits = studentPhoneInput.value.trim();
    
    if (!studentName || !isValidPhone(phoneDigits)) return;
    
    // Store full phone number with prefix for display/record
    studentPhone = `+88${phoneDigits}`;
    
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
        
        // Save attempt to Firestore (include phone if available)
        await dbService.saveAttempt({
            quizId: quizData.id,
            studentName: studentName,
            studentPhone: studentPhone || '',
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
    
    if (modal) modal.style.display = 'flex';
    
    if (continueBtn) {
        continueBtn.addEventListener('click', function() {
            modal.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                modal.style.display = 'none';
                if (studentNameInput) studentNameInput.focus();
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
