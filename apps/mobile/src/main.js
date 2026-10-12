import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";
const raiz = document.getElementById("raiz");
if (!raiz)
    throw new Error("Elemento #raiz não encontrado no index.html");
createRoot(raiz).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
