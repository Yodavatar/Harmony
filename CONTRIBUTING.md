
# Contributing to Harmony

First off, thank you for taking the time to contribute! Contributions are what make the open-source community such an amazing place to learn, inspire, and create.

> ⚠️ **Important:** To avoid multiple people working on the same feature or fix, please open an Issue or comment on an existing one to discuss what you want to change *before* you start coding and opening a Pull Request. We will assign the GitHub Issue to you so everyone knows you are on it!

## How to Contribute

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make to **Harmony** are greatly appreciated!

If you want to contribute, please follow these steps:

1. **Fork** the repository.<br><br>

2. **Create your Feature Branch** from the `dev` branch:

```bash
   git checkout -b feature/amazing-feature
```

4. **Commit** your changes with a clear message:

```Bash
    git commit -m 'feat: add some amazing feature'
```

5. **Push** to the branch:

```Bash
   git push origin feature/amazing-feature
```

Open a Pull Request targeting the dev branch, and describe your modifications in the PR description.

## Code Guidelines

To keep the codebase clean, fast, and maintainable, please ensure your code respects the following standards:

### 1. Architecture & Tech Stack
* **Pure TypeScript:** Harmony is built with pure TypeScript. Avoid adding heavy external frameworks (like React, Svelte, etc.) unless explicitly discussed in an issue.
* **No `any` Type:** Avoid using `any` at all costs. Always define proper interfaces, types, or use `unknown` if the type is truly dynamic.
* **Modularity:** Keep modules (Kanban, Calendar, Dashboard) decoupled. A change in the Kanban module should never accidentally break the Calendar.

### 2. Styling & UX
* **Class-Based Styling:** Do not set CSS properties directly via JavaScript/TypeScript (avoid deprecated style injections). Use clean CSS classes defined in the plugin's stylesheet.
* **No `!important` in CSS:** Avoid using `!important` in your stylesheets. It breaks the CSS cascade and prevents users from customizing their workspace with personal theme snippets. Write specific selectors instead.
* **Obsidian Theme Integration:** Always use Obsidian's native CSS variables (e.g., `--text-normal`, `--background-primary`) so that Harmony looks beautiful in both Light and Dark modes, regardless of the user's theme.

### 3. Code Quality & Formatting
* **Linting & Formatting:** Run the linter before committing. Code should be clean, readable, and well-commented where complex logic is involved.
* **No Console Logs:** Remove all `console.log` statements used for debugging before submitting your Pull Request. Use a proper logging utility if needed.

### 4. Build Validation
Before pushing your branch, always make sure the project builds perfectly on your local machine:
```bash
npm run build
```

## AI-Assisted Code Policy

Using AI tools (like Copilot, ChatGPT, Claude or other) to help you write code or debug is **completely fine and allowed**—it's a great productivity booster! 

However, we have one golden rule: **You must understand and be able to explain every single line of code you submit.**

* **Know your code:** During the Pull Request review, we might ask you questions about why you chose a specific function, how a certain logic works, or why a specific technology was used.

* **No blind copy-pasting:** If you cannot explain or defend the code you submitted, the Pull Request will not be merged. 

We want to keep Harmony's codebase clean, human-driven, and highly maintainable. Write smart, but stay in control!

## Review

Every single Pull Request will go through a code review before being merged into the dev branch.

Don't worry, this is not a harsh or elitist exam! It's a friendly space to discuss code, ensure project stability, and learn together. Whether you wrote the code yourself brique par brique or used an AI assistant, the process is exactly the same:

- Friendly Chat: We will look at your code and might ask casual questions like "How does this part handle edge cases?" or "Why did you opt for this approach here?".
- Understanding First: The main goal is simply to ensure that you fully understand what your code does and how it impacts Harmony.
- Collaboration: If something can be optimized or formatted better, we will guide you and suggest improvements directly in the PR comments.

As long as you know how your code works and are open to feedback, your PR will be welcomed with open arms!