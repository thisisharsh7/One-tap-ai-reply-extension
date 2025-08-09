/**
 * OneTap Reply Content Script - Context-Aware Version
 * Handles DOM injection, page scanning, and intelligent reply generation for YouTube and LinkedIn
 */

class OneTapReply {
    constructor() {
        this.isYouTube = window.location.hostname.includes('youtube.com');
        this.isLinkedIn = window.location.hostname.includes('linkedin.com');
        this.activeUI = null;
        this.currentTarget = null;
        this.observerInstance = null;

        // Free AI API configurations
        this.apiConfigs = {
            primary: {
                name: 'Hugging Face',
                url: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
                headers: {
                    'Authorization': 'Bearer hf_YOUR_FREE_TOKEN_HERE', // Replace with your HuggingFace token
                    'Content-Type': 'application/json'
                }
            },
            fallback: {
                name: 'OpenAI-like Free API',
                url: 'https://api.together.xyz/inference', // Free tier available
                headers: {
                    'Authorization': 'Bearer YOUR_TOGETHER_TOKEN_HERE',
                    'Content-Type': 'application/json'
                }
            }
        };

        this.init();
    }

    /**
     * Initialize the extension
     */
    init() {
        if (!this.isYouTube && !this.isLinkedIn) return;

        console.log('[OneTap Reply] Initializing context-aware version on:', window.location.hostname);

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

            console.log('[OneTap Reply] Context-aware UI injected for comment box');
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

        // Extract comprehensive context
        const context = await this.extractComprehensiveContext(commentBox);

        // Create and show options panel
        const panel = this.createOptionsPanel(context, commentBox);
        button.parentElement.appendChild(panel);

        this.activeUI = panel;
        this.currentTarget = commentBox;

        // Add click outside listener to close panel
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside.bind(this));
        }, 100);
    }

    /**
     * Extract comprehensive context including post content, existing comments, and metadata
     */
    async extractComprehensiveContext(commentBox) {
        const context = {
            platform: this.isYouTube ? 'YouTube' : 'LinkedIn',
            postContent: '',
            postTitle: '',
            authorInfo: '',
            existingComments: [],
            timestamp: new Date().toISOString(),
            sentiment: 'neutral'
        };

        try {
            if (this.isYouTube) {
                context.postTitle = this.getYouTubeTitle();
                context.postContent = this.getYouTubeDescription();
                context.authorInfo = this.getYouTubeChannelInfo();
                context.existingComments = this.getYouTubeComments();
                context.videoStats = this.getYouTubeStats();
            } else if (this.isLinkedIn) {
                const postData = this.getLinkedInPostData(commentBox);
                context.postContent = postData.content;
                context.authorInfo = postData.author;
                context.existingComments = postData.comments;
                context.postType = postData.type;
            }

            // Analyze sentiment of the post
            context.sentiment = this.analyzeSentiment(context.postContent);

            // Extract key topics
            context.topics = this.extractTopics(context.postContent);

        } catch (error) {
            console.warn('[OneTap Reply] Error extracting context:', error);
            context.postContent = 'Unable to extract post content';
        }

        return context;
    }

    /**
     * Get YouTube video title
     */
    getYouTubeTitle() {
        const titleSelectors = [
            'h1.title yt-formatted-string',
            '#title h1',
            '.ytd-video-primary-info-renderer h1',
            'h1[class*="title"]'
        ];

        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element.textContent.trim();
            }
        }
        return '';
    }

    /**
     * Get YouTube video description
     */
    getYouTubeDescription() {
        const descSelectors = [
            '#description-text',
            '#description ytd-expandable-text',
            '.ytd-expandable-video-description-body-renderer',
            '#description-inline-expander'
        ];

        for (const selector of descSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element.textContent.trim().substring(0, 1000);
            }
        }
        return '';
    }

    /**
     * Get YouTube channel information
     */
    getYouTubeChannelInfo() {
        const channelName = document.querySelector('#channel-name a, .ytd-channel-name a');
        const subscriberCount = document.querySelector('#owner-sub-count');

        return {
            name: channelName ? channelName.textContent.trim() : '',
            subscribers: subscriberCount ? subscriberCount.textContent.trim() : ''
        };
    }

    /**
     * Get YouTube video statistics
     */
    getYouTubeStats() {
        const views = document.querySelector('.view-count');
        const likes = document.querySelector('#segmented-like-button button');

        return {
            views: views ? views.textContent.trim() : '',
            likes: likes ? likes.getAttribute('aria-label') : ''
        };
    }

    /**
     * Get existing YouTube comments for context
     */
    getYouTubeComments() {
        const comments = [];
        const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');

        // Get top 5 comments for context
        for (let i = 0; i < Math.min(5, commentElements.length); i++) {
            const commentText = commentElements[i].querySelector('#content-text');
            const author = commentElements[i].querySelector('#author-text');

            if (commentText && author) {
                comments.push({
                    author: author.textContent.trim(),
                    text: commentText.textContent.trim().substring(0, 200),
                    likes: this.getCommentLikes(commentElements[i])
                });
            }
        }

        return comments;
    }

    /**
     * Get comment likes count
     */
    getCommentLikes(commentElement) {
        const likeButton = commentElement.querySelector('#vote-count-middle');
        return likeButton ? likeButton.textContent.trim() : '0';
    }

    /**
     * Get LinkedIn post data
     */
    getLinkedInPostData(commentBox) {
        const postElement = this.findLinkedInPost(commentBox);
        const data = {
            content: '',
            author: '',
            comments: [],
            type: 'post'
        };

        if (postElement) {
            // Get post content
            const contentElement = postElement.querySelector('.feed-shared-text, .attributed-text-segment-list__content');
            if (contentElement) {
                data.content = contentElement.textContent.trim();
            }

            // Get author info
            const authorElement = postElement.querySelector('.feed-shared-actor__name');
            if (authorElement) {
                data.author = authorElement.textContent.trim();
            }

            // Get existing comments
            const commentElements = postElement.querySelectorAll('.comments-comment-item');
            for (let i = 0; i < Math.min(3, commentElements.length); i++) {
                const commentText = commentElements[i].querySelector('.attributed-text-segment-list__content');
                const commentAuthor = commentElements[i].querySelector('.comments-post-meta__name');

                if (commentText && commentAuthor) {
                    data.comments.push({
                        author: commentAuthor.textContent.trim(),
                        text: commentText.textContent.trim().substring(0, 150)
                    });
                }
            }
        }

        return data;
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
     * Analyze sentiment of text using simple keyword analysis
     */
    analyzeSentiment(text) {
        if (!text) return 'neutral';

        const positiveWords = ['love', 'great', 'awesome', 'amazing', 'excellent', 'wonderful', 'fantastic', 'good', 'nice', 'happy', 'excited', 'thrilled', 'perfect', 'brilliant'];
        const negativeWords = ['hate', 'bad', 'terrible', 'awful', 'horrible', 'sad', 'angry', 'disappointed', 'frustrated', 'annoyed', 'worried', 'concerned'];

        const words = text.toLowerCase().split(/\W+/);
        let positiveCount = 0;
        let negativeCount = 0;

        words.forEach(word => {
            if (positiveWords.includes(word)) positiveCount++;
            if (negativeWords.includes(word)) negativeCount++;
        });

        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
    }

    /**
     * Extract key topics from text
     */
    extractTopics(text) {
        if (!text) return [];

        const topicWords = text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'would', 'there', 'could', 'other'].includes(word));

        // Get word frequency
        const wordCount = {};
        topicWords.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });

        // Return top 5 most frequent words as topics
        return Object.entries(wordCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }

    /**
     * Create reply options panel
     */
    createOptionsPanel(context, commentBox) {
        const panel = document.createElement('div');
        panel.className = 'onetap-options-panel';

        const tones = [
            { id: 'supportive', label: 'Supportive', icon: '💝', desc: 'Encouraging and positive' },
            { id: 'analytical', label: 'Analytical', icon: '🧠', desc: 'Thoughtful and insightful' },
            { id: 'conversational', label: 'Casual', icon: '💬', desc: 'Friendly and relaxed' },
            { id: 'question', label: 'Curious', icon: '❓', desc: 'Ask engaging questions' },
            { id: 'humorous', label: 'Funny', icon: '😄', desc: 'Light and entertaining' },
            { id: 'professional', label: 'Professional', icon: '👔', desc: 'Business appropriate' }
        ];

        panel.innerHTML = `
      <div class="onetap-panel-header">
        <h3>AI-Powered Context Reply</h3>
        <div class="context-preview">
          <small>Analyzing: ${context.postTitle ? context.postTitle.substring(0, 50) + '...' : 'Post content'}</small>
          <span class="sentiment-badge sentiment-${context.sentiment}">${context.sentiment}</span>
        </div>
        <button class="onetap-close-btn">&times;</button>
      </div>
      <div class="onetap-tone-buttons">
        ${tones.map(tone => `
          <button class="onetap-tone-btn" data-tone="${tone.id}" title="${tone.desc}">
            <span class="tone-icon">${tone.icon}</span>
            <span class="tone-label">${tone.label}</span>
          </button>
        `).join('')}
      </div>
      <div class="onetap-replies-container" style="display: none;">
        <div class="onetap-loading">
          <div class="loading-spinner"></div>
          <span>Crafting contextual reply...</span>
        </div>
        <div class="onetap-replies-list"></div>
        <div class="regenerate-section" style="display: none;">
          <button class="regenerate-btn">🔄 Generate Different Replies</button>
        </div>
      </div>
    `;

        // Add event listeners
        this.attachPanelListeners(panel, context, commentBox);

        return panel;
    }

    /**
     * Attach event listeners to options panel
     */
    attachPanelListeners(panel, context, commentBox) {
        // Close button
        const closeBtn = panel.querySelector('.onetap-close-btn');
        closeBtn.addEventListener('click', () => this.hideActiveUI());

        // Tone selection buttons
        const toneButtons = panel.querySelectorAll('.onetap-tone-btn');
        toneButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Add active state
                toneButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const tone = btn.getAttribute('data-tone');
                this.generateAndShowReplies(panel, context, tone, commentBox);
            });
        });
    }

    /**
     * Generate and display context-aware reply suggestions
     */
    async generateAndShowReplies(panel, context, tone, commentBox) {
        const repliesContainer = panel.querySelector('.onetap-replies-container');
        const repliesList = panel.querySelector('.onetap-replies-list');
        const loading = panel.querySelector('.onetap-loading');
        const regenerateSection = panel.querySelector('.regenerate-section');

        // Show loading state
        repliesContainer.style.display = 'block';
        loading.style.display = 'flex';
        repliesList.innerHTML = '';
        regenerateSection.style.display = 'none';

        try {
            // Generate context-aware replies
            const replies = await this.generateContextAwareReplies(context, tone);

            // Hide loading and show replies
            loading.style.display = 'none';
            regenerateSection.style.display = 'block';
            this.displayReplies(repliesList, replies, commentBox);

            // Add regenerate functionality
            const regenerateBtn = regenerateSection.querySelector('.regenerate-btn');
            regenerateBtn.onclick = () => this.generateAndShowReplies(panel, context, tone, commentBox);

        } catch (error) {
            console.error('[OneTap Reply] Error generating replies:', error);
            loading.innerHTML = `
                <div class="error-message">
                    <span>⚠️ Error generating replies</span>
                    <small>Falling back to smart templates...</small>
                </div>
            `;

            // Fallback to template-based replies
            setTimeout(async () => {
                try {
                    const fallbackReplies = this.generateFallbackReplies(context, tone);
                    loading.style.display = 'none';
                    this.displayReplies(repliesList, fallbackReplies, commentBox);
                    regenerateSection.style.display = 'block';
                } catch (fallbackError) {
                    loading.innerHTML = '<span class="error">Unable to generate replies. Please try again.</span>';
                }
            }, 1500);
        }
    }

    /**
     * Generate context-aware replies using free AI APIs
     */
    async generateContextAwareReplies(context, tone) {
        const prompt = this.buildContextPrompt(context, tone);

        // Try primary API first
        try {
            return await this.callAIAPI(this.apiConfigs.primary, prompt);
        } catch (error) {
            console.warn('[OneTap Reply] Primary API failed, trying fallback:', error);

            // Try fallback API
            try {
                return await this.callAIAPI(this.apiConfigs.fallback, prompt);
            } catch (fallbackError) {
                console.warn('[OneTap Reply] Fallback API failed:', fallbackError);
                throw new Error('All APIs failed');
            }
        }
    }

    /**
     * Build context-aware prompt for AI
     */
    buildContextPrompt(context, tone) {
        let prompt = `Generate 3 ${tone} replies for a ${context.platform} ${context.postType || 'post'}.\n\n`;

        if (context.postTitle) {
            prompt += `Title: "${context.postTitle}"\n`;
        }

        if (context.postContent) {
            prompt += `Content: "${context.postContent.substring(0, 500)}"\n`;
        }

        if (context.authorInfo && context.authorInfo.name) {
            prompt += `Author: ${context.authorInfo.name}\n`;
        }

        if (context.topics.length > 0) {
            prompt += `Key topics: ${context.topics.join(', ')}\n`;
        }

        if (context.sentiment !== 'neutral') {
            prompt += `Post sentiment: ${context.sentiment}\n`;
        }

        if (context.existingComments.length > 0) {
            prompt += `\nTop comments:\n`;
            context.existingComments.slice(0, 2).forEach((comment, i) => {
                prompt += `${i + 1}. "${comment.text}"\n`;
            });
        }

        prompt += `\nGenerate 3 ${tone} replies that:\n`;

        switch (tone) {
            case 'supportive':
                prompt += '- Show encouragement and positivity\n- Acknowledge the content meaningfully\n- Add personal touch without being fake';
                break;
            case 'analytical':
                prompt += '- Provide thoughtful insights\n- Ask intelligent questions\n- Reference specific points from the content';
                break;
            case 'conversational':
                prompt += '- Sound natural and friendly\n- Use casual language\n- Share relatable thoughts or experiences';
                break;
            case 'question':
                prompt += '- Ask engaging, specific questions\n- Show genuine curiosity\n- Reference the content directly';
                break;
            case 'humorous':
                prompt += '- Add appropriate humor or wit\n- Keep it light and fun\n- Avoid offensive content';
                break;
            case 'professional':
                prompt += '- Maintain professional tone\n- Offer constructive insights\n- Network appropriately';
                break;
        }

        prompt += '\n\nKeep each reply under 150 characters and make them sound human and authentic. Return only the 3 replies, one per line.';

        return prompt;
    }

    /**
     * Call AI API with the prompt
     */
    async callAIAPI(apiConfig, prompt) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
            let requestBody;

            if (apiConfig.name === 'Hugging Face') {
                requestBody = {
                    inputs: prompt,
                    parameters: {
                        max_length: 200,
                        temperature: 0.7,
                        do_sample: true
                    }
                };
            } else {
                // Generic OpenAI-like API format
                requestBody = {
                    model: 'meta-llama/Llama-2-7b-chat-hf',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that generates authentic, human-like social media replies.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 200,
                    temperature: 0.7
                };
            }

            const response = await fetch(apiConfig.url, {
                method: 'POST',
                headers: apiConfig.headers,
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Parse response based on API format
            let replies;
            if (apiConfig.name === 'Hugging Face') {
                // HuggingFace format
                replies = data[0]?.generated_text?.split('\n').filter(line => line.trim()) || [];
            } else {
                // OpenAI-like format
                const content = data.choices?.[0]?.message?.content || data.generated_text || '';
                replies = content.split('\n').filter(line => line.trim());
            }

            // Ensure we have exactly 3 replies
            replies = replies.slice(0, 3);
            while (replies.length < 3) {
                replies.push(`Great ${tone} reply about this topic!`);
            }

            return replies;

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Generate fallback replies using smart templates
     */
    generateFallbackReplies(context, tone) {
        const templates = {
            supportive: [
                `Really appreciate you sharing this${context.postTitle ? ' about ' + context.topics[0] : ''}! ${context.sentiment === 'positive' ? 'Your enthusiasm is contagious! 🌟' : 'Thanks for the thoughtful perspective.'}`,
                `This resonates with me so much${context.topics.length > 0 ? ', especially the point about ' + context.topics[0] : ''}. Keep up the great work! 💪`,
                `Love seeing content like this${context.authorInfo?.name ? ' from ' + context.authorInfo.name.split(' ')[0] : ''}. ${context.sentiment === 'positive' ? 'Your positivity is inspiring!' : 'Really valuable insights here.'}`
            ],
            analytical: [
                `Interesting perspective${context.topics.length > 0 ? ' on ' + context.topics[0] : ''}. Have you considered how this might impact ${context.topics[1] || 'the broader industry'}?`,
                `The point about ${context.topics[0] || 'this topic'} is particularly compelling. What led you to this conclusion?`,
                `This aligns with some recent trends I've noticed${context.topics.length > 0 ? ' in ' + context.topics[0] : ''}. Would love to hear more about your experience with this.`
            ],
            conversational: [
                `Totally get what you mean${context.topics.length > 0 ? ' about ' + context.topics[0] : ''}! ${context.sentiment === 'positive' ? 'Had a similar experience recently 😊' : 'Been thinking about this too lately.'}`,
                `This is so relatable${context.authorInfo?.name ? ' ' + context.authorInfo.name.split(' ')[0] : ''}! ${context.topics.length > 0 ? context.topics[0].charAt(0).toUpperCase() + context.topics[0].slice(1) + ' is such a hot topic right now.' : 'Thanks for sharing your thoughts.'}`,
                `Love this take${context.topics.length > 0 ? ' on ' + context.topics[0] : ''}! Mind if I ask what got you interested in this area?`
            ],
            question: [
                `Really curious about your thoughts on ${context.topics[0] || 'this topic'}. What's been your experience with it?`,
                `This is fascinating! How did you first get involved with ${context.topics[0] || 'this area'}?`,
                `Great insights${context.authorInfo?.name ? ' ' + context.authorInfo.name.split(' ')[0] : ''}! What would you say is the biggest challenge in ${context.topics[0] || 'this field'} right now?`
            ],
            humorous: [
                `${context.sentiment === 'positive' ? 'Your enthusiasm is infectious! 😄' : 'Well, that escalated quickly! 😅'} ${context.topics.length > 0 ? 'The ' + context.topics[0] + ' struggle is real!' : 'Can totally relate to this!'}`,
                `Plot twist: I was just thinking about this exact thing! ${context.topics.length > 0 ? 'Great minds think about ' + context.topics[0] + ' apparently 🧠' : 'Universe works in mysterious ways! 🌟'}`,
                `Not me reading this and nodding like I'm in a meeting 😂 ${context.topics.length > 0 ? context.topics[0].charAt(0).toUpperCase() + context.topics[0].slice(1) + ' hits different!' : 'So accurate it hurts!'}`
            ],
            professional: [
                `Thank you for sharing these insights${context.topics.length > 0 ? ' on ' + context.topics[0] : ''}. This perspective adds valuable context to the current industry discussion.`,
                `Excellent analysis${context.authorInfo?.name ? ', ' + context.authorInfo.name.split(' ')[0] : ''}. The point about ${context.topics[0] || 'this approach'} particularly resonates with current best practices.`,
                `This contributes meaningfully to the conversation around ${context.topics[0] || 'this topic'}. Would be interested to connect and discuss further.`
            ]
        };

        return templates[tone] || templates.conversational;
    }

    /**
     * Display generated replies in the panel
     */
    displayReplies(container, replies, commentBox) {
        container.innerHTML = replies.map((reply, index) => `
      <div class="onetap-reply-item" data-index="${index}">
        <div class="reply-text">${this.escapeHtml(reply)}</div>
        <div class="reply-actions">
          <button class="reply-use-btn">✓ Use This Reply</button>
          <button class="reply-edit-btn">✏️ Edit</button>
          <button class="reply-copy-btn">📋 Copy</button>
        </div>
        <div class="reply-edit-area" style="display: none;">
          <textarea class="reply-edit-input">${this.escapeHtml(reply)}</textarea>
          <div class="edit-actions">
            <button class="save-edit-btn">Save</button>
            <button class="cancel-edit-btn">Cancel</button>
          </div>
        </div>
      </div>
    `).join('');

        // Add click listeners for reply actions
        container.querySelectorAll('.reply-use-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this.insertReply(replies[index], commentBox);
                this.hideActiveUI();
            });
        });

        // Edit functionality
        container.querySelectorAll('.reply-edit-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const replyItem = btn.closest('.onetap-reply-item');
                const editArea = replyItem.querySelector('.reply-edit-area');
                const replyText = replyItem.querySelector('.reply-text');

                editArea.style.display = 'block';
                replyText.style.display = 'none';
                editArea.querySelector('.reply-edit-input').focus();
            });
        });

        // Save edit functionality
        container.querySelectorAll('.save-edit-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const replyItem = btn.closest('.onetap-reply-item');
                const editArea = replyItem.querySelector('.reply-edit-area');
                const replyText = replyItem.querySelector('.reply-text');
                const newText = editArea.querySelector('.reply-edit-input').value;

                replyText.textContent = newText;
                replies[index] = newText; // Update the array

                editArea.style.display = 'none';
                replyText.style.display = 'block';
            });
        });

        // Cancel edit functionality
        container.querySelectorAll('.cancel-edit-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const replyItem = btn.closest('.onetap-reply-item');
                const editArea = replyItem.querySelector('.reply-edit-area');
                const replyText = replyItem.querySelector('.reply-text');

                editArea.style.display = 'none';
                replyText.style.display = 'block';
            });
        });

        // Copy functionality
        container.querySelectorAll('.reply-copy-btn').forEach((btn, index) => {
            btn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(replies[index]);
                    btn.textContent = '✓ Copied';
                    setTimeout(() => {
                        btn.innerHTML = '📋 Copy';
                    }, 2000);
                } catch (error) {
                    console.error('Failed to copy text:', error);
                }
            });
        });
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
                    commentBox.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (commentBox.tagName === 'TEXTAREA') {
                    commentBox.value = replyText;
                    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                    commentBox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (this.isLinkedIn) {
                // LinkedIn uses Quill editor
                if (commentBox.classList.contains('ql-editor')) {
                    commentBox.innerHTML = `<p>${replyText}</p>`;
                    // Trigger input event
                    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                    commentBox.dispatchEvent(new Event('blur', { bubbles: true }));
                } else {
                    commentBox.textContent = replyText;
                    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }

            // Set cursor to end
            this.setCursorToEnd(commentBox);

            // Track usage for analytics (optional)
            this.trackUsage('reply_inserted', {
                platform: this.isYouTube ? 'youtube' : 'linkedin',
                replyLength: replyText.length
            });

            console.log('[OneTap Reply] Context-aware reply inserted successfully');
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
     * Track usage analytics (implement based on your needs)
     */
    trackUsage(action, data) {
        // You can implement analytics tracking here
        console.log('[OneTap Reply] Analytics:', action, data);
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
                console.log('[OneTap Reply] URL changed, rescanning...');
                // Clear existing processed markers
                document.querySelectorAll('[data-onetap-processed]').forEach(el => {
                    el.removeAttribute('data-onetap-processed');
                });
                // Rescan after navigation
                setTimeout(() => this.scanForCommentBoxes(), 2000);
            }
        }, 1000); // Check every second
    }

    /**
     * Get API configuration from storage or user input
     */
    async setupAPIKeys() {
        // Check if API keys are stored
        const storedConfig = localStorage.getItem('onetap-api-config');

        if (!storedConfig) {
            // Prompt user for API keys on first use
            const huggingFaceToken = prompt('Enter your Hugging Face API token (free from huggingface.co/settings/tokens):');

            if (huggingFaceToken) {
                this.apiConfigs.primary.headers.Authorization = `Bearer ${huggingFaceToken}`;
                localStorage.setItem('onetap-api-config', JSON.stringify({
                    huggingFace: huggingFaceToken,
                    setupDate: new Date().toISOString()
                }));
            }
        } else {
            const config = JSON.parse(storedConfig);
            this.apiConfigs.primary.headers.Authorization = `Bearer ${config.huggingFace}`;
        }
    }
}

// Add CSS styles for the enhanced UI
const styles = `
.onetap-floating-button {
    position: absolute;
    top: -35px;
    right: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    transition: all 0.3s ease;
    z-index: 10000;
}

.onetap-floating-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
}

.onetap-options-panel {
    position: absolute;
    top: -10px;
    right: 0;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    padding: 0;
    min-width: 380px;
    max-width: 450px;
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.onetap-panel-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px 12px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
}

.onetap-panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}

.context-preview {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
}

.context-preview small {
    opacity: 0.9;
    font-size: 11px;
    max-width: 150px;
    text-align: right;
}

.sentiment-badge {
    background: rgba(255,255,255,0.2);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 500;
}

.sentiment-positive { background: rgba(34,197,94,0.3) !important; }
.sentiment-negative { background: rgba(239,68,68,0.3) !important; }
.sentiment-neutral { background: rgba(107,114,128,0.3) !important; }

.onetap-close-btn {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
}

.onetap-close-btn:hover {
    background: rgba(255,255,255,0.1);
}

.onetap-tone-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 16px 20px;
    background: #f8fafc;
}

.onetap-tone-btn {
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    transition: all 0.2s ease;
    font-size: 12px;
}

.onetap-tone-btn:hover {
    border-color: #667eea;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.onetap-tone-btn.active {
    border-color: #667eea;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.tone-icon {
    font-size: 18px;
}

.tone-label {
    font-weight: 500;
}

.onetap-replies-container {
    border-top: 1px solid #e2e8f0;
}

.onetap-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px 20px;
    color: #64748b;
    font-size: 14px;
}

.loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top: 2px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.error-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
}

.error-message small {
    font-size: 12px;
    opacity: 0.7;
}

.onetap-replies-list {
    padding: 16px 20px;
}

.onetap-reply-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
}

.onetap-reply-item:last-child {
    margin-bottom: 0;
}

.reply-text {
    font-size: 14px;
    line-height: 1.4;
    color: #1e293b;
    margin-bottom: 8px;
}

.reply-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.reply-actions button {
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
}

.reply-use-btn {
    background: #10b981 !important;
    color: white !important;
    border-color: #10b981 !important;
}

.reply-use-btn:hover {
    background: #059669 !important;
}

.reply-actions button:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
}

.reply-edit-area {
    margin-top: 8px;
}

.reply-edit-input {
    width: 100%;
    min-height: 60px;
    padding: 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.4;
    resize: vertical;
}

.edit-actions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
}

.save-edit-btn {
    background: #3b82f6 !important;
    color: white !important;
    border-color: #3b82f6 !important;
}

.regenerate-section {
    padding: 12px 20px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
    border-radius: 0 0 12px 12px;
}

.regenerate-btn {
    width: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.regenerate-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

/* Platform-specific positioning */
.onetap-youtube .onetap-floating-button {
    top: -40px;
}

.onetap-linkedin .onetap-floating-button {
    top: -35px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
    .onetap-options-panel {
        background: #1f2937;
        border-color: #374151;
    }
    
    .onetap-tone-buttons {
        background: #111827;
    }
    
    .onetap-tone-btn {
        background: #374151;
        border-color: #4b5563;
        color: #f3f4f6;
    }
    
    .onetap-reply-item {
        background: #374151;
        border-color: #4b5563;
    }
    
    .reply-text {
        color: #f3f4f6;
    }
    
    .onetap-loading {
        color: #d1d5db;
    }
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

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

// Setup API keys on first run
setTimeout(() => {
    if (window.oneTapReply) {
        window.oneTapReply.setupAPIKeys();
    }
}, 2000);