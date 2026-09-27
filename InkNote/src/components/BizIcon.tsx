import React from "react";
import { resolveBizIcon, resolveBizIconKey } from "../icons/icon-map";
import { VSCODE_ICONS } from "../icons/iconData";

export interface BizIconProps {
  name?: string;
  isDir?: boolean;
  isOpen?: boolean;
  iconKey?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 统一业务图标组件（React 19 版同构实现）
 * 支持根据文件名、扩展名、目录展开状态自动解析 VS Code / PyCharm 风格图标。
 */
export default function BizIcon({
  name = "",
  isDir = false,
  isOpen = false,
  iconKey,
  size = 16,
  className = "",
  style,
}: BizIconProps) {
  const iconDef = iconKey ? (VSCODE_ICONS[iconKey] ?? VSCODE_ICONS.file) : resolveBizIcon(name, isDir, isOpen);
  const combinedClassName = ["biz-icon", className].filter(Boolean).join(" ");

  return (
    <span
      className={combinedClassName}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        verticalAlign: "middle",
        ...style,
      }}
      data-icon-key={iconKey ?? resolveBizIconKey(name, isDir, isOpen)}
    >
      {iconDef.render({ size })}
    </span>
  );
}
