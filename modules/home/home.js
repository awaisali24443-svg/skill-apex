console.log("Home module (Dashboard) loaded.");

function animateFeatureCards() {
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card, index) => {
        card.style.animation = `popIn 0.5s ease-out ${index * 0.1}s forwards`;
        card.style.opacity = '0';
    });
}

animateFeatureCards();