/**
 * topicService.js
 * 
 * This service acts as a single source of truth for all quiz topic and category data.
 * It now includes 3D coordinates for the stellar map visualization.
 */

export const categoryData = {
    programming: {
        title: "Programming Quizzes",
        categoryTitle: "Programming",
        subtitle: "Code, algorithms, and logic.",
        icon: "💻",
        pos: { x: -15, y: 5, z: -10 }, // Position in 3D space
        topics: [
            { name: "Python", icon: "🐍", description: "Data science, web dev", pos: { x: -1, y: 2, z: 0 } },
            { name: "JavaScript", icon: "🟨", description: "The language of the web", pos: { x: 2, y: 1, z: 1 } },
            { name: "Java", icon: "☕", description: "Enterprise applications", pos: { x: 0, y: -1, z: 2 } },
            { name: "SQL", icon: "🗃️", description: "Database management", pos: { x: 3, y: -2, z: -1 } },
            { name: "TypeScript", icon: "🟦", description: "JS with static types", pos: { x: 1, y: 3, z: -2 } },
            { name: "C++", icon: "⚙️", description: "Performance-critical", pos: { x: -3, y: -1, z: 0 } },
        ]
    },
    science: {
        title: "Science Quizzes",
        categoryTitle: "Science",
        subtitle: "Biology, chemistry, and inventions.",
        icon: "🔬",
        pos: { x: 15, y: 0, z: -5 },
        topics: [
            { name: "Biology", icon: "🧬", description: "The study of life", pos: { x: 1, y: 2, z: 0 } },
            { name: "Chemistry", icon: "🧪", description: "Matter and reactions", pos: { x: -2, y: 0, z: 1 } },
            { name: "Physics", icon: "⚛️", description: "Forces, energy, motion", pos: { x: 2, y: -1, z: -2 } },
            { name: "Science Inventions", icon: "💡", description: "World-changing discoveries", pos: { x: 0, y: -2, z: 2 } },
        ]
    },
    technology: {
        title: "Technology Quizzes",
        categoryTitle: "Technology",
        subtitle: "AI, space, and modern tech.",
        icon: "🚀",
        pos: { x: 0, y: -10, z: 0 },
        topics: [
            { name: "AI and Technology", icon: "🤖", description: "The cutting-edge", pos: { x: -2, y: 1, z: 0 } },
            { name: "Space and Astronomy", icon: "🔭", description: "The final frontier", pos: { x: 2, y: 0, z: -1 } },
            { name: "Cybersecurity", icon: "🛡️", description: "Protecting digital assets", pos: { x: 0, y: -2, z: 1 } },
        ]
    }
};