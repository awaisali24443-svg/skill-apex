
/**
 * Renders a Markdown string into a basic HTML string.
 * This is a lightweight parser designed for the AI's output. It supports:
 * - Headings (e.g., # My Title)
 * - Unordered lists (e.g., * an item or - an item)
 * - Bold text (e.g., **important**)
 * - Inline code (e.g., `my_function()`)
 * - Fenced code blocks (e.g., ```javascript ... ```)
 * - Mermaid Diagrams (```mermaid ... ```)
 * 
 * SECURITY: Includes basic output sanitization to prevent XSS.
 * 
 * @param {string} markdown - The Markdown string to parse.
 * @returns {string} The resulting HTML string.
 */
export function render(markdown) {
    if (!markdown) return '';

    // 1. Basic Sanitization (Pre-render)
    // Remove script tags and dangerous attributes
    let safeMarkdown = markdown
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "")
        .replace(/<object\b[^>]*>([\s\S]*?)<\/object>/gim, "")
        .replace(/ on\w+="[^"]*"/g, ""); // Remove event handlers like onclick="..."

    const lines = safeMarkdown.split('\n');
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
                    // Render as a mermaid div
                    // Note: Mermaid library handles its own sanitization/parsing usually
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
                // Sanitize lang attribute
                codeBlockLang = line.trim().substring(3).trim().replace(/[^a-zA-Z0-9-]/g, ''); 
            }
            continue; // Move to next line
        }

        if (inCodeBlock) {
            // If mermaid, pass through (Mermaid needs raw text)
            if (codeBlockLang === 'mermaid') {
                // Basic check to prevent breaking out of div
                const cleanLine = line.replace(/<\/div>/gi, ''); 
                codeBlockContent.push(cleanLine);
            } else {
                // HTML escaping for code content
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
            if (inList) { 
                html += '</ul>';
                inList = false;
            }
            // Simple Heading
            html += `<h3>${processedLine.substring(2)}</h3>`;
        } else if (isListItem) {
            html += `<li>${processedLine.substring(2)}</li>`;
        } else if (processedLine) {
             if (inList) {
                html += '</ul>';
                inList = false;
            }
            html += `<p>${processedLine}</p>`;
        }
    }

    if (inList) {
        html += '</ul>';
    }
     if (inCodeBlock) {
         if (codeBlockLang === 'mermaid') {
             html += `<div class="mermaid">${codeBlockContent.join('\n')}</div>`;
         } else {
            html += `<pre data-lang="${codeBlockLang}"><code class="language-${codeBlockLang}">${codeBlockContent.join('\n')}</code></pre>`;
         }
    }

    return html;
}
