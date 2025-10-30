# 🤖 AI Rules for Lovable Project

This document outlines the technical stack and specific library usage guidelines for this project. Adhering to these rules ensures consistency, maintainability, and optimal performance.

## 🚀 Tech Stack Overview

This project is built using a modern web development stack, focusing on performance, developer experience, and scalability.

*   **Frontend Framework**: React (with TypeScript)
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS for utility-first styling
*   **UI Components**: shadcn/ui (built on Radix UI) for accessible and customizable components
*   **Routing**: React Router (`react-router-dom`) for client-side navigation
*   **HLS Streaming**: `hls.js` for robust HLS video playback
*   **MPEG-TS Streaming**: `mpegts.js` for efficient MPEG-TS video playback
*   **VAST Ads**: `@dailymotion/vast-client` and Google IMA SDK for video advertising
*   **Icons**: `lucide-react` for a consistent icon set
*   **Serverless Functions/Backend**: Supabase (client integration and edge functions for stream proxying)
*   **Data Fetching/Caching**: `@tanstack/react-query` for server state management
*   **Form Management**: `react-hook-form` with `zod` for validation

## 📚 Library Usage Guidelines

To maintain a clean and efficient codebase, please follow these guidelines for library usage:

*   **UI Components**:
    *   Always use **shadcn/ui** components for standard UI elements (buttons, inputs, selects, cards, etc.).
    *   Avoid creating custom components if a suitable shadcn/ui component exists.
    *   Do not modify shadcn/ui component files directly; create new components that wrap them if customization is needed.
*   **Styling**:
    *   Use **Tailwind CSS** exclusively for all styling.
    *   Avoid custom CSS files (`.css` or `.scss`) or inline styles unless absolutely necessary for dynamic, computed style values.
    *   Utilize the `cn` utility function (from `src/lib/utils.ts`) for conditionally applying and merging Tailwind classes.
*   **Routing**:
    *   Use **React Router (`react-router-dom`)** for all client-side routing.
    *   Define all main application routes within `src/App.tsx`.
*   **State Management**:
    *   For local component state, use React's built-in `useState` and `useReducer`.
    *   For global application state, prefer React's Context API (`useContext`).
    *   For server-state management (data fetching, caching, synchronization with APIs), use **`@tanstack/react-query`**.
*   **Video Streaming**:
    *   For HLS (HTTP Live Streaming) streams (`.m3u8`), use **`hls.js`**.
    *   For MPEG-TS (MPEG Transport Stream) streams (`.ts`), use **`mpegts.js`**.
    *   Ensure proper cleanup and error handling for both players.
*   **Video Advertising (VAST)**:
    *   Use **`@dailymotion/vast-client`** for parsing VAST XML.
    *   Integrate with the **Google IMA SDK** for ad playback and lifecycle management.
*   **Icons**:
    *   All icons should come from the **`lucide-react`** library.
*   **Notifications**:
    *   For transient, non-blocking notifications (toasts), use **`sonner`**.
*   **Backend/API Interaction**:
    *   For any interaction with Supabase services (authentication, database, storage, edge functions), use the **`@supabase/supabase-js`** client.
    *   The `stream-proxy` edge function is located in `supabase/functions/stream-proxy/index.ts`.
*   **Forms and Validation**:
    *   Use **`react-hook-form`** for managing form state and submissions.
    *   For schema-based form validation, use **`zod`** with `@hookform/resolvers`.
*   **Utility Functions**:
    *   For date manipulation, use **`date-fns`**.
    *   For general utilities, create small, focused functions in `src/lib/utils.ts` or `src/utils/` directories.