// import { GoogleGenAI, Type } from "@google/genai";

// if (!process.env.API_KEY) {
//     throw new Error("API_KEY environment variable is not set.");
// }

// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// const quizSchema = {
//     type: Type.ARRAY,
//     items: {
//       type: Type.OBJECT,
//       properties: {
//         question: {
//           type: Type.STRING,
//           description: 'The quiz question text.'
//         },
//         options: {
//           type: Type.ARRAY,
//           items: {
//             type: Type.STRING,
//           },
//           description: 'An array of exactly 4 possible answers.'
//         },
//         correctAnswerIndex: {
//           type: Type.INTEGER,
//           description: 'The 0-based index of the correct answer in the options array.'
//         },
//         explanation: {
//             type: Type.STRING,
//             description: 'A brief explanation of why the correct answer is right.'
//         }
//       },
//       required: ['question', 'options', 'correctAnswerIndex', 'explanation'],
//     }
// };

// --- MOCKED DATA FOR SIMULATION ---
const sampleQuestions = {
    'python': [
        { question: "What does the 'len()' function do?", options: ["Returns the length", "Converts to lowercase", "Generates a number", "Prints to console"], correctAnswerIndex: 0, explanation: "The len() function returns the number of items in an object." },
        { question: "Which keyword is used to define a function?", options: ["func", "define", "def", "function"], correctAnswerIndex: 2, explanation: "'def' is the keyword used to define a function in Python." },
        { question: "How do you comment a single line?", options: ["// comment", "/* comment */", "# comment", "<!-- comment -->"], correctAnswerIndex: 2, explanation: "The '#' symbol is used for single-line comments in Python." },
        { question: "What is the file extension for Python files?", options: [".py", ".pt", ".px", ".pyt"], correctAnswerIndex: 0, explanation: "Python files have a '.py' extension." },
        { question: "Which of these is not a core data type?", options: ["List", "Dictionary", "Tuple", "Class"], correctAnswerIndex: 3, explanation: "While you define classes, 'Class' itself is a construct, not a core data type like List, Dict, or Tuple." }
    ],
    'default': [
        { question: "What is the capital of France?", options: ["Berlin", "Madrid", "Paris", "Rome"], correctAnswerIndex: 2, explanation: "Paris is the capital and most populous city of France." },
        { question: "Which planet is known as the Red Planet?", options: ["Earth", "Mars", "Jupiter", "Venus"], correctAnswerIndex: 1, explanation: "Mars is often called the 'Red Planet' due to its reddish appearance." },
        { question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctAnswerIndex: 3, explanation: "The Pacific Ocean is the largest and deepest of the world's ocean divisions." },
        { question: "Who wrote 'Romeo and Juliet'?", options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], correctAnswerIndex: 1, explanation: "William Shakespeare, an English playwright, is credited with writing this famous tragedy." },
        { question: "What is H2O commonly known as?", options: ["Salt", "Oxygen", "Water", "Hydrogen Peroxide"], correctAnswerIndex: 2, explanation: "H2O is the chemical formula for water." }
    ]
};


/**
 * SIMULATED function to generate a quiz on a given topic.
 * @param {string} topic - The topic for the quiz.
 * @param {number} numQuestions - The number of questions to generate.
 * @returns {Promise<Array<object>>} - A promise that resolves to the quiz data.
 */
export const generateQuiz = async (topic, numQuestions) => {
    console.log(`Simulating quiz generation for topic: "${topic}" with ${numQuestions} questions.`);
    
    // Simulate network delay to feel like a real API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Select a question set based on the topic, or use default
    const topicKey = topic.toLowerCase().includes('python') ? 'python' : 'default';
    const baseQuestions = sampleQuestions[topicKey] || sampleQuestions['default'];

    // Create a new set of questions and prepend the topic to them
    const quizData = Array.from({ length: numQuestions }, (_, i) => {
        const questionTemplate = baseQuestions[i % baseQuestions.length];
        return {
            ...questionTemplate,
            question: `[${topic}] ${questionTemplate.question}` // Add topic to question for simulation feedback
        };
    });

    // Occasionally simulate an error for robustness testing
    if (Math.random() < 0.05) { 
        console.error("Simulating a quiz generation error.");
        throw new Error("Failed to generate quiz. The simulated API had an issue. Please try again.");
    }
    
    return quizData;
};