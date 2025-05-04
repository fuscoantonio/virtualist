# VirtuaList

**VirtuaList** is a lightweight, high-performance virtual scrolling library for rendering massive **lists** or **grids** efficiently. Inspired by HyperList, but harder, better, faster, stronger... just a little bit.

- 🔁 Supports vertical, horizontal, and grid layouts
- ⚡ Blazing fast rendering even with millions of items
- 🧠 Smart rendering through caching and minimal DOM churn
- 📦 No dependencies
- 🌐 Framework-agnostic

## Installation

```bash
npm install virtualist-js
```

## Usage

```javascript
import VirtuaList from 'virtualist-js';

new VirtuaList(container, {
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

| Option        | Type       | Required | Description                                |
| ------------- | ---------- | -------- | ------------------------------------------ |
| `totalItems`  | `number`   | ✅        | Total number of items in the list          |
| `itemHeight`  | `number`   | ✅        | Default height of each row (px)            |
| `generate`    | `function` | ✅        | Callback to create a DOM element per index |
| `applyPatch`  | `function` | ❌        | Custom patching logic for replacing visible items (default is full replace) |
| `afterRender` | `function` | ❌        | Called after every render                  |
| `buffer`      | `number`   | ❌        | Extra rows to render above/below viewport  |
| `itemsPerRow` | `number`   | ❌        | Number of items per row (for grids)        |
| `horizontal`  | `boolean`  | ❌        | Enable horizontal scrolling layout         |
