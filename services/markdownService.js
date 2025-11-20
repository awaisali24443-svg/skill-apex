/**
 * Renders a Markdown string into a basic HTML string.
 * This is a lightweight parser designed for the AI's output. It supports:
 * - Headings (e.g., # My Title)
 * - Unordered lists (e.g., * an item or - an item)
 * - Bold text (e.g., **important**)
 * - Inline code (e.g., `my_function()`)
 * - Fenced code blocks (e.g., ```javascript ... ```)
 * - Mermaid Diagrams (```mermaid ... ```)
 * @param {string} markdown - The Markdown string to parse.
 * @returns {string} The resulting HTML string.
 */
export function render(markdown) {
    if (!markdown) return '';

    const lines = markdown.split('\n');
    let html = '';
    let inCodeBlock = false;
    let inList = false;
    let codeBlockLang = '';
    let codeBlockContent = [];

    for (const line of lines) {
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                // End of code block
                if (codeBlockLang === 'mermaid') {
                    // Render as a mermaid div instead of a pre block
                    html += `<div class="mermaid">${codeBlockContent.join('\n')}</div>`;
                } else {
                    html += `<pre data-lang="${codeBlockLang}"><code class="language-${codeBlockLang}">${codeBlockContent.join('\n')}</code></pre>`;
                }
                inCodeBlock = false;
                codeBlockContent = [];
                codeBlockLang = '';
            } else {
                // Start of code block
                if (inList) { // Close list if we enter a code block
                    html += '</ul>';
                    inList = false;
                }
                inCodeBlock = true;
                codeBlockLang = line.trim().substring(3).trim(); // Get language
            }
            continue; // Move to next line
        }

        if (inCodeBlock) {
            // If mermaid, don't escape yet, let the library handle it or raw text
            if (codeBlockLang === 'mermaid') {
                codeBlockContent.push(line);
            } else {
                // Basic HTML escaping for code content
                const escapedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                codeBlockContent.push(escapedLine);
            }
            continue;
        }

        // Process non-code block lines
        let processedLine = line.trim()
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code>$1</code>');

        const isListItem = processedLine.startsWith('* ') || processedLine.startsWith('- ');

        if (isListItem && !inList) {
            html += '<ul>';
            inList = true;
        } else if (!isListItem && inList) {
            html += '</ul>';
            inList = false;
        }
        
        if (processedLine.startsWith('# ')) {
            if (inList) { // Close list before a heading
                html += '</ul>';
                inList = false;
            }
            html += `<h3>${processedLine.substring(2)}</h3>`;
        } else if (isListItem) {
            html += `<li>${processedLine.substring(2)}</li>`;
        } else if (processedLine) {
             if (inList) { // Close list before a paragraph
                html += '</ul>';
                inList = false;
            }
            html += `<p>${processedLine}</p>`;
        }
    }

    if (inList) { // Close any dangling list
        html += '</ul>';
    }
     if (inCodeBlock) { // Close any dangling code block
         if (codeBlockLang === 'mermaid') {
             html += `<div class="mermaid">${codeBlockContent.join('\n')}</div>`;
         } else {
            html += `<pre data-lang="${codeBlockLang}"><code class="language-${codeBlockLang}">${codeBlockContent.join('\n')}</code></pre>`;
         }
    }


    return html;
}