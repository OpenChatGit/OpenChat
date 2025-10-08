# Markdown Renderer Plugin

**Core Plugin** - Cannot be disabled

## Description

Renders markdown content with full GitHub Flavored Markdown (GFM) support, syntax highlighting, and mathematical expressions.

## Features

- ✅ GitHub Flavored Markdown (GFM)
- ✅ Syntax highlighting for code blocks
- ✅ Math rendering with KaTeX
- ✅ Tables, lists, blockquotes
- ✅ Custom styling for all elements
- ✅ Image support
- ✅ Link handling

## Supported Markdown

### Headers
```markdown
# H1
## H2
### H3
```

### Text Formatting
```markdown
**bold**
*italic*
~~strikethrough~~
`inline code`
```

### Code Blocks
````markdown
```javascript
console.log('Hello World')
```
````

### Lists
```markdown
- Item 1
- Item 2

1. First
2. Second
```

### Tables
```markdown
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```

### Math
```markdown
Inline: $E = mc^2$

Block:
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

## Dependencies

- react-markdown
- remark-gfm
- remark-math
- rehype-katex
- rehype-highlight
- highlight.js
- katex

## Version History

### 1.0.0
- Initial release
- Full GFM support
- Syntax highlighting
- Math rendering
