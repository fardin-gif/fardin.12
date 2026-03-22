import { dbService } from './firebase.js';

let quizData = null;
let currentIndex = 0;
let balance = 20;
let studentName = '';
let timer = null;
let timeLeft = 0;
let canAnswer = true;
let answerLock = false;
let answers = [];

// DOM elements
const nameEntry = document.getElementById('nameEntry');
const quizScreen = document.getElementById('quizScreen');
const studentNameInput = document.getElementById('studentName');
const startBtn = document.getElementById('startQuizBtn');
const balanceValue = document.getElementById('balanceValue');
const progressBar = document.getElementById('progressBar');
const questionCount = document.getElementById('questionCount');
const questionNumber = document.getElementById('questionNumber');
const timerBox = document.getElementById('timerBox');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const nextBtn = document.getElementById('nextBtn');
const modal = document.getElementById('instructionModal');
const continueBtn = document.getElementById('continueToQuiz');

// Storage helpers
function getStorageKey() {
    return `mathQuiz_${quizData.id}_progress`;
}

function saveProgress() {
    if (!quizData || !studentName) return;
    localStorage.setItem(getStorageKey(), JSON.stringify({
        quizId: quizData.id,
        studentName,
        currentIndex,
        balance,
        answers,
        timestamp: Date.now()
    }));
}

function loadProgress() {
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
}

function clearProgress() {
    localStorage.removeItem(getStorageKey());
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const quizId = params.get('id');
    if (!quizId) return showError('No quiz ID provided.');

    showLoading(true);
    try {
        quizData = await dbService.getQuiz(quizId);
        if (!quizData) return showError('Quiz not found.');

        // Modal handling
        if (modal) modal.style.display = 'flex';
        
        // Add click outside to close? No, require button click
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                if (studentNameInput) studentNameInput.focus();
            });
        }

        // Check saved progress
        const saved = loadProgress();
        if (saved && saved.quizId === quizId) {
            studentName = saved.studentName;
            balance = saved.balance;
            answers = saved.answers;
            
            // Determine resume index
            if (answers.length > saved.currentIndex) {
                currentIndex = answers.length;
            } else {
                currentIndex = saved.currentIndex;
            }
            
            // Safety check
            if (currentIndex >= quizData.questions.length) {
                currentIndex = 0;
                balance = 20;
                answers = [];
                clearProgress();
            } else {
                nameEntry.classList.add('hidden');
                quizScreen.classList.remove('hidden');
                updateBalance();
                loadQuestion();
            }
        } else {
            studentNameInput.addEventListener('input', () => {
                startBtn.disabled = !studentNameInput.value.trim();
            });
            startBtn.addEventListener('click', startQuiz);
        }

        nextBtn.addEventListener('click', moveToNext);
        
    } catch (err) {
        console.error('Error:', err);
        showError('Error loading quiz. Please check your connection.');
    } finally {
        showLoading(false);
    }
});

function startQuiz() {
    studentName = studentNameInput.value.trim();
    if (!studentName) return;
    
    currentIndex = 0;
    balance = 20;
    answers = [];
    
    nameEntry.classList.add('hidden');
    quizScreen.classList.remove('hidden');
    
    saveProgress();
    updateBalance();
    loadQuestion();
}

function loadQuestion() {
    if (currentIndex >= quizData.questions.length) {
        endQuiz();
        return;
    }
    
    const q = quizData.questions[currentIndex];
    answerLock = false;
    canAnswer = true;

    // Update question number
    questionNumber.textContent = `Q${currentIndex + 1}`;
    
    // Set question text
    questionText.innerHTML = q.questionText || 'Question not available';

    // Re-render math
    if (window.MathJax) {
        MathJax.typesetPromise([questionText, optionsContainer]).catch(e => console.log('MathJax error:', e));
    }

    // Progress bar
    const progress = ((currentIndex + 1) / quizData.questions.length) * 100;
    progressBar.style.width = progress + '%';
    questionCount.textContent = `${currentIndex + 1}/${quizData.questions.length}`;

    // Options
    createOptions(q.options || []);

    // Timer
    resetTimer(q.timeLimit || 45);

    nextBtn.classList.add('hidden');
    timerBox.classList.remove('warning');
    timerBox.classList.remove('timeout-animation');
}

function createOptions(options) {
    optionsContainer.innerHTML = '';
    
    if (!options || options.length === 0) {
        const btn = document.createElement('button');
        btn.className = 'option';
        btn.innerHTML = 'No options available';
        btn.disabled = true;
        optionsContainer.appendChild(btn);
        return;
    }
    
    options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option';
        btn.innerHTML = `${String.fromCharCode(65 + idx)}. ${opt}`;
        btn.dataset.index = idx;
        btn.addEventListener('click', (e) => selectOption(e, idx));
        optionsContainer.appendChild(btn);
    });
    
    // Render math in options
    if (window.MathJax) {
        MathJax.typesetPromise([optionsContainer]).catch(e => console.log('MathJax error:', e));
    }
}

function selectOption(e, selectedIdx) {
    if (!canAnswer || answerLock) return;
    
    const q = quizData.questions[currentIndex];
    const correct = selectedIdx === q.correctIndex;
    
    answerLock = true;
    canAnswer = false;
    clearInterval(timer);

    // Disable all options
    document.querySelectorAll('.option').forEach(opt => opt.disabled = true);

    if (correct) {
        balance += 10;
        e.currentTarget.classList.add('correct-feedback');
        // Show correct option highlight
        document.querySelectorAll('.option')[q.correctIndex].classList.add('correct-feedback');
        confetti({ 
            particleCount: 50, 
            spread: 60, 
            origin: { y: 0.6 },
            colors: ['#9146ff', '#00f5d4', '#ffd700']
        });
    } else {
        balance = Math.max(20, balance - 5);
        e.currentTarget.classList.add('wrong-feedback');
        // Highlight correct answer for learning
        document.querySelectorAll('.option')[q.correctIndex].classList.add('correct-feedback');
    }
    
    animateBalance(balance);
    
    answers.push({
        questionNumber: currentIndex + 1,
        selectedIndex: selectedIdx,
        isCorrect: correct,
        timeLeft
    });
    
    saveProgress();
    nextBtn.classList.remove('hidden');
}

function handleTimeout() {
    if (answerLock) return;
    
    answerLock = true;
    canAnswer = false;
    clearInterval(timer);
    
    document.querySelectorAll('.option').forEach(opt => opt.disabled = true);
    timerBox.classList.add('warning');
    timerBox.classList.add('timeout-animation');
    
    answers.push({
        questionNumber: currentIndex + 1,
        selectedIndex: -1,
        isCorrect: false,
        timeLeft: 0
    });
    
    saveProgress();
    nextBtn.classList.remove('hidden');
}

function resetTimer(seconds) {
    timeLeft = seconds;
    timerBox.textContent = `⏰ ${timeLeft}s`;
    
    if (timer) clearInterval(timer);
    
    timer = setInterval(() => {
        timeLeft--;
        timerBox.textContent = `⏰ ${timeLeft}s`;
        
        if (timeLeft <= 5 && timeLeft > 0) {
            timerBox.classList.add('warning');
        }
        
        if (timeLeft <= 0) {
            handleTimeout();
        }
    }, 1000);
}

function moveToNext() {
    currentIndex++;
    
    if (currentIndex < quizData.questions.length) {
        loadQuestion();
    } else {
        endQuiz();
    }
}

async function endQuiz() {
    showLoading(true);
    
    try {
        await dbService.saveAttempt({
            quizId: quizData.id,
            studentName,
            finalBalance: balance,
            answers,
            totalQuestions: quizData.questions.length,
            correctAnswers: answers.filter(a => a.isCorrect).length
        });
        
        clearProgress();
        
        // Store in localStorage as backup
        localStorage.setItem('eidiFinal', balance.toString());
        localStorage.setItem('student', studentName);
        
        window.location.href = `eidi.html?id=${quizData.id}&name=${encodeURIComponent(studentName)}&score=${balance}`;
        
    } catch (err) {
        console.error('Error saving attempt:', err);
        // Still redirect with localStorage backup
        localStorage.setItem('eidiFinal', balance.toString());
        localStorage.setItem('student', studentName);
        window.location.href = `eidi.html?id=${quizData.id}&name=${encodeURIComponent(studentName)}&score=${balance}`;
    } finally {
        showLoading(false);
    }
}

function updateBalance() {
    balanceValue.textContent = balance;
}

function animateBalance(newVal) {
    balanceValue.textContent = newVal;
    balanceValue.style.animation = 'balancePop 0.3s ease-out';
    setTimeout(() => {
        balanceValue.style.animation = '';
    }, 300);
}

function showError(msg) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--bg-card);
        padding: 30px;
        border-radius: 20px;
        border: 2px solid var(--wrong-red);
        z-index: 3000;
        text-align: center;
        color: white;
        box-shadow: 0 0 30px var(--wrong-red);
    `;
    div.innerHTML = `
        <h2 style="color: var(--wrong-red); margin-bottom: 15px;">😕 Oops!</h2>
        <p style="margin-bottom: 20px;">${msg}</p>
        <button onclick="location.reload()" class="glow-button" style="background: var(--wrong-red);">Try Again</button>
    `;
    document.body.appendChild(div);
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        if (show) {
            spinner.classList.remove('hidden');
        } else {
            spinner.classList.add('hidden');
        }
    }
}

// Handle page visibility change to pause timer? Optional
document.addEventListener('visibilitychange', () => {
    if (document.hidden && timer) {
        // Page hidden, maybe pause timer? For fairness, we won't pause
        // But we can add a warning
    }
});
