// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Your Firebase configuration (REPLACE WITH YOUR OWN)
const firebaseConfig = {
    apiKey: "AIzaSyBXS0LqYP8lILEeWCf9mg2pbTeDGWg5aJc",
  authDomain: "salami-80fe9.firebaseapp.com",
  databaseURL: "https://salami-80fe9-default-rtdb.firebaseio.com",
  projectId: "salami-80fe9",
  storageBucket: "salami-80fe9.firebasestorage.app",
  messagingSenderId: "393304304767",
  appId: "1:393304304767:web:504b0dd92ad23eef2aa34a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Database Service Object
export const dbService = {
    // Get panel password
    async getPassword() {
        try {
            const docRef = doc(db, 'privacy', 'panel');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data().password;
            } else {
                // Create default password if doesn't exist
                await setDoc(docRef, { password: 'eid2024' });
                return 'eid2024';
            }
        } catch (error) {
            console.error('Error getting password:', error);
            throw error;
        }
    },

    // Save quiz to Firestore
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

    // Get quiz by ID
    async getQuiz(quizId) {
        try {
            const quizRef = doc(db, 'quizzes', quizId);
            const quizSnap = await getDoc(quizRef);
            if (quizSnap.exists()) {
                return { id: quizSnap.id, ...quizSnap.data() };
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting quiz:', error);
            throw error;
        }
    },

    // Save quiz attempt
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

    // Get all attempts for a quiz
    async getAttempts(quizId) {
        try {
            const q = query(collection(db, 'attempts'), where('quizId', '==', quizId));
            const querySnapshot = await getDocs(q);
            const attempts = [];
            querySnapshot.forEach((doc) => {
                attempts.push({ id: doc.id, ...doc.data() });
            });
            return attempts;
        } catch (error) {
            console.error('Error getting attempts:', error);
            throw error;
        }
    }
};

// Helper function to generate unique quiz ID
function generateQuizId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `quiz_${timestamp}_${randomStr}`;
}

// Export db for direct use if needed
export { db };
