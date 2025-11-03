import { generateQuiz } from '../welcome/services/geminiService.js';

const loadingTextElement = document.getElementById('loading-text');

// A collection of more creative and topic-specific loading messages
const topicMessages = {
    'python': [
        "Compiling Pythonic wisdom...",
        "Wrangling snakes and syntax trees...",
        "Indenting the fabric of knowledge...",
        "Did you know? Python was named after Monty Python's Flying Circus.",
        "Generating questions that are anything but 'spam' or 'eggs'..."
    ],
    'javascript': [
        "Assembling asynchronous assertions...",
        "Resolving promises of a great quiz...",
        "Did you know? JavaScript was created in just 10 days by Brendan Eich.",
        "Avoiding `undefined` behavior... mostly.",
        "Hoisting questions from the global scope..."
    ],
    'java': [
        "Brewing a fresh pot of questions...",
        "Running the Java Virtual Machine of knowledge...",
        "Collecting garbage to make room for trivia...",
        "This quiz is 100% platform-independent.",
    ],
    'sql': [
        "Joining tables of trivia...",
        "SELECTing the perfect questions...",
        "GROUPing facts BY relevance...",
        "Did you know? SQL stands for Structured Query Language.",
        "Ensuring all questions have a PRIMARY KEY..."
    ],
    'typescript': [
        "Strictly typing your quiz questions...",
        "Transpiling trivia from the future...",
        "No 'any' answers allowed here.",
        "Adding types to a sea of knowledge..."
    ],
    'c++': [
        "Compiling questions with maximum performance...",
        "Managing memory and mind-bending trivia...",
        "Pointing to the correct answers...",
        "This quiz has zero-cost abstractions."
    ],
    'ancient rome': [
        "Consulting the Sibylline Books...",
        "Building your quiz, one aqueduct at a time...",
        "All roads lead to these questions...",
        "Did you know? The Romans didn't have a number for zero.",
        "Gathering trivia from across the Empire..."
    ],
    'ancient egypt': [
        "Deciphering hieroglyphs for your questions...",
        "Unwrapping a mummy-lode of facts...",
        "Building a pyramid of knowledge...",
        "Did you know? The Great Pyramid was the world's tallest structure for over 3,800 years.",
        "Asking the Sphinx for its favorite riddles..."
    ],
    'the mughal empire': [
        "Crafting questions with Taj Mahal precision...",
        "Exploring the splendors of the Peacock Throne...",
        "From Babur to Aurangzeb, a quiz is coming.",
        "Did you know? The Mughals ruled over 150 million subjects at their peak."
    ],
    'the ottoman empire': [
        "Gathering knowledge from the Topkapi Palace...",
        "Conquering tough topics for your quiz...",
        "Brewing questions stronger than Turkish coffee.",
        "From Constantinople to Istanbul, the facts are flowing."
    ],
    // A generic fallback list
    'default': [
        "Asking the silicon brain...",
        "Reticulating splines for maximum quizitude...",
        "Translating universal knowledge...",
        "Aligning the knowledge crystals...",
        "Constructing cognitive challenges...",
        "Sorting bytes of pure wisdom...",
        "Summoning the quiz spirits...",
        "Charging the neural networks...",
        "Engaging the AI's creative mode..."
    ]
};


let messageInterval;

async function startQuizGeneration() {
    if (!loadingTextElement) return;

    const quizContextString = sessionStorage.getItem('quizContext');
    const quizContext = quizContextString ? JSON.parse(quizContextString) : {};
    const topicName = quizContext.topicName?.toLowerCase();
    const topicPrompt = sessionStorage.getItem('quizTopicPrompt'); // Use the full, detailed prompt
    const returnHash = quizContext.returnHash || '#home';

    // Select the appropriate messages, or fallback to the default list
    let messages = (topicName && topicMessages[topicName]) ? [...topicMessages[topicName]] : [...topicMessages.default];
    
    // Shuffle the array for variety on each load
    messages.sort(() => Math.random() - 0.5);

    let messageIndex = 0;
    loadingTextElement.textContent = messages[messageIndex];

    messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        // Fade out
        loadingTextElement.style.opacity = '0';
        setTimeout(() => {
            // Change text and fade in
            loadingTextElement.textContent = messages[messageIndex];
            loadingTextElement.style.opacity = '1';
        }, 300);
    }, 2500); // Change message every 2.5 seconds for better readability

    if (!topicPrompt) {
        console.error("No topic prompt found for quiz generation.");
        sessionStorage.setItem('quizError', 'Something went wrong. Please select a topic again.');
        window.location.hash = returnHash; 
        return;
    }

    try {
        const quizData = await generateQuiz(topicPrompt);
        sessionStorage.setItem('generatedQuizData', JSON.stringify(quizData));
        sessionStorage.removeItem('quizTopicPrompt'); // Clean up
        window.location.hash = '#quiz';
    } catch (error) {
        console.error("Failed to generate quiz:", error);
        sessionStorage.setItem('quizError', error.message || 'Failed to generate the quiz. Please try another topic.');
        sessionStorage.removeItem('quizTopicPrompt');
        window.location.hash = returnHash;
    }
}

function cleanup() {
    if (messageInterval) {
        clearInterval(messageInterval);
    }
}

// Add a listener to clean up when the user navigates away, e.g., if the API call finishes.
// This prevents the interval from running on the next page.
window.addEventListener('hashchange', cleanup, { once: true });

startQuizGeneration();