/**
 * Renders a Markdown string into a basic HTML string.
 * This is a lightweight parser designed for the AI's output. It supports:
 * - Headings (e.g., # My Title)
 * - Unordered lists (e.g., * an item or - an item)
 * - Bold text (e.g., **important**)
 * - Inline code (e.g., `my_function()`)
 * @param {string} markdown - The Markdown string to parse.
 * @returns {string} The resulting HTML string.
 */
export function render(markdown) {
    if (!markdown) return '';

    let html = '';
    let inList = false;

    markdown.split('\n').forEach(line => {
        // Process inline styles first
        let processedLine = line.trim()
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code>$1</code>');

        const isListItem = processedLine.startsWith('* ') || processedLine.startsWith('- ');

        // Handle list state transitions
        if (isListItem && !inList) {
            html += '<ul>';
            inList = true;
        } else if (!isListItem && inList) {
            html += '</ul>';
            inList = false;
        }

        // Handle block-level elements
        if (processedLine.startsWith('# ')) {
            html += `<h3>${processedLine.substring(2)}</h3>`;
        } else if (isListItem) {
            html += `<li>${processedLine.substring(2)}</li>`;
        } else if (processedLine) {
            html += `<p>${processedLine}</p>`;
        }
    });

    // Close any open list at the end of the string
    if (inList) {
        html += '</ul>';
    }

    return html;
}
