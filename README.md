# VirtuaList

**VirtuaList** is a lightweight, high-performance virtual scrolling library for rendering massive **lists** efficiently.

- 🔁 Supports vertical and horizontal layout
- ⚡ Blazing fast rendering even with millions of items
- 🧠 Smart rendering with minimal DOM churn
- 📦 No dependencies
- 🌐 Framework-agnostic

## Installation

```bash
npm install virtualist.js
```

## Usage

```javascript
import VirtuaList from 'virtualist.js';

const list = new VirtuaList(container, {
    totalItems: 1000000,
    itemHeight: 30,
    generate: (index) => {
        const el = document.createElement('div');
        el.textContent = `Item #${index}`;
        el.style.height = '30px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.padding = '0 10px';
        el.style.borderBottom = '1px solid #eee';
        return { element: el, height: 40 }; // or return the element directly if the size doesn't change, e.g. return el;
    },
    applyPatch: (listContainer, fragment) => {
        // custom way to patch DOM content
        listContainer.innerHTML = '';
        listContainer.appendChild(fragment);
    },
    afterRender: () => {
        // called after every render
    },
});
```

### Initialization options
| Option        | Type       | Required | Description                                |
| ------------- | ---------- | -------- | ------------------------------------------ |
| `totalItems`  | `number`   | ✅        | Total number of items in the list          |
| `itemHeight`  | `number`   | ✅        | Default height of each row (px)            |
| `generate`    | `function` | ✅        | Callback to create a DOM element per index |
| `applyPatch`  | `function` | ❌        | Custom patching logic for replacing visible items (default is full replace) |
| `afterRender` | `function` | ❌        | Called after every render                  |
| `buffer`      | `number`   | ❌        | Extra rows to render above/below viewport  |
| `horizontal`  | `boolean`  | ❌        | Enable horizontal scrolling layout         |
---

### Add single item
```javascript
const index = 3;
/* adds an item at the specified index; triggers a full render to account for total height change */
list.addItem(index);
```

### Update single item
```javascript
const index = 3;
/* the generate callback will be called only for the specified item without triggering a complete render if the size of the element doesn't change; if the size changes, a render of all the visible elements is required */
list.updateItem(index);
```

### Trigger a full re-rendering
Useful when the amount of items changes drastically
```javascript
// clears cache and re-renders all visible elements
list.refresh({
    // optional new configurations, same as initialization options
});
```

```javascript
const index = 3;
const animationDuration = 500;
/* animation duration defaults to 300 when not provided; each subsequent call to scrollToIndex interrupts any previous unfinished call */
list.scrollToIndex(index, animationDuration);
```
