# React Todo App

A modern, clean todo list application built with React and TypeScript.

> **Note:** This app was built by the roadman. Proper vibes only!

**Live Demo:** [https://vibe-sessions.netlify.app](https://vibe-sessions.netlify.app) (Update this URL once you deploy your app)

## Features

- ✅ Add, edit, and delete tasks
- 🔄 Mark tasks as complete/incomplete
- 🔍 Filter tasks by All/Active/Completed
- 🧹 Clear all completed tasks at once
- 💾 Persistent storage using localStorage
- 📱 Responsive design for all devices
- 🔐 Web3 authentication with Privy

## Tech Stack

- React 18
- TypeScript
- Vite
- CSS3
- Privy Auth
- Permissionless.js

## Getting Started

1. Clone the repository
2. Install dependencies:
```
npm install
```
3. Update the Privy App ID in `src/App.tsx`:
```typescript
// Replace with your actual Privy App ID
const PRIVY_APP_ID = 'your-privy-app-id-here';
```
4. Start the development server:
```
npm run dev
```
5. Open your browser to the URL shown in the terminal

## Deployment

You can deploy this app to platforms like:
- [Netlify](https://netlify.com)
- [Vercel](https://vercel.com)
- [GitHub Pages](https://pages.github.com)

After deployment, update the live demo link at the top of this README.

## Setting Up Privy Authentication

To enable the login functionality:

1. Go to [Privy](https://privy.io/) and sign up for an account
2. Create a new project
3. Copy your App ID from the dashboard
4. Replace the placeholder App ID in `src/App.tsx`
5. Configure allowed domains in the Privy dashboard (add localhost for development)

For more details, see the [Privy documentation](https://docs.privy.io/).

## Building for Production

```
npm run build
```

The build files will be output to the `dist` directory.

## Usage

- Add a new task by typing in the input field and pressing Enter or clicking "Add"
- Double-click a task to edit it
- Mark tasks as complete by clicking the checkbox
- Use the filters to show All, Active, or Completed tasks
- Clear all completed tasks with the "Clear Completed" button

## License

MIT
