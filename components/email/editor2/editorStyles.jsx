import { useEffect } from "react";

export function useEditorStyles() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const style = document.createElement("style");
    style.setAttribute("data-email-editor-dropdown-styles", "true");
    style.textContent = `
      .email-editor-dropdown,
      .email-editor-dropdown * {
        background: #fff !important;
      }
      .email-editor-inspector input:not([type="color"]):not([type="range"]):not([type="file"]),
      .email-editor-inspector select,
      .email-editor-inspector textarea {
        background: #ffffff !important;
        color: #0f172a !important;
        border: 1px solid #cbd5e1 !important;
        -webkit-text-fill-color: #0f172a !important;
        caret-color: #0f172a !important;
        box-shadow: none !important;
      }
      .email-editor-inspector input:not([type="color"]):not([type="range"]):not([type="file"])::placeholder,
      .email-editor-inspector textarea::placeholder {
        color: #64748b !important;
        -webkit-text-fill-color: #64748b !important;
      }
      .email-editor-inspector input:not([type="color"]):not([type="range"]):not([type="file"]):focus,
      .email-editor-inspector select:focus,
      .email-editor-inspector textarea:focus {
        background: #ffffff !important;
        color: #0f172a !important;
        outline: 2px solid rgba(37, 99, 235, 0.32) !important;
        border-color: #2563eb !important;
        -webkit-text-fill-color: #0f172a !important;
      }
      .email-editor-inspector button {
        -webkit-text-fill-color: currentColor !important;
      }
      .email-editor-select,
      .email-editor-select option,
      .email-editor-select optgroup {
        background: #fffef7 !important;
        color: #0f172a !important;
      }
      .email-editor-select:focus {
        outline: 2px solid rgba(245, 158, 11, 0.45);
        outline-offset: 1px;
      }
      .email-editor-dropdown .dropdown-item:hover {
        background: #2563eb !important;
        color: #fff !important;
      }
      .email-editor-range {
        -webkit-appearance: none;
        appearance: none;
        height: 24px;
        background: transparent;
        cursor: pointer;
      }
      .email-editor-range::-webkit-slider-runnable-track {
        height: 12px;
        border-radius: 999px;
        background: linear-gradient(90deg, #1e293b 0%, #334155 100%);
        border: 1px solid rgba(148, 163, 184, 0.6);
      }
      .email-editor-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 24px;
        height: 24px;
        margin-top: -7px;
        border-radius: 999px;
        background: linear-gradient(180deg, #ffffff 0%, #fde68a 100%);
        border: 2px solid #b45309;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.24);
      }
      .email-editor-range::-moz-range-track {
        height: 12px;
        border-radius: 999px;
        background: linear-gradient(90deg, #1e293b 0%, #334155 100%);
        border: 1px solid rgba(148, 163, 184, 0.6);
      }
      .email-editor-range::-moz-range-thumb {
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: linear-gradient(180deg, #ffffff 0%, #fde68a 100%);
        border: 2px solid #b45309;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.24);
      }
      .email-editor-toolbar-scroll {
        scrollbar-width: auto;
        scrollbar-color: #0f172a #fde68a;
      }
      .email-editor-toolbar-scroll::-webkit-scrollbar {
        height: 16px;
        width: 16px;
      }
      .email-editor-toolbar-scroll::-webkit-scrollbar-track {
        background: rgba(245, 158, 11, 0.18);
        border-radius: 999px;
      }
      .email-editor-toolbar-scroll::-webkit-scrollbar-thumb {
        background: #0f172a;
        border-radius: 999px;
        border: 3px solid rgba(254, 243, 199, 0.98);
      }
      .email-editor-toolbar-scroll::-webkit-scrollbar-thumb:hover {
        background: #1e293b;
      }
      .email-editor-link-btn {
        background: #fff !important;
        border: 1.5px solid #2563eb !important;
        font-weight: 700;
        border-radius: 8px;
        padding: 6px 16px;
        transition: background 0.2s, color 0.2s;
      }
      .email-editor-link-btn:hover {
        background: #2563eb !important;
        color: #fff !important;
      }
    `;

    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);
}

export function EmailEditorStyles() {
  return (<style>{`
        .email-editor-shell,
        .email-editor-shell input,
        .email-editor-shell select,
        .email-editor-shell textarea,
        .email-editor-shell button {
          color-scheme: light;
        }

        .email-editor-shell input:not([type="color"]):not([type="range"]):not([type="file"]),
        .email-editor-shell select,
        .email-editor-shell textarea {
          -webkit-text-fill-color: currentColor;
        }

        .email-editor-shell input:-webkit-autofill,
        .email-editor-shell textarea:-webkit-autofill,
        .email-editor-shell select:-webkit-autofill {
          -webkit-text-fill-color: #0f172a;
          box-shadow: 0 0 0 1000px #ffffff inset;
          transition: background-color 9999s ease-out 0s;
        }

        .email-editor-inspector,
        .email-editor-inspector input,
        .email-editor-inspector select,
        .email-editor-inspector textarea,
        .email-editor-inspector button {
          color-scheme: light;
        }

        .email-editor-inspector input:not([type="color"]):not([type="range"]):not([type="file"]),
        .email-editor-inspector select,
        .email-editor-inspector textarea {
          background: #ffffff;
          color: #0f172a;
          -webkit-text-fill-color: #0f172a;
          caret-color: #0f172a;
        }

        .email-editor-inspector button {
          color: #0f172a;
        }

        .email-editor-inspector input::placeholder,
        .email-editor-inspector textarea::placeholder {
          color: #64748b;
          -webkit-text-fill-color: #64748b;
        }
      `}</style>);
}
