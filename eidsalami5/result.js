import { dbService } from './firebase.js';

// DOM Elements
const nameGreeting = document.getElementById('nameGreeting');
const eidiAmount = document.getElementById('eidiAmount');
const loveMessage = document.getElementById('loveMessage');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const whatsappShareBtn = document.getElementById('whatsappShareBtn');
const playAgainBtn = document.getElementById('playAgainBtn');

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const quizId = urlParams.get('id');
const studentName = urlParams.get('name') || localStorage.getItem('student') || 'student_name';
const score = urlParams.get('score') || localStorage.getItem('eidiFinal') || '20';

let confettiInterval = null;

// Initialize result page
document.addEventListener('DOMContentLoaded', () => {
    displayResults();
    startConfetti();
    addEventListeners();
});

// Add event listeners
function addEventListeners() {
    copyLinkBtn.addEventListener('click', copyShareLink);
    whatsappShareBtn.addEventListener('click', shareViaWhatsApp);
    playAgainBtn.addEventListener('click', playAgain);
    window.addEventListener('beforeunload', cleanupConfetti);
}

// Display results with animation
function displayResults() {
    // Animate name greeting
    nameGreeting.textContent = `${studentName}!`;
    nameGreeting.style.animation = 'slideUp 0.5s ease';

    // Animate Eidi amount counting up
    animateEidiAmount(0, parseInt(score));

    // Set love message
    const messages = [
        `This Salami is a small gift for your hard work and learning spirit, and I hope it makes your Eid a little more fun and special. May Allah fill your life with happiness, success, confidence, and beautiful moments ahead. Lots of love from Fardin Vaiya ❤️`
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    loveMessage.textContent = randomMessage;
}

// Animate Eidi amount counting up
function animateEidiAmount(start, end) {
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = (end - start) / steps;
    let current = start;
    let step = 0;

    const timer = setInterval(() => {
        step++;
        current += increment;

        if (step >= steps) {
            current = end;
            clearInterval(timer);
        }

        eidiAmount.textContent = Math.round(current);
        eidiAmount.style.transform = 'scale(1.2)';
        setTimeout(() => {
            eidiAmount.style.transform = 'scale(1)';
        }, 100);
    }, duration / steps);
}

// Start confetti using canvas-confetti
function startConfetti() {
    // Initial burst
    launchConfetti();

    // Continue every 2 seconds while page is visible
    confettiInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
            launchConfetti();
        }
    }, 2000);
}

// Launch a confetti burst
function launchConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4CAF50', '#9370DB']
    });
}

// Clean up confetti interval when leaving page
function cleanupConfetti() {
    if (confettiInterval) {
        clearInterval(confettiInterval);
        confettiInterval = null;
    }
}

// Copy share link
async function copyShareLink() {
    const shareUrl = window.location.href;

    try {
        await navigator.clipboard.writeText(shareUrl);

        // Show success feedback
        copyLinkBtn.innerHTML = '<i class="fa-regular fa-check-circle"></i> Copied!';
        copyLinkBtn.style.background = '#4CAF50';

        setTimeout(() => {
            copyLinkBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy your \'Salami Page\' Link';
            copyLinkBtn.style.background = '';
        }, 2000);

    } catch (error) {
        alert('Failed to copy link. Please select and copy manually.');
    }
}

// Share via WhatsApp
function shareViaWhatsApp() {
    const message = encodeURIComponent(
        `Hey! I just took part in Fardin Bhaiya’s 'Eid Salami Quiz', and it’s actually pretty cool—the questions are straight from our textbooks!\n\nYou can check out my beautiful Salami card here: ${window.location.href}\n\n If you want your Salami card too, join your quiz here: ${window.location.origin}/fardin.12/eidsalami5/quiz.html?id=${quizId}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
}

// Play again
function playAgain() {
    // Clean up before navigating away
    cleanupConfetti();
    window.location.href = `quiz.html?id=${quizId}`;
}
