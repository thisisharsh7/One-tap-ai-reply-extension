/**
 * OneTap Reply Content Script
 * Handles DOM injection, page scanning, and reply generation for YouTube and LinkedIn
 */

class OneTapReply {
    constructor() {
        this.isYouTube = window.location.hostname.includes('youtube.com');
        this.isLinkedIn = window.location.hostname.includes('linkedin.com');
        this.activeUI = null;
        this.currentTarget = null;
        this.observerInstance = null;

        this.init();
    }

    /**
     * Initialize the extension
     */
    init() {
        if (!this.isYouTube && !this.isLinkedIn) return;

        console.log('[OneTap Reply] Initializing on:', window.location.hostname);

        // Wait for page to load then start observing
        this.waitForPageLoad().then(() => {
            this.startObserving();
            this.scanForCommentBoxes();
            this.startUrlChangeListener();
        });
    }

    /**
     * Wait for page to fully load
     */
    async waitForPageLoad() {
        return new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
    }

    /**
     * Start observing DOM changes for dynamic content
     */
    startObserving() {
        this.observerInstance = new MutationObserver((mutations) => {
            let shouldScan = false;

            mutations.forEach(mutation => {
                // Check if new nodes were added that might contain comment boxes
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (this.isCommentRelatedElement(node)) {
                            shouldScan = true;
                        }
                    }
                });
            });

            if (shouldScan) {
                // Debounce scanning to avoid excessive calls
                clearTimeout(this.scanTimeout);
                this.scanTimeout = setTimeout(() => this.scanForCommentBoxes(), 500);
            }
        });

        this.observerInstance.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Check if an element is related to comments
     */
    isCommentRelatedElement(element) {
        const commentSelectors = [
            // YouTube selectors
            '#comments',
            '#comment',
            'ytd-comment-thread-renderer',
            'ytd-comment-replies-renderer',

            // LinkedIn selectors
            '.comments-comments-list',
            '.comment',
            '.comments-comment-item',
            '.comments-comment-box'
        ];

        return commentSelectors.some(selector => {
            try {
                return element.matches && element.matches(selector) ||
                    element.querySelector && element.querySelector(selector);
            } catch (e) {
                return false;
            }
        });
    }

    /**
     * Scan page for comment input boxes and inject UI
     */
    scanForCommentBoxes() {
        const commentBoxes = this.findCommentBoxes();

        commentBoxes.forEach(box => {
            if (!box.hasAttribute('data-onetap-processed')) {
                this.injectUI(box);
                box.setAttribute('data-onetap-processed', 'true');
            }
        });
    }

    /**
     * Find comment input boxes on the current platform
     */
    findCommentBoxes() {
        let selectors = [];

        if (this.isYouTube) {
            selectors = [
                // Main comment box
                '#placeholder-area textarea',
                'div[id="contenteditable-root"]',
                // Reply boxes
                '#reply-button-end textarea',
                'ytd-comment-replies-renderer textarea'
            ];
        } else if (this.isLinkedIn) {
            selectors = [
                // Main comment boxes
                '.comments-comment-box .ql-editor',
                '.comments-comment-texteditor .ql-editor',
                // Reply boxes
                '.comments-reply-box .ql-editor',
                'div[data-placeholder*="comment"]'
            ];
        }

        const boxes = [];
        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (this.isValidCommentBox(el)) {
                        boxes.push(el);
                    }
                });
            } catch (e) {
                console.warn('[OneTap Reply] Invalid selector:', selector, e);
            }
        });

        return boxes;
    }

    /**
     * Validate if element is a proper comment input box
     */
    isValidCommentBox(element) {
        if (!element || !element.offsetParent) return false;

        // Check if element is visible and interactable
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    /**
     * Inject OneTap Reply UI near comment box
     */
    injectUI(commentBox) {
        try {
            // Find the appropriate container for the UI
            const container = this.findUIContainer(commentBox);
            if (!container) return;

            // Create floating UI button
            const floatingButton = this.createFloatingButton();

            // Position and insert the button
            this.positionUI(floatingButton, container);
            container.appendChild(floatingButton);

            // Add event listeners
            this.attachEventListeners(floatingButton, commentBox);

            console.log('[OneTap Reply] UI injected for comment box');
        } catch (error) {
            console.error('[OneTap Reply] Error injecting UI:', error);
        }
    }

    /**
     * Find appropriate container for UI insertion
     */
    findUIContainer(commentBox) {
        // Try to find a parent container that can hold our UI
        let container = commentBox.parentElement;
        let attempts = 0;

        while (container && attempts < 5) {
            // Look for a container with reasonable positioning
            const style = window.getComputedStyle(container);
            if (style.position === 'relative' || style.position === 'absolute') {
                return container;
            }
            container = container.parentElement;
            attempts++;
        }

        // Fallback: use the comment box's parent
        return commentBox.parentElement;
    }

    /**
     * Create the floating OneTap Reply button
     */
    createFloatingButton() {
        const button = document.createElement('div');
        button.className = 'onetap-floating-button';
        button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/>
        <path d="M8 10h8M8 14h4"/>
      </svg>
      <span>AI Reply</span>
    `;

        return button;
    }

    /**
     * Position UI relative to container
     */
    positionUI(uiElement, container) {
        // Set initial positioning classes
        uiElement.classList.add('onetap-positioned');

        // Add platform-specific positioning
        if (this.isYouTube) {
            uiElement.classList.add('onetap-youtube');
        } else if (this.isLinkedIn) {
            uiElement.classList.add('onetap-linkedin');
        }
    }

    /**
     * Attach event listeners to UI elements
     */
    attachEventListeners(button, commentBox) {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showReplyOptions(button, commentBox);
        });
    }

    /**
     * Show reply options panel
     */
    async showReplyOptions(button, commentBox) {
        // Remove any existing panels
        this.hideActiveUI();

        // Extract post content for context
        const postContent = this.extractPostContent(commentBox);

        // Create and show options panel
        const panel = this.createOptionsPanel(postContent, commentBox);
        button.parentElement.appendChild(panel);

        this.activeUI = panel;
        this.currentTarget = commentBox;

        // Add click outside listener to close panel
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside.bind(this));
        }, 100);
    }

    /**
     * Extract post content for reply context
     */
    extractPostContent(commentBox) {
        try {
            let postContent = '';

            if (this.isYouTube) {
                // Try to find video title and description
                const title = document.querySelector('h1.title yt-formatted-string, #title h1, .title .ytd-video-primary-info-renderer h1');
                const description = document.querySelector('#description-text, #description ytd-expandable-text');

                if (title) postContent += `Title: ${title.textContent.trim()}\n`;
                if (description) postContent += `Description: ${description.textContent.trim().substring(0, 500)}`;
            } else if (this.isLinkedIn) {
                // Try to find post content
                const post = this.findLinkedInPost(commentBox);
                if (post) {
                    const content = post.querySelector('.feed-shared-text, .attributed-text-segment-list__content');
                    if (content) postContent = content.textContent.trim().substring(0, 1000);
                }
            }

            return postContent || 'No post content available';
        } catch (error) {
            console.warn('[OneTap Reply] Error extracting post content:', error);
            return 'Unable to extract post content';
        }
    }

    /**
     * Find LinkedIn post container
     */
    findLinkedInPost(commentBox) {
        let element = commentBox;
        let attempts = 0;

        while (element && attempts < 10) {
            if (element.classList.contains('feed-shared-update-v2')) {
                return element;
            }
            element = element.parentElement;
            attempts++;
        }

        return null;
    }

    /**
     * Create reply options panel
     */
    createOptionsPanel(postContent, commentBox) {
        const panel = document.createElement('div');
        panel.className = 'onetap-options-panel';

        const tones = [
            { id: 'supportive', label: 'Supportive', icon: '💝' },
            { id: 'funny', label: 'Funny', icon: '😄' },
            { id: 'smart', label: 'Smart', icon: '🧠' },
            { id: 'question', label: 'Question', icon: '❓' }
        ];

        panel.innerHTML = `
      <div class="onetap-panel-header">
        <h3>Choose Reply Tone</h3>
        <button class="onetap-close-btn">&times;</button>
      </div>
      <div class="onetap-tone-buttons">
        ${tones.map(tone => `
          <button class="onetap-tone-btn" data-tone="${tone.id}">
            <span class="tone-icon">${tone.icon}</span>
            <span class="tone-label">${tone.label}</span>
          </button>
        `).join('')}
      </div>
      <div class="onetap-replies-container" style="display: none;">
        <div class="onetap-loading">Generating replies...</div>
        <div class="onetap-replies-list"></div>
      </div>
    `;

        // Add event listeners
        this.attachPanelListeners(panel, postContent, commentBox);

        return panel;
    }

    /**
     * Attach event listeners to options panel
     */
    attachPanelListeners(panel, postContent, commentBox) {
        // Close button
        const closeBtn = panel.querySelector('.onetap-close-btn');
        closeBtn.addEventListener('click', () => this.hideActiveUI());

        // Tone selection buttons
        const toneButtons = panel.querySelectorAll('.onetap-tone-btn');
        toneButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tone = btn.getAttribute('data-tone');
                this.generateAndShowReplies(panel, postContent, tone, commentBox);
            });
        });
    }

    /**
     * Generate and display reply suggestions
     */
    async generateAndShowReplies(panel, postContent, tone, commentBox) {
        const repliesContainer = panel.querySelector('.onetap-replies-container');
        const repliesList = panel.querySelector('.onetap-replies-list');
        const loading = panel.querySelector('.onetap-loading');

        // Show loading state
        repliesContainer.style.display = 'block';
        loading.style.display = 'block';
        repliesList.innerHTML = '';

        try {
            // Generate replies using the tone
            const replies = await this.generateReplies(postContent, tone);

            // Hide loading and show replies
            loading.style.display = 'none';
            this.displayReplies(repliesList, replies, commentBox);
        } catch (error) {
            console.error('[OneTap Reply] Error generating replies:', error);
            loading.textContent = 'Error generating replies. Please try again.';
        }
    }

    /**
     * Generate reply suggestions based on post content and tone
     * TODO: Integrate with OpenRouter API for actual AI generation
     */
    async generateReplies(postText, tone) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock reply generation - Replace this with actual API integration
        const mockReplies = {
            supportive: [
                "This is really inspiring! Thank you for sharing your perspective. 🙌",
                "I completely agree with your points. Well said!",
                "Great insight! This really resonates with me."
            ],
            funny: [
                "Haha, this made my day! 😂 Thanks for the entertainment!",
                "LOL, I wasn't expecting that twist! 🤣",
                "Comedy gold right here! More content like this please! 😄"
            ],
            smart: [
                "Fascinating analysis. Have you considered the implications of this on long-term trends?",
                "This aligns with recent research I've seen. The data seems to support your hypothesis.",
                "Intriguing perspective. What methodology did you use to reach this conclusion?"
            ],
            question: [
                "What led you to this conclusion? I'd love to understand your thought process.",
                "Can you elaborate on this point? It's really interesting.",
                "How did you first discover this? I'm curious about your experience."
            ]
        };

        return mockReplies[tone] || mockReplies.supportive;

        /* TODO: Replace mock with actual API integration
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'anthropic/claude-3-sonnet',
              messages: [
                {
                  role: 'system',
                  content: `Generate 3 ${tone} comment replies for this post. Keep each reply under 100 characters and authentic to the tone.`
                },
                {
                  role: 'user',
                  content: postText
                }
              ]
            })
          });
          
          const data = await response.json();
          return data.choices[0].message.content.split('\n').filter(reply => reply.trim());
        } catch (error) {
          console.error('[OneTap Reply] API Error:', error);
          throw error;
        }
        */
    }

    /**
     * Display generated replies in the panel
     */
    displayReplies(container, replies, commentBox) {
        container.innerHTML = replies.map((reply, index) => `
      <div class="onetap-reply-item" data-index="${index}">
        <div class="reply-text">${reply}</div>
        <button class="reply-use-btn">Use This Reply</button>
      </div>
    `).join('');

        // Add click listeners for reply selection
        const replyItems = container.querySelectorAll('.reply-use-btn');
        replyItems.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this.insertReply(replies[index], commentBox);
                this.hideActiveUI();
            });
        });
    }

    /**
     * Insert selected reply into comment box
     */
    insertReply(replyText, commentBox) {
        try {
            // Focus the comment box first
            commentBox.focus();

            if (this.isYouTube) {
                // YouTube uses contenteditable divs
                if (commentBox.contentEditable === 'true') {
                    commentBox.textContent = replyText;
                    // Trigger input event to notify YouTube
                    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                } else if (commentBox.tagName === 'TEXTAREA') {
                    commentBox.value = replyText;
                    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else if (this.isLinkedIn) {
                // LinkedIn uses Quill editor
                if (commentBox.classList.contains('ql-editor')) {
                    commentBox.innerHTML = `<p>${replyText}</p>`;
                    // Trigger input event
                    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    commentBox.textContent = replyText;
                    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }

            // Set cursor to end
            this.setCursorToEnd(commentBox);

            console.log('[OneTap Reply] Reply inserted successfully');
        } catch (error) {
            console.error('[OneTap Reply] Error inserting reply:', error);
        }
    }

    /**
     * Set cursor to end of content
     */
    setCursorToEnd(element) {
        try {
            const range = document.createRange();
            const selection = window.getSelection();

            if (element.childNodes.length > 0) {
                range.setStartAfter(element.lastChild);
            } else {
                range.setStart(element, 0);
            }

            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (error) {
            // Fallback for textarea elements
            if (element.setSelectionRange) {
                element.setSelectionRange(element.value.length, element.value.length);
            }
        }
    }

    /**
     * Handle clicks outside the panel to close it
     */
    handleClickOutside(event) {
        if (this.activeUI && !this.activeUI.contains(event.target)) {
            this.hideActiveUI();
        }
    }

    /**
     * Hide active UI panel
     */
    hideActiveUI() {
        if (this.activeUI) {
            this.activeUI.remove();
            this.activeUI = null;
            this.currentTarget = null;
            document.removeEventListener('click', this.handleClickOutside.bind(this));
        }
    }

    /**
     * Cleanup when extension is disabled or page is unloaded
     */
    cleanup() {
        if (this.observerInstance) {
            this.observerInstance.disconnect();
        }
        this.hideActiveUI();
        clearTimeout(this.scanTimeout);
    }

    /**
     * Start URL change listener to detect navigation
     */
    startUrlChangeListener() {
        let lastUrl = location.href;
        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                this.scanForCommentBoxes();
            }
        }, 1000); // Check every second
    }
}

// Initialize the extension when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.oneTapReply = new OneTapReply();
    });
} else {
    window.oneTapReply = new OneTapReply();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.oneTapReply) {
        window.oneTapReply.cleanup();
    }
});