import { dbService } from './firebase.js';

// State management
let questionCount = 1;
let currentQuizData = {
    questions: []
};

// DOM Elements
const passwordSection = document.getElementById('passwordSection');
const teacherPanel = document.getElementById('teacherPanel');
const passwordInput = document.getElementById('passwordInput');
const submitPassword = document.getElementById('submitPassword');
const passwordError = document.getElementById('passwordError');
const questionsContainer = document.getElementById('questionsContainer');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const createQuizBtn = document.getElementById('createQuizBtn');
const quizUrlSection = document.getElementById('quizUrlSection');
const quizUrl = document.getElementById('quizUrl');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const createAnotherBtn = document.getElementById('createAnotherBtn');

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Add first question by default
    addQuestionBlock();
    
    // Event listeners
    submitPassword.addEventListener('click', validatePassword);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') validatePassword();
    });
    
    addQuestionBtn.addEventListener('click', () => addQuestionBlock());
    createQuizBtn.addEventListener('click', createQuiz);
    copyUrlBtn.addEventListener('click', copyQuizUrl);
    createAnotherBtn.addEventListener('click', resetQuizBuilder);
});

// Validate teacher password
async function validatePassword() {
    const enteredPassword = passwordInput.value.trim();
    
    if (!enteredPassword) {
        showError('Please enter password');
        return;
    }
    
    try {
        showLoading(true);
        const correctPassword = await dbService.getPassword();
        
        if (enteredPassword === correctPassword) {
            // Password correct - show teacher panel
            passwordSection.classList.add('hidden');
            teacherPanel.classList.remove('hidden');
            passwordError.textContent = '';
        } else {
            showError('Incorrect password');
        }
    } catch (error) {
        console.error('Password validation error:', error);
        showError('Error validating password. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Add new question block
function addQuestionBlock() {
    const questionBlock = document.createElement('div');
    questionBlock.className = 'question-block';
    questionBlock.dataset.questionNumber = questionCount;
    
    questionBlock.innerHTML = `
        <button class="remove-question" onclick="removeQuestion(this)">✕</button>
        
        <div class="question-header">
            <span class="question-number-label">Question ${questionCount}</span>
            <select class="label-select" required>
                <option value="Science">🔬 Science</option>
                <option value="Math">📐 Math</option>
                <option value="Islamic">🌙 Islamic</option>
                <option value="General">🎯 General</option>
            </select>
            <input type="number" class="timer-input" placeholder="Timer (seconds)" min="10" max="120" value="30" required>
        </div>
        
        <input type="text" class="question-text-input" placeholder="Enter your question here..." required>
        
        <div class="options-grid">
            <input type="text" class="option-input" placeholder="Option A" required>
            <input type="text" class="option-input" placeholder="Option B" required>
            <input type="text" class="option-input" placeholder="Option C" required>
            <input type="text" class="option-input" placeholder="Option D" required>
        </div>
        
        <div class="correct-option">
            <span>Correct Answer:</span>
            <label><input type="radio" name="correct_${questionCount}" value="0" required> A</label>
            <label><input type="radio" name="correct_${questionCount}" value="1"> B</label>
            <label><input type="radio" name="correct_${questionCount}" value="2"> C</label>
            <label><input type="radio" name="correct_${questionCount}" value="3"> D</label>
        </div>
    `;
    
    questionsContainer.appendChild(questionBlock);
    questionCount++;
}

// Remove question block
window.removeQuestion = function(button) {
    const questionBlock = button.closest('.question-block');
    if (document.querySelectorAll('.question-block').length > 1) {
        questionBlock.remove();
        renumberQuestions();
    } else {
        alert('You need at least one question!');
    }
};

// Renumber questions after removal
function renumberQuestions() {
    const blocks = document.querySelectorAll('.question-block');
    blocks.forEach((block, index) => {
        const newNumber = index + 1;
        block.dataset.questionNumber = newNumber;
        block.querySelector('.question-number-label').textContent = `Question ${newNumber}`;
        
        // Update radio button names
        const radios = block.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            radio.name = `correct_${newNumber}`;
        });
    });
    questionCount = blocks.length + 1;
}

// Create quiz
async function createQuiz() {
    // Validate all questions
    if (!validateQuestions()) {
        alert('Please fill in all questions and options correctly!');
        return;
    }
    
    // Collect quiz data
    const questions = collectQuestions();
    
    try {
        showLoading(true);
        
        // Save to Firestore
        const quizId = await dbService.saveQuiz({
            questions: questions,
            totalQuestions: questions.length
        });
        
        // Generate and display URL
        const url = `${window.location.origin}/fardin.12/eidsalami5/quiz.html?id=${quizId}`;
        quizUrl.value = url;
        
        // Show URL section
        quizUrlSection.classList.remove('hidden');
        
        // Scroll to URL section
        quizUrlSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error creating quiz:', error);
        alert('Error creating quiz. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Validate all questions
function validateQuestions() {
    const blocks = document.querySelectorAll('.question-block');
    
    for (const block of blocks) {
        // Check question text
        const questionText = block.querySelector('.question-text-input').value.trim();
        if (!questionText) return false;
        
        // Check options
        const options = block.querySelectorAll('.option-input');
        for (const option of options) {
            if (!option.value.trim()) return false;
        }
        
        // Check correct answer selected
        const correctSelected = block.querySelector('input[type="radio"]:checked');
        if (!correctSelected) return false;
        
        // Check timer
        const timer = block.querySelector('.timer-input').value;
        if (!timer || timer < 10 || timer > 120) return false;
    }
    
    return true;
}

// Collect questions data
function collectQuestions() {
    const blocks = document.querySelectorAll('.question-block');
    const questions = [];
    
    blocks.forEach((block, index) => {
        const label = block.querySelector('.label-select').value;
        const timer = parseInt(block.querySelector('.timer-input').value);
        const questionText = block.querySelector('.question-text-input').value.trim();
        
        const options = [];
        block.querySelectorAll('.option-input').forEach(opt => {
            options.push(opt.value.trim());
        });
        
        const correctIndex = parseInt(block.querySelector('input[type="radio"]:checked').value);
        
        questions.push({
            questionNumber: index + 1,
            label,
            timeLimit: timer,
            questionText,
            options,
            correctIndex
        });
    });
    
    return questions;
}

// Copy quiz URL to clipboard
async function copyQuizUrl() {
    try {
        await navigator.clipboard.writeText(quizUrl.value);
        
        // Visual feedback
        copyUrlBtn.textContent = '✓ Copied!';
        setTimeout(() => {
            copyUrlBtn.textContent = '📋 Copy';
        }, 2000);
        
    } catch (error) {
        alert('Failed to copy URL. Please select and copy manually.');
    }
}

// Reset quiz builder
function resetQuizBuilder() {
    // Clear questions
    questionsContainer.innerHTML = '';
    questionCount = 1;
    addQuestionBlock();
    
    // Hide URL section
    quizUrlSection.classList.add('hidden');
}

// Show error message
function showError(message) {
    passwordError.textContent = message;
    passwordError.style.animation = 'none';
    passwordError.offsetHeight; // Trigger reflow
    passwordError.style.animation = 'shake 0.3s ease';
}

// Show/hide loading spinner
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (!spinner) {
        // Create spinner if it doesn't exist
        const spinnerDiv = document.createElement('div');
        spinnerDiv.id = 'loadingSpinner';
        spinnerDiv.className = 'loading-spinner';
        spinnerDiv.innerHTML = '<div class="spinner"></div><p>Loading...</p>';
        document.body.appendChild(spinnerDiv);
    }
    
    const spinnerElement = document.getElementById('loadingSpinner');
    if (show) {
        spinnerElement.classList.remove('hidden');
    } else {
        spinnerElement.classList.add('hidden');
    }
}
