import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import rateLimit from 'express-rate-limit';
import fs from 'fs/promises';

const app = express();
const port = process.env.PORT || 3000;

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(express.json());

// Rate limiting to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '/')));

// --- Gemini API Initialization ---
let ai;
if (process.env.API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  console.log('GoogleGenAI initialized successfully.');
} else {
  console.error('API_KEY is not defined in environment variables. API calls will fail.');
}

const quizGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: "An array of quiz questions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING, description: "The question text." },
                    options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of 4 possible answers." },
                    correctAnswerIndex: { type: Type.INTEGER, description: "The 0-based index of the correct answer in the options array." },
                    explanation: { type: Type.STRING, description: "A brief explanation for why the correct answer is correct." }
                },
                required: ["question", "options", "correctAnswerIndex", "explanation"]
            }
        }
    },
    required: ["questions"]
};

const learningPathSchema = {
  type: Type.OBJECT,
  properties: {
    path: {
      type: Type.ARRAY,
      description: "An array of learning steps.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The name of the learning step." },
          topic: { type: Type.STRING, description: "A concise, URL-friendly slug or keyword for the topic of this step." }
        },
        required: ["name", "topic"]
      }
    }
  },
  required: ["path"]
}


// --- API Routes ---

let topicsCache = null;
app.get('/api/topics', apiLimiter, async (req, res) => {
    if (topicsCache) {
        return res.json(topicsCache);
    }
    try {
        const topicsPath = path.join(__dirname, 'data', 'topics.json');
        const data = await fs.readFile(topicsPath, 'utf8');
        topicsCache = JSON.parse(data);
        res.json(topicsCache);
    } catch (error) {
        console.error('Error reading topics.json:', error);
        res.status(500).json({ error: 'Failed to load topics.' });
    }
});


app.post('/api/generate', apiLimiter, async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Server is not configured with an API key." });
  }

  const { topic, numQuestions, difficulty } = req.body;

  if (!topic || !numQuestions || !difficulty) {
    return res.status(400).json({ error: 'Missing required parameters: topic, numQuestions, difficulty.' });
  }

  const prompt = `Generate a ${difficulty} level multiple-choice quiz with exactly ${numQuestions} questions about "${topic}". For each question, provide 4 options, the 0-based index of the correct answer, and a brief explanation. Ensure the content is accurate and educational.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: quizGenerationSchema,
      }
    });

    // The response.text should already be a valid JSON string due to responseSchema
    const quizData = JSON.parse(response.text);
    res.json(quizData);

  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Failed to generate quiz. The AI may have refused to generate content for this topic.', details: error.message });
  }
});

app.post('/api/generate-path', apiLimiter, async (req, res) => {
    if (!ai) {
        return res.status(500).json({ error: "Server is not configured with an API key." });
    }

    const { goal } = req.body;

    if (!goal) {
        return res.status(400).json({ error: 'Missing required parameter: goal.' });
    }

    const prompt = `Create a step-by-step learning path for someone who wants to learn about "${goal}". The path should have between 5 and 10 steps. For each step, provide a name and a concise, URL-friendly topic keyword.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: learningPathSchema,
            }
        });

        const pathData = JSON.parse(response.text);
        res.json(pathData);

    } catch (error) {
        console.error('Gemini API Error (Learning Path):', error);
        res.status(500).json({ error: 'Failed to generate learning path.', details: error.message });
    }
});


// --- SPA Fallback Route ---
// This regex-based route handles all other GET requests and serves the main HTML file.
// This is crucial for client-side routing to work correctly on page refreshes.
app.get(/^\/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// --- Server Start ---
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
