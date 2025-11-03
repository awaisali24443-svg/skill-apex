console.log("Historical Knowledge module loaded.");

document.querySelectorAll('.topic-card').forEach(card => {
    card.addEventListener('click', () => {
        const topic = card.dataset.topic;
        if (topic) {
            // Create a more specific prompt for the AI
            const fullTopic = `A quiz on the key events, figures, and concepts of ${topic}`;
            sessionStorage.setItem('quizTopic', fullTopic);
            window.location.hash = '#loading';
        }
    });
});
