const easeInOutQuad = (t) => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
};

class VirtuaList {
    constructor(container, config) {
        this.container = container;
        this.scroller = document.createElement('div');
        this.scroller.style.position = 'absolute';
        this.scroller.style.opacity = '0';
        this.container.style.overflow = 'auto';
        this.container.style.position = 'relative';
        this.container.innerHTML = '';
        this.container.appendChild(this.scroller);

        this.renderingAnimationFrame = null;
        this.cancelScrollAnimation = null;
        this.scrollToIndexAnimationFrame = null;
        this.queued = false;
        this.scrollHandler = this.handleScroll.bind(this);
        this.container.addEventListener('scroll', this.scrollHandler, { passive: true });

        this.lastStart = null;
        this.lastSize = this.getViewportSize();
        this.resizeHandler = this.handleResize.bind(this);
        this.resizeObserver = new ResizeObserver(this.resizeHandler);
        this.resizeObserver.observe(this.container);

        this.renderedItems = new Map();

        this.refresh(config);
    }

    handleScroll() {
        const scrollPos = this.getScrollPosition();
        if (this.lastRepaint === -1 || scrollPos === this.lastRepaint) return;

        const diff = Math.abs(scrollPos - this.lastRepaint);
        const averageSize = this.calcAverageSize();
        if (diff <= averageSize) return;

        this.scheduleRender();
    }

    handleResize(entries) {
        const [entry] = entries;
        const newSize = this.horizontal ? entry.contentRect.width : entry.contentRect.height;
        if (this.lastSize === newSize) return;

        const diff = Math.abs(newSize - this.lastSize);
        const averageSize = this.calcAverageSize();
        if (diff <= averageSize) return;

        this.lastSize = newSize;
        this.scheduleRender(true);
    }

    scheduleRender(force) {
        if (this.queued) {
            if (force) {
                this.lastStart = -1; // forcing a render on the next queued animation frame
            }

            return;
        }

        this.queued = true;
        this.scrollAnimationFrame = requestAnimationFrame(() => {
            this.queued = false;
            this.render(force);
        });
    }

    render(force) {
        const scrollPos = this.getScrollPosition();
        const screenItems = this.calcScreenItems();
        const bufferItems = Math.max(this.buffer ?? 0, screenItems * 3);

        let start = 0;
        while (this.positions[start] < scrollPos && start < this.totalItems - 1) {
            start++;
        }
        start = Math.max(0, start - Math.floor(bufferItems / 2));

        if (!force && this.lastStart === start) return;
        this.lastStart = start;

        let end = Math.min(this.totalItems, start + screenItems + bufferItems);

        this.renderedItems.clear();

        const fragment = document.createDocumentFragment();
        fragment.appendChild(this.scroller);

        for (let i = start; i < end; i++) {
            const item = this.getItem(i);
            const height = this.getHeightFromItem(item);
            this.updateHeight(i, height);
            const element = this.getElementFromItem(item);
            this.setElementStyle(element, i);
            fragment.appendChild(element);
        }

        this.updateScrollerStyle();

        if (this.applyPatch) {
            this.applyPatch(this.container, fragment);
        } else {
            this.container.innerHTML = '';
            this.container.appendChild(fragment);
        }

        this.lastRepaint = scrollPos;
        this.afterRender?.();
    }

    triggerForcedRender(immediate) {
        if (immediate) {
            this.render(true);
        } else {
            this.scheduleRender(true);
        }
    }

    setElementStyle(element, index) {
        const pos = this.positions[index];

        element.style.position = 'absolute';

        if (this.horizontal) {
            element.style.left = pos + 'px';
        } else {
            element.style.top = pos + 'px';
        }
    }

    updateScrollerStyle() {
        if (this.lastScrollerHeight === this.totalHeight) return;

        if (this.horizontal) {
            this.scroller.style.width = this.totalHeight + 'px';
        } else {
            this.scroller.style.height = this.totalHeight + 'px';
        }

        this.lastScrollerHeight = this.totalHeight;
    }

    /**
     * Updates a single item in the list without re-rendering the whole list,
     * unless the item's height has changed.
     *
     * @param {number} index - Index of the item to update.
     * @param {boolean} [immediate=false] - If true, forces immediate re-render if required.
     */
    updateItem(index, immediate) {
        const oldElement = this.getElementAtIndex(index);
        if (!oldElement) return;

        // this.cache.delete(index);
        const item = this.getItem(index);
        const prevHeight = this.heightCache[index];
        const newHeight = this.getHeightFromItem(item);
        if (newHeight !== prevHeight) {
            this.triggerForcedRender(immediate);
            return;
        }

        const newElement = this.getElementFromItem(item);
        this.setElementStyle(newElement, index);
        this.container.replaceChild(newElement, oldElement);
    }

    /**
     * Re-initializes the list with new or existing config.
     * Resets positions and triggers a full re-render.
     *
     * @param {object} config - New configuration options (same as constructor).
     * @param {boolean} [immediate=false] - If true, rendering is forced immediately.
     */
    refresh(config = this.config, immediate) {
        const {
            totalItems,
            itemHeight,
            generate,
            buffer,
            horizontal = false
        } = config;

        if (this.totalItems !== totalItems || this.defaultItemHeight !== itemHeight) {
            this.positions = new Array(totalItems);
            this.heightCache = new Array(totalItems);
            for (let i = 0, pos = 0; i < totalItems; i++) {
                this.heightCache[i] = itemHeight;
                this.positions[i] = pos;
                pos += itemHeight;
            }
            this.totalHeight = this.positions[totalItems - 1] + itemHeight;
        }

        if (this.horizontal !== horizontal || this.totalItems !== totalItems) {
            if (this.horizontal) {
                this.scroller.style.width = this.totalHeight + 'px';
                this.scroller.style.height = '100%';
            } else {
                this.scroller.style.height = this.totalHeight + 'px';
                this.scroller.style.width = '100%';
            }
        }

        this.totalItems = totalItems;
        this.defaultItemHeight = itemHeight;
        this.generate = generate;
        this.buffer = buffer;
        this.horizontal = horizontal;

        // this.cache = new Map();
        this.lastRepaint = -1;
        this.lastStart = -1;
        this.lastScrollerHeight = this.totalHeight;

        this.config = config;

        this.triggerForcedRender(immediate);
    }

    /**
     * Adds a new item at the specified index.
     * Shifts positions and heights accordingly and triggers a render if the index is visible.
     *
     * @param {number} index - Index at which to insert the new item.
     * @param {boolean} [immediate=false] - If true, forces immediate render. Otherwise, batches rendering.
     */
    addItem(index, immediate) {
        if (index < 0 || index > this.totalItems) return;

        const needsRender = this.renderedItems.has(index);
        this.totalItems += 1;

        let tempHeight = this.defaultItemHeight;
        let tempPosition = index === 0 ? 0 : this.positions[index - 1] + this.heightCache[index - 1];
        // let tempCache = undefined;

        for (let i = index; i < this.totalItems; i++) {
            const nextHeight = this.heightCache[i];
            const nextPosition = this.positions[i];
            // const nextCache = this.cache.get(i);

            this.heightCache[i] = tempHeight;
            this.positions[i] = tempPosition;
            // this.cache.set(i, tempCache);

            tempHeight = nextHeight;
            tempPosition = nextPosition + (nextHeight ?? this.defaultItemHeight);
            // tempCache = nextCache;
        }

        this.totalHeight += this.defaultItemHeight;

        if (needsRender) {
            this.triggerForcedRender(immediate);
        } else {
            this.updateScrollerStyle();
        }
    }

    getItem(index) {
        // if (this.cache.has(index)) return this.cache.get(index);
        
        const item = this.generate(index);
        this.renderedItems.set(index, item);
        // this.cache.set(index, item);

        return item;
    }

    getElementAtIndex(index) {
        const item = this.renderedItems.get(index);
        return item && this.getElementFromItem(item);
    }

    getElementFromItem(item) {
        return item instanceof HTMLElement ? item : item?.element;
    }

    getHeightFromItem(item) {
        return item instanceof HTMLElement ? this.defaultItemHeight : item.height ?? this.defaultItemHeight;
    }

    isElementVisible(index) {
        const scrollPos = this.getScrollPosition();
        const viewportSize = this.getViewportSize();
        const averageSize = this.calcAverageSize();
        const bufferSize = Math.max(this.buffer ?? 0, this.calcScreenItems() * 3);

        const bufferedStart = scrollPos - bufferSize * averageSize;
        const bufferedEnd = scrollPos + viewportSize + bufferSize * averageSize;

        const pos = this.positions[index];
        const size = this.heightCache[index];
        const end = pos + size;

        return end > bufferedStart && pos < bufferedEnd;
    }

    isElementRendered(element) {
        return this.container.contains(element);
    }

    updateHeight(index, height) {
        const oldHeight = this.heightCache[index];
        if (height !== oldHeight) {
            const delta = height - oldHeight;
            this.heightCache[index] = height;
            for (let i = index + 1; i < this.totalItems; i++) {
                this.positions[i] += delta;
            }
            this.totalHeight += delta;
        }
    }

    getScrollPosition() {
        return this.horizontal ? this.container.scrollLeft : this.container.scrollTop;
    }

    getViewportSize() {
        return this.horizontal ? this.container.clientWidth : this.container.clientHeight;
    }

    calcAverageSize() {
        return this.totalHeight / this.totalItems;
    }

    calcScreenItems() {
        const viewportSize = this.getViewportSize();
        return Math.ceil(viewportSize / this.calcAverageSize());
    }

    /**
     * Smoothly scrolls to a given index in the list.
     * Cancels any previous scroll animation.
     *
     * @param {number} index - Index of the item to scroll to.
     * @param {number} [duration=300] - Duration of the scroll animation in ms.
     */
    scrollToIndex(index, duration = 300) {
        if (this.cancelScrollAnimation) {
            this.cancelScrollAnimation();
        }

        const target = this.positions[index];
        const container = this.container;
        const start = this.horizontal ? container.scrollLeft : container.scrollTop;
        const change = target - start;
        const startTime = performance.now();

        let cancelled = false;
        this.cancelScrollAnimation = () => {
            cancelled = true;
            this.cancelScrollAnimation = null;
        };

        const animate = (currentTime) => {
            if (cancelled) return;

            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeInOutQuad(progress);
            const current = start + change * eased;

            if (this.horizontal) {
                container.scrollLeft = current;
            } else {
                container.scrollTop = current;
            }

            if (progress < 1) {
                this.scrollToIndexAnimationFrame = requestAnimationFrame(animate);
            } else {
                this.cancelScrollAnimation = null;
            }
        };

        this.scrollToIndexAnimationFrame = requestAnimationFrame(animate);
    }

    destroy() {
        cancelAnimationFrame(this.renderingAnimationFrame);
        this.renderingAnimationFrame = null;
        cancelAnimationFrame(this.scrollToIndexAnimationFrame);
        this.scrollToIndexAnimationFrame = null;

        this.container.removeEventListener('scroll', this.scrollHandler);
        this.resizeObserver?.disconnect();

        this.container.innerHTML = '';

        this.container = null;
        this.scroller = null;
        this.scrollHandler = null;
        this.resizeHandler = null;
        this.resizeObserver = null;
        this.generate = null;
        this.applyPatch = null;
        this.afterRender = null;
        this.config = null;

        this.positions = null;
        this.heightCache = null;
        this.renderedItems = null;
        // this.cache = null;

        this.cancelScrollAnimation = null;
    }
}

export default VirtuaList;
