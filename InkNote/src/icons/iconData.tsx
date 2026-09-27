import type { ReactNode } from "react";

export interface IconDefinition {
  viewBox?: string;
  render: (props: { size?: number; className?: string }) => ReactNode;
}

/**
 * VS Code / PyCharm (JetBrains) 经典高精度矢量图标库
 * 标准 16x16 视口，多色专业徽标，精确对齐开发者原生视觉习惯。
 */
export const VSCODE_ICONS: Record<string, IconDefinition> = {
  // --- 文件夹：VS Code 经典金黄扁平折角文件夹 ---
  folder: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <path d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.1a1.5 1.5 0 0 1 1.06.44L8.7 3.44A.5.5 0 0 0 9.06 3.6H13A1.5 1.5 0 0 1 14.5 5.1V12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3.5z" fill="#E5A93C" />
        <path d="M1.5 5.2H14.5V12a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 12V5.2z" fill="#F0BC5E" />
      </svg>
    ),
  },
  "folder-open": {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <path d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.1a1.5 1.5 0 0 1 1.06.44L8.7 3.44A.5.5 0 0 0 9.06 3.6H13A1.5 1.5 0 0 1 14.5 5.1v1.9H2.5L1.5 5.2z" fill="#E5A93C" />
        <path d="M1 7h14l-1.8 6.4a1.5 1.5 0 0 1-1.45 1.1H2.25a1.5 1.5 0 0 1-1.45-1.1L1 7z" fill="#F7CA74" stroke="#E5A93C" strokeWidth="0.6" />
      </svg>
    ),
  },

  // --- 编程语言：经典 IDE 标志 ---
  python: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        {/* PyCharm 经典蓝黄双蛇 */}
        <path d="M7.9 1.5c-2.4 0-2.2 1-2.2 1l.01 1.1h2.25v.35H4.38S2.5 3.7 2.5 6.1s1.65 2.3 1.65 2.3h.98v-1.4s-.05-1.65 1.65-1.65h2.8s1.6 0 1.6-1.55v-2.2s.22-1.6-3.28-1.6zm-1.25.9a.45.45 0 1 1 0 .9.45.45 0 0 1 0-.9z" fill="#387EB8" />
        <path d="M8.1 14.5c2.4 0 2.2-1 2.2-1l-.01-1.1H8.04v-.35h3.58s1.88.25 1.88-2.15-1.65-2.3-1.65-2.3h-.98v1.4s.05 1.65-1.65 1.65h-2.8s-1.6 0-1.6 1.55v2.2s-.22 1.6 3.28 1.6zm1.25-.9a.45.45 0 1 1 0-.9.45.45 0 0 1 0 .9z" fill="#FFE052" />
      </svg>
    ),
  },
  typescript: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#3178C6" />
        <path d="M4 6.2h4.5v1.2H6.9v4.6H5.5V7.4H4V6.2z" fill="#FFFFFF" />
        <path d="M9.2 10.3c.4.5 1 .8 1.7.8.6 0 1-.3 1-.7 0-.4-.3-.6-1.1-.9-.9-.3-1.8-.7-1.8-1.8 0-1 .8-1.7 2-1.7.8 0 1.5.3 1.9.8l-.7.8c-.3-.3-.7-.5-1.2-.5-.5 0-.8.2-.8.5 0 .4.4.5 1.1.8 1.1.4 1.8.8 1.8 1.9 0 1.1-.9 1.8-2.2 1.8-.9 0-1.7-.3-2.2-.9l.5-.8z" fill="#FFFFFF" />
      </svg>
    ),
  },
  javascript: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#F7DF1E" />
        <path d="M5.5 10.8c.2.4.6.6 1.1.6.6 0 1-.3 1-1.1V6.2h1.3v4.1c0 1.4-.8 2.1-2.2 2.1-1 0-1.7-.5-2-1.2l.8-.4z" fill="#000000" />
        <path d="M9.4 10.4c.4.5 1 .8 1.7.8.6 0 1-.3 1-.7 0-.4-.3-.6-1.1-.9-.9-.3-1.8-.7-1.8-1.8 0-1 .8-1.7 2-1.7.8 0 1.5.3 1.9.8l-.7.8c-.3-.3-.7-.5-1.2-.5-.5 0-.8.2-.8.5 0 .4.4.5 1.1.8 1.1.4 1.8.8 1.8 1.9 0 1.1-.9 1.8-2.2 1.8-.9 0-1.7-.3-2.2-.9l.5-.8z" fill="#000000" />
      </svg>
    ),
  },
  rust: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="#DEA584" strokeWidth="1.2" strokeDasharray="2 1.2" />
        <circle cx="8" cy="8" r="4.2" stroke="#DEA584" strokeWidth="0.8" fill="none" />
        <path d="M6.2 5.5h2.2c.9 0 1.6.4 1.6 1.3 0 .7-.5 1.1-1.1 1.2l1.3 2.5H8.7L7.6 8.2h-.4v2.3H6.2V5.5zm1 1.9h1.1c.4 0 .7-.2.7-.6 0-.3-.3-.5-.7-.5H7.2v1.1z" fill="#DEA584" />
      </svg>
    ),
  },
  go: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="#00ACD7" />
        <path d="M4.5 7.8c0-1.5.9-2.5 2.2-2.5.9 0 1.6.4 1.9 1.1l-1 .5c-.2-.4-.5-.6-.9-.6-.7 0-1.1.5-1.1 1.5s.4 1.5 1.1 1.5c.4 0 .7-.2.8-.5H6.4V7.8h2.2v2.5c-.5.6-1.2.9-2 .9-1.3 0-2.1-1.1-2.1-2.4z" fill="#FFFFFF" />
        <circle cx="11.2" cy="8" r="1.8" stroke="#FFFFFF" strokeWidth="1.1" fill="none" />
      </svg>
    ),
  },
  html: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <path d="M2.5 1.5l1.1 12.3 4.4 1.2 4.4-1.2 1.1-12.3H2.5z" fill="#E34F26" />
        <path d="M8 2.6v11.1l3.6-1 .9-10.1H8z" fill="#EF652A" />
        <path d="M8 5.6H5.2l.2 2H8V6.6zm0 3.2H6.2l.2 2 1.6.4v-1.1l-.8-.2-.1-.7H8v-.4z" fill="#EBEBEB" />
        <path d="M8 5.6h2.8l-.3 3.2H8V7.8h1.7l.1-1.2H8V5.6zm0 3.2h1.6l-.2 1.8L8 11.2v1l2.4-.6.4-3.8H8v-.8z" fill="#FFFFFF" />
      </svg>
    ),
  },
  css: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <path d="M2.5 1.5l1.1 12.3 4.4 1.2 4.4-1.2 1.1-12.3H2.5z" fill="#1572B6" />
        <path d="M8 2.6v11.1l3.6-1 .9-10.1H8z" fill="#33A9DC" />
        <path d="M5.2 5.5H8v1H6.2l.2 2H8v1H6.4l.2 2 1.4.4v1.1l-2.4-.6-.4-4.5h-.1l-.1-2.4z" fill="#EBEBEB" />
        <path d="M8 5.5h2.8l-.1 1.2H8v1h1.9l-.3 3-1.6.4v1.1l2.4-.6.5-5.1H8v-1z" fill="#FFFFFF" />
      </svg>
    ),
  },
  markdown: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.8" stroke="#42A5F5" strokeWidth="1.2" fill="none" />
        <path d="M3.8 10.5V5.5h1.2l1.2 2 1.2-2h1.2v5H7.4V7.6L6.3 9.4H6.1L5 7.6v2.9H3.8z" fill="#42A5F5" />
        <path d="M11.8 8.4V5.5h1v2.9h1.2l-1.7 2.2-1.7-2.2h1.2z" fill="#42A5F5" />
      </svg>
    ),
  },
  json: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <path d="M5.5 3.5c-.8 0-1.5.5-1.5 1.5v1.2c0 .6-.4 1-.9 1.1.5.1.9.5.9 1.1v1.2c0 1 .7 1.5 1.5 1.5h.7V9.7h-.5c-.4 0-.6-.3-.6-.6V7.7c0-.7-.5-1.1-1.1-1.2.6-.1 1.1-.5 1.1-1.2V4.4c0-.3.2-.6.6-.6h.5V2.5h-.7z" fill="#CBCB41" />
        <path d="M10.5 3.5c.8 0 1.5.5 1.5 1.5v1.2c0 .6.4 1 .9 1.1-.5.1-.9.5-.9 1.1v1.2c0 1-.7 1.5-1.5 1.5h-.7V9.7h.5c.4 0 .6-.3.6-.6V7.7c0-.7.5-1.1 1.1-1.2-.6-.1-1.1-.5-1.1-1.2V4.4c0-.3-.2-.6-.6-.6h-.5V2.5h.7z" fill="#CBCB41" />
      </svg>
    ),
  },

  // --- Office 系列：微软官方专业徽标与 Adobe 标志 ---
  word: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#2B579A" />
        <path d="M3.8 4.5l1.6 7h1.4l1.2-4.8 1.2 4.8h1.4l1.6-7h-1.4l-.8 5-1.2-5H7.6l-1.2 5-.8-5H3.8z" fill="#FFFFFF" />
      </svg>
    ),
  },
  excel: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#217346" />
        <path d="M4.6 4.5l2.4 3.5-2.5 3.5h1.7l1.7-2.6 1.7 2.6h1.7l-2.5-3.5 2.4-3.5h-1.6L7.9 7 6.2 4.5H4.6z" fill="#FFFFFF" />
      </svg>
    ),
  },
  powerpoint: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#D24726" />
        <path d="M5.2 4.5h3.4c1.6 0 2.6.8 2.6 2.3 0 1.6-1.1 2.3-2.6 2.3H6.8v2.4H5.2V4.5zm1.6 3.3h1.6c.7 0 1.2-.3 1.2-1 0-.6-.4-.9-1.2-.9H6.8v1.9z" fill="#FFFFFF" />
      </svg>
    ),
  },
  pdf: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#E03131" />
        <path d="M4 11.5V4.5h2.2c1.2 0 1.9.6 1.9 1.7 0 1.1-.7 1.7-1.9 1.7H5.2v3.6H4zm1.2-4.7h.9c.6 0 1-.2 1-.7 0-.4-.4-.7-1-.7h-.9v1.4zm4 4.7V4.5h2.1c1.8 0 2.9 1.1 2.9 3.5 0 2.4-1.1 3.5-2.9 3.5H9.2zm1.2-1.1h.8c1.1 0 1.7-.7 1.7-2.4 0-1.7-.6-2.4-1.7-2.4h-.8v4.8z" fill="#FFFFFF" />
      </svg>
    ),
  },

  // --- 媒体与归档 ---
  archive: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" rx="1.5" fill="#DCB67A" />
        <path d="M2 5.5h12M7.2 2v12m1.6-12v12" stroke="#B89458" strokeWidth="0.8" />
        <rect x="6.8" y="7" width="2.4" height="3" rx="0.5" fill="#5A4A32" />
        <circle cx="8" cy="8.2" r="0.4" fill="#FFFFFF" />
      </svg>
    ),
  },
  image: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <rect x="1.8" y="2.2" width="12.4" height="11.6" rx="2" fill="#26A69A" />
        <circle cx="5.2" cy="5.8" r="1.3" fill="#FFF176" />
        <path d="M2.5 12.5l3.8-4.5 2.5 3 2.5-1.8 2.2 3.3H2.5z" fill="#FFFFFF" opacity="0.9" />
      </svg>
    ),
  },
  shell: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <rect x="1.5" y="2" width="13" height="12" rx="1.8" fill="#2D3748" />
        <path d="M4.5 5.5L7.2 8l-2.7 2.5M8.5 10.5h3" stroke="#48BB78" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  git: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <path d="M14.2 7.3L8.7 1.8a1.2 1.2 0 0 0-1.7 0L5.3 3.5l2.2 2.2a1.4 1.4 0 0 1 1.7 1.8l2.1 2.1a1.4 1.4 0 1 1-.8.8l-2-2v3.3a1.4 1.4 0 1 1-1.2 0V7.8a1.4 1.4 0 0 1-.8-1.8L4.3 3.8 1.8 6.3a1.2 1.2 0 0 0 0 1.7l5.5 5.5c.5.5 1.2.5 1.7 0l5.2-5.2a1.2 1.2 0 0 0 0-1.7z" fill="#F05032" />
      </svg>
    ),
  },
  database: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <ellipse cx="8" cy="4" rx="5.5" ry="2" fill="#E67E22" />
        <path d="M2.5 4v4c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4" stroke="#D35400" strokeWidth="0.8" fill="#E67E22" />
        <path d="M2.5 8v4c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V8" stroke="#D35400" strokeWidth="0.8" fill="#E67E22" />
      </svg>
    ),
  },
  settings: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <path d="M6.8 1.5h2.4l.4 1.6c.4.2.8.4 1.1.7l1.5-.6 1.7 1.7-.6 1.5c.3.3.5.7.7 1.1l1.6.4v2.4l-1.6.4c-.2.4-.4.8-.7 1.1l.6 1.5-1.7 1.7-1.5-.6c-.3.3-.7.5-1.1.7l-.4 1.6H6.8l-.4-1.6c-.4-.2-.8-.4-1.1-.7l-1.5.6-1.7-1.7.6-1.5c-.3-.3-.5-.7-.7-1.1l-1.6-.4V6.8l1.6-.4c.2-.4.4-.8.7-1.1l-.6-1.5 1.7-1.7 1.5.6c.3-.3.7-.5 1.1-.7l.4-1.6z" stroke="#718096" strokeWidth="0.8" fill="#A0AEC0" />
        <circle cx="8" cy="8" r="2.2" fill="#2D3748" />
      </svg>
    ),
  },
  file: {
    viewBox: "0 0 16 16",
    render: ({ size = 16, className }) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
        <path d="M3 2a1.5 1.5 0 0 1 1.5-1.5h5.1a1.5 1.5 0 0 1 1.06.44l2.9 2.9A1.5 1.5 0 0 1 14 4.9V13a2 2 0 0 1-2 2H4.5A1.5 1.5 0 0 1 3 13.5V2z" fill="#8C9BA5" opacity="0.3" stroke="#8C9BA5" strokeWidth="1" />
        <path d="M9.5 1.5V4a1 1 0 0 0 1 1h2.5" stroke="#8C9BA5" strokeWidth="1" />
      </svg>
    ),
  },
};
