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

// Add new question block with LaTeX preview
function addQuestionBlock() {
    const questionBlock = document.createElement('div');
    questionBlock.className = 'question-block';
    questionBlock.dataset.questionNumber = questionCount;
    
    questionBlock.innerHTML = `
        <button class="remove-question" onclick="removeQuestion(this)">✕</button>
        
        <div class="question-header">
            <span class="question-number-label">Question ${questionCount}</span>
            <input type="number" class="timer-input" placeholder="Timer (seconds)" min="10" max="180" value="45" required>
        </div>
        
        <div class="math-input-group">
            <label>Question (use $$...$$ for LaTeX):</label>
            <textarea class="question-text-input" placeholder="Enter your question with LaTeX here..." rows="3" required></textarea>
            <div class="preview-area" id="preview-${questionCount}">Preview will appear here</div>
        </div>
        
        <div class="options-grid">
            <input type="text" class="option-input" placeholder="Option A (with LaTeX)" required>
            <input type="text" class="option-input" placeholder="Option B (with LaTeX)" required>
            <input type="text" class="option-input" placeholder="Option C (with LaTeX)" required>
            <input type="text" class="option-input" placeholder="Option D (with LaTeX)" required>
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
    
    // Add LaTeX preview listener
    const textarea = questionBlock.querySelector('.question-text-input');
    const previewDiv = questionBlock.querySelector(`#preview-${questionCount}`);
    
    textarea.addEventListener('input', () => {
        previewDiv.innerHTML = textarea.value;
        if (window.MathJax) {
            MathJax.typesetPromise([previewDiv]).catch(err => console.log('MathJax error:', err));
        }
    });
    
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
        
        // Update preview ID
        const previewDiv = block.querySelector('.preview-area');
        previewDiv.id = `preview-${newNumber}`;
        
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
        const url = `${window.location.origin}/quiz.html?id=${quizId}`;
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
        if (!timer || timer < 10 || timer > 180) return false;
    }
    
    return true;
}

// Collect questions data
function collectQuestions() {
    const blocks = document.querySelectorAll('.question-block');
    const questions = [];
    
    blocks.forEach((block, index) => {
        const timer = parseInt(block.querySelector('.timer-input').value);
        const questionText = block.querySelector('.question-text-input').value.trim();
        
        const options = [];
        block.querySelectorAll('.option-input').forEach(opt => {
            options.push(opt.value.trim());
        });
        
        const correctIndex = parseInt(block.querySelector('input[type="radio"]:checked').value);
        
        questions.push({
            questionNumber: index + 1,
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
    if (show) {
        spinner.classList.remove('hidden');
    } else {
        spinner.classList.add('hidden');
    }
}
