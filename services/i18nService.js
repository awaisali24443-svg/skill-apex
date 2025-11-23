
const DICTIONARY = {
    'es': {
        'Start': 'Comenzar',
        'Next Question': 'Siguiente',
        'Submit Answer': 'Enviar',
        'Show Results': 'Ver Resultados',
        'Quit': 'Salir',
        'Hint': 'Pista',
        'Home': 'Inicio',
        'Back to Map': 'Volver al Mapa',
        'Try Again': 'Intentar de Nuevo',
        'Review Answers': 'Revisar Respuestas'
    },
    'fr': {
        'Start': 'Commencer',
        'Next Question': 'Suivant',
        'Submit Answer': 'Soumettre',
        'Show Results': 'Résultats',
        'Quit': 'Quitter',
        'Hint': 'Indice',
        'Home': 'Accueil',
        'Back to Map': 'Retour',
        'Try Again': 'Réessayer',
        'Review Answers': 'Revoir'
    },
    'de': {
        'Start': 'Starten',
        'Next Question': 'Nächste',
        'Submit Answer': 'Senden',
        'Show Results': 'Ergebnisse',
        'Quit': 'Verlassen',
        'Hint': 'Hinweis',
        'Home': 'Startseite',
        'Back to Map': 'Zurück',
        'Try Again': 'Nochmal',
        'Review Answers': 'Überprüfen'
    }
};

export function getText(key) {
    const lang = navigator.language.split('-')[0];
    if (DICTIONARY[lang] && DICTIONARY[lang][key]) {
        return DICTIONARY[lang][key];
    }
    return key; // Fallback to English (Key)
}
