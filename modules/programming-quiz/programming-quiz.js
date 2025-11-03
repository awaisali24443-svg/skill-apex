console.log("Programming Quiz module loaded.");

document.querySelectorAll('.topic-card').forEach(card => {
    card.addEventListener('click', () => {
        const language = card.dataset.topic;
        if (language) {
            // Create a more specific prompt for the AI to generate a better quiz
            const fullTopic = `A quiz on intermediate concepts in the ${language} programming language`;
            sessionStorage.setItem('quizTopic', fullTopic);
            window.location.hash = '#loading';
        }
    });
});