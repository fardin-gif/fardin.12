// Firebase Configuration and Initialization (modular SDK v9)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// 🔁 Replace with your own Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyAX56orw6_u8OK0u27C_AX1oYDe_bRpJT8",
  authDomain: "eidi-10-math.firebaseapp.com",
  projectId: "eidi-10-math",
  storageBucket: "eidi-10-math.firebasestorage.app",
  messagingSenderId: "544537489549",
  appId: "1:544537489549:web:63a81503e9782b2bfff2c4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Database Service Object
export const dbService = {
    // Get teacher panel password
    async getPassword() {
        try {
            const docRef = doc(db, 'privacy', 'panel');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data().password;
            } else {
                // Create default password if missing
                await setDoc(docRef, { password: 'math2024' });
                return 'math2024';
            }
        } catch (error) {
            console.error('Error getting password:', error);
            throw error;
        }
    },

    // Save a new quiz to Firestore
    async saveQuiz(quizData) {
        try {
            const quizId = generateQuizId();
            const quizRef = doc(db, 'quizzes', quizId);
            await setDoc(quizRef, {
                quizId,
                ...quizData,
                createdAt: new Date().toISOString()
            });
            return quizId;
        } catch (error) {
            console.error('Error saving quiz:', error);
            throw error;
        }
    },

    // Get a quiz by its ID
    async getQuiz(quizId) {
        try {
            const quizRef = doc(db, 'quizzes', quizId);
            const quizSnap = await getDoc(quizRef);
            if (quizSnap.exists()) {
                return { id: quizSnap.id, ...quizSnap.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting quiz:', error);
            throw error;
        }
    },

    // Save a student's attempt
    async saveAttempt(attemptData) {
        try {
            const attemptsRef = collection(db, 'attempts');
            const docRef = await addDoc(attemptsRef, {
                ...attemptData,
                timestamp: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error saving attempt:', error);
            throw error;
        }
    },

    // Get all attempts for a specific quiz (for data viewer)
    async getAttempts(quizId) {
        try {
            const q = query(collection(db, 'attempts'), where('quizId', '==', quizId));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting attempts:', error);
            throw error;
        }
    }
};

// Helper: generate a unique quiz ID (e.g., quiz_abc123_1700000000)
function generateQuizId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `quiz_${timestamp}_${randomStr}`;
}

export { db };
