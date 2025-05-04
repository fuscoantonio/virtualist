class VirtuaList {
    constructor(container, config) {
        const {
            totalItems,
            itemHeight,
            generate,
            buffer,
            horizontal = false,
            itemsPerRow = 1
        } = config;

        this.container = container;
        this.totalItems = totalItems;
        this.defaultItemHeight = itemHeight;
        this.generate = generate;
        this.buffer = buffer;
        this.horizontal = horizontal;
        this.itemsPerRow = Math.max(1, itemsPerRow);
        this.colPercentage = 100 / this.itemsPerRow;
        this.colWidth = this.colPercentage + '%';

        this.scroller = document.createElement('div');
        this.scroller.style.position = 'absolute';
        this.scroller.style.opacity = '0';
        this.container.style.overflow = 'auto';
        this.container.style.position = 'relative';
        this.container.innerHTML = '';
        this.container.appendChild(this.scroller);

        this.rowCount = Math.ceil(totalItems / this.itemsPerRow);
        this.positions = new Array(this.rowCount);
        this.heightCache = new Array(this.rowCount);
        for (let i = 0, pos = 0; i < this.rowCount; i++) {
            this.heightCache[i] = itemHeight;
            this.positions[i] = pos;
            pos += itemHeight;
        }
        this.totalHeight = this.positions[this.rowCount - 1] + itemHeight;

        if (this.horizontal) {
            this.scroller.style.width = this.totalHeight + 'px';
            this.scroller.style.height = '100%';
        } else {
            this.scroller.style.height = this.totalHeight + 'px';
            this.scroller.style.width = '100%';
        }

        this.scrollAnimationFrame = null;
        this.queued = false;
        this.scrollHandler = this.handleScroll.bind(this);
        this.container.addEventListener('scroll', this.scrollHandler, { passive: true });

        this.lastSize = this.getViewportSize();
        this.resizeHandler = this.handleResize.bind(this);
        this.resizeObserver = new ResizeObserver(this.resizeHandler);
        this.resizeObserver.observe(this.container);

        this.cache = [];

        this.lastRepaint = -1;
        this.lastStart = -1;
        this.lastScrollerHeight = -1;

        this.render();
    }

    handleScroll() {
        const scrollPos = this.getScrollPosition();
        if (this.lastRepaint === -1 || scrollPos === this.lastRepaint) return;

        const diff = Math.abs(scrollPos - this.lastRepaint);
        const averageSize = this.calcAverageSize();
        if (diff <= averageSize) return; // TODO: make check more strict?

        this.scheduleRendering();
    }

    handleResize(event) {
        const [entry] = event;
        const newSize = this.horizontal ? entry.contentRect.width : entry.contentRect.height;
        if (this.lastSize === newSize) return;

        const diff = Math.abs(newSize - this.lastSize);
        const averageSize = this.calcAverageSize();
        if (diff <= averageSize) return; // TODO: make check more strict?

        this.lastSize = newSize;

        this.scheduleRendering(true);
    }

    scheduleRendering(force) {
        if (this.queued) return;

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
        while (this.positions[start] < scrollPos) {
            start++;
        }
        start = Math.max(0, start - Math.floor(bufferItems / 2));

        if (!force && this.lastStart === start) return;

        this.lastStart = start;

        let end = Math.min(this.rowCount, start + screenItems + bufferItems);
        if (end + bufferItems > this.rowCount) {
            end = this.rowCount;
        }

        const fragment = document.createDocumentFragment();
        fragment.appendChild(this.scroller);

        for (let row = start; row < end; row++) {
            for (let col = 0; col < this.itemsPerRow; col++) {
                const index = row * this.itemsPerRow + col;
                if (index >= this.totalItems) break;

                this.beforeGenerate?.(index, this.getElementFromCache(index));

                const item = this.getItem(index);
                const measuredSize = this.getHeightFromItem(item);
                this.updateHeight(row, measuredSize);
                const element = this.getElementFromItem(item);
                this.setElementStyle(element, row, col);

                this.afterGenerate?.(index, element);

                fragment.appendChild(element);
            }
        }

        this.updateScrollerStyle();

        if (this.applyPatch) {
            this.applyPatch(fragment);
        } else {
            this.container.innerHTML = '';
            this.container.appendChild(fragment);
        }

        this.lastRepaint = this.getScrollPosition();

        this.afterRender?.();
    }

    setElementStyle(element, rowIndex, colIndex) {
        const rowPos = this.positions[rowIndex];
        const leftPercentage = colIndex * this.colPercentage;

        element.style.position = 'absolute';
        element.style.top = rowPos + 'px';
        element.style.left = leftPercentage + '%';
        element.style.width = this.colWidth;
    }

    updateScrollerStyle() {
        if (this.lastScrollerHeight === this.totalHeight) return;

        if (this.horizontal) {
            this.scroller.style.width = this.totalHeight + 'px';
            this.lastScrollerHeight = this.totalHeight;
        } else {
            this.scroller.style.height = this.totalHeight + 'px';
            this.lastScrollerHeight = this.totalHeight;
        }
    }

    updateItem(index) {
        const oldElement = this.getElementFromCache(index);

        if (!oldElement || !this.isElementRendered(oldElement)) return;

        this.cache[index] = undefined;

        const item = this.getItem(index);
        const row = this.getRow(index);
        const prevHeight = this.heightCache[row];

        const newHeight = this.getHeightFromItem(item);
        if (newHeight !== prevHeight) {
            this.render(true);
            return;
        }

        this.updateHeight(row, newHeight);
        const newElement = this.getElementFromItem(item);
        const col = index % this.itemsPerRow;
        this.setElementStyle(newElement, row, col);
        this.container.replaceChild(newElement, oldElement);
        this.updateScrollerStyle();
    }

    refresh() {
        this.cache.length = 0;
        this.render(this.lastRepaint === -1);
    }

    getItem(index) {
        if (this.cache[index]) {
            return this.cache[index];
        }

        const item = this.generate(index);
        this.cache[index] = item;

        return item;
    }

    getElementFromCache(index) {
        const item = this.cache[index];
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

        const row = this.getRow(index);
        const pos = this.positions[row];
        const size = this.heightCache[row];
        const end = pos + size;

        return end > scrollPos && pos < scrollPos + viewportSize;
    }

    isElementRendered(element) {
        return this.container.contains(element);
    }

    updateHeight(row, height) {
        const oldHeight = this.heightCache[row];
        if (height !== oldHeight) {
            const delta = height - oldHeight;
            this.heightCache[row] = height;
            for (let i = row + 1; i < this.rowCount; i++) {
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

    getRow(index) {
        return Math.floor(index / this.itemsPerRow);
    }

    calcAverageSize() {
        return this.totalHeight / this.rowCount;
    }

    calcScreenItems() {
        const viewportSize = this.getViewportSize();
        const averageSize = this.calcAverageSize();
        return Math.ceil(viewportSize / averageSize);
    }

    destroy() {
        cancelAnimationFrame(this.scrollAnimationFrame);
        this.container.removeEventListener('scroll', this.scrollHandler);
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.container.innerHTML = '';
        this.cache.length = 0;
    }
}

export default VirtuaList;
