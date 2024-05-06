import { useState, CSSProperties } from "react";

import { Reorder, useMotionValue } from "framer-motion";
import { useRaisedShadow } from "./use-raised-shadow";

import { Tooltip } from "./Tooltip";

import { TextItem } from "./types";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { faEye } from "@fortawesome/free-regular-svg-icons";

interface ItemProps {
  item: TextItem;
  style: React.CSSProperties;
  parentWidth: number;
}

const styleButton: CSSProperties = {
  position: "absolute",
  left: "50%",
  transform: "translateX(-50%)",
  background: "var(--vscode-editor-selectionBackground)",
  color: "var(--vscode-editor-selectionForeground)",
  fontWeight: "bold",
  borderRadius: "50%",
  height: "20px",
  width: "20px",
  padding: "0",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  cursor: "pointer",
};

export const Item = ({
  item,
  style,
  parentWidth,
  onAddAbove,
  onAddBelow,
}: ItemProps & { onAddAbove: () => void; onAddBelow: () => void }) => {
  const y = useMotionValue(0);
  const boxShadow = useRaisedShadow(y);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Reorder.Item
      value={item}
      id={item.languageId}
      style={{
        ...style,
        boxShadow,
        y,
        position: "relative",

        border: isHovered
          ? "1px solid var(--vscode-lineHighlightBorder)"
          : "1px solid transparent",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          position: "relative",
          // padding: "20px 0",
        }}
      >
        <div>
          <span style={{ fontWeight: "bold" }}>
            <em>{item.type}</em> {" - "}
          </span>
          <span style={{ fontWeight: "bold" }}>
            {item.type !== "file" && item.type !== "manual" ? "within " : ""}

            {item.fileName}
          </span>
          <br />
          <em style={{ fontSize: ".89em", marginTop: "4px" }}>preview:</em>
          <code style={{ fontSize: ".89em" }}>{item.previewText}</code>
        </div>

        <Tooltip
          maxWidth={parentWidth}
          content={
            <pre
              style={{
                overflowX: "hidden",
                // backgroundColor: "var(--vscode-quickInput-background)",
                backgroundColor: "var(--vscode-editor-background)",
                padding: "10px",
                borderRadius: "5px",
                marginTop: "10px",
                width: "100%",
                boxSizing: "border-box",
                fontSize: "9px",
                zIndex: 999999999999999,
              }}
            >
              <code>{item.text}</code>
            </pre>
          }
        >
          <span
            style={{
              fontSize: "14px",
              cursor: "default",
            }}
          >
            {/* 👁️ */}
            <FontAwesomeIcon
              color="var(--vscode-editor-foreground)"
              className="rct-icon rct-icon-check"
              icon={faEye}
            />
          </span>
        </Tooltip>
      </div>
      {isHovered && (
        <>
          <button onClick={onAddAbove} style={{ ...styleButton, top: "-10px" }}>
            +
          </button>
          <button
            onClick={onAddBelow}
            style={{ ...styleButton, bottom: "-10px" }}
          >
            +
          </button>
        </>
      )}
    </Reorder.Item>
  );
};
