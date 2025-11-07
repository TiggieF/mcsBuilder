# Environment & Stage Interaction Guide

This project is designed so that **each stage is playable** and can be tested or explored as a standalone HTML file.  
Every stage folder inside `/stages/` (e.g. `/stages/stage-00-scaffold/`) contains:

- A self-contained **`index.html`** file
- A **`README.md`** explaining:
  - how to **run** that stage
  - how to **play** with it
  - how to **edit or explore the code**

---

## 🧱 Core Principle

> “For each stage, I can access that unfinished HTML page so I can play with it, see its current behaviour, and understand how the code evolves. Each stage has full instructions on how to run it, interact with it, and modify the source.”

This means:
- You can open any stage HTML directly in your browser.
- Each stage demonstrates a functional subset of the final game.
- The code is annotated so that you can understand **what each section does**.

---

## 🖥 Environment Setup

**No installations required.**
- Works entirely offline.
- Uses only vanilla JavaScript and the HTML5 Canvas API.
- No Node.js, build tools, or frameworks.

### Requirements
| Tool | Purpose | Recommended Version |
|------|----------|----------------------|
| Browser | Run the HTML game | Chrome / Edge / Firefox (latest) |
| Text Editor | Edit code | VS Code / PyCharm / Sublime |
| Git | Pull updates from GitHub | latest |

---

## 🚀 How to Run

### Option 1 — Local Browser
1. Clone or download the repository:
   ```bash
   git clone https://github.com/<your-username>/mcsBuilder.git
   cd mcsBuilder


Open any stage:

bash
Copy code
cd stages/stage-02-domain-model
Double-click index.html

The game will open in your browser.