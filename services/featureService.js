// services/featureService.js

// A simple feature flag management service.
// Set a feature to `true` to enable it, `false` to disable it.
const FEATURES = {
    learningPaths: true, // This feature is not ready, so it's disabled.
    studyMode: true,      // This feature is working and will be shown.
    userAccounts: false,  // Planned but not implemented.
};

/**
 * Checks if a feature is enabled.
 * @param {string} featureName - The name of the feature to check.
 * @returns {boolean} - True if the feature is enabled, false otherwise.
 */
export function isFeatureEnabled(featureName) {
    // If the feature is not defined in the config, assume it's enabled for backward compatibility.
    if (FEATURES.hasOwnProperty(featureName)) {
        return FEATURES[featureName];
    }
    return true;
}