import { useEffect, useState, useRef, useMemo } from "react";
import { Reorder } from "framer-motion";
import { Node } from "react-checkbox-tree";
// import { Tiktoken } from "tiktoken/lite";
// import cl100k_base from "tiktoken/encoders/cl100k_base.json";

import { encode } from "gpt-tokenizer/model/gpt-4";

import { Modal } from "./Modal";
import { Item } from "./Item";

import { TextItem } from "./types";
import { calculateHeight } from "./utils";

import "./App.css";

export default function App() {
  const [items, setItems] = useState<TextItem[]>([]);
  const [parentHeight, setParentHeight] = useState(0);
  const [parentWidth, setParentWidth] = useState(0);
  const [isInputModalOpen, setInputModalOpen] = useState(false);
  const [isSelectModalOpen, setSelectModalOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | undefined>(
    undefined
  );

  const [isCopied, setIsCopied] = useState(false);
  const [isLoadingFileTree, setIsLoadingFileTree] = useState(false);
  const [fileTreeNodes, setFileTreeNodes] = useState<Node[]>([]);

  const parentRef = useRef<HTMLDivElement>(null);

  const [tokenCount, setTokenCount] = useState(0);

  const allText = useMemo(() => {
    return items
      .map((item) => {
        if (item.type !== "manual") {
          return `\`\`\`${item.fileName}\n${item.text}\n\`\`\`\n\n`; // Adds code block formatting with file name
        } else {
          return `${item.text}\n`; // Just adds the text with a newline
        }
      })
      .join(""); // Joins all items' text together
  }, [items]);

  useEffect(() => {
    console.log("allText", allText);
    const tokens = encode(allText);
    setTokenCount(tokens.length);
  }, [allText]);

  useEffect(() => {
    if (parentRef.current) {
      setParentHeight(parentRef.current.clientHeight);
      setParentWidth(parentRef.current.clientWidth);
    }

    const handleMessage = (event: MessageEvent) => {
      const { command, text, languageId, type, fileName, fileTree } =
        event.data;
      if (command === "sendText") {
        const newItem: TextItem = {
          languageId,
          text,
          type,
          textLength: text.length,
          fileName: fileName || "unknown",
          previewText: text.substring(0, 50),
          timestamp: new Date().toLocaleTimeString(),
        };
        setItems((prevItems) => [...prevItems, newItem]);
        return;
      }

      if (command === "directorySelectModeLoading") {
        setIsLoadingFileTree(true);
        setSelectModalOpen(true);
        return;
      }

      if (command === "directorySelectModeLoaded") {
        setFileTreeNodes(fileTree);
        setIsLoadingFileTree(false);
        return;
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setParentHeight(entry.contentRect.height);
        setParentWidth(entry.contentRect.width);
      }
    });

    if (parentRef.current) {
      resizeObserver.observe(parentRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const addItemAbove = (index: number) => {
    setCurrentItemIndex(index);
    setInputModalOpen(true);
  };

  const addItemBelow = (index: number) => {
    setCurrentItemIndex(index + 1);
    setInputModalOpen(true);
  };

  const handleModalSubmit = (newItem: TextItem) => {
    setItems((prevItems) => [
      ...prevItems.slice(0, currentItemIndex),
      newItem,
      ...prevItems.slice(currentItemIndex),
    ]);
  };

  const setIsCopiedAndDelayedRemoved = () => {
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 5000);
  };

  const handleCopyPrompt = () => {
    // const allText = items
    //   .map((item) => {
    //     // item.fileName
    //     if (item.type !== "manual") {
    //       // return `\`\`\`\n${item.text}\n\`\`\`\n\n`; // Adds code block formatting
    //       return `\`\`\`${item.fileName}\n${item.text}\n\`\`\`\n\n`; // Adds code block formatting with file name
    //     } else {
    //       return `${item.text}\n`; // Just adds the text with a newline
    //     }
    //   })
    //   .join(""); // Joins all items' text together
    navigator.clipboard.writeText(allText);
    setIsCopiedAndDelayedRemoved();
  };

  const handleClearAll = () => {
    setItems([]);
  };

  const heights = calculateHeight(items, parentHeight);
  const enableScroll =
    heights.every((height) => height >= 50) &&
    items.length * 50 > parentHeight - 200;

  return (
    <div
      style={{
        height: "100vh",

        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex" }}>
        <a
          onClick={handleCopyPrompt}
          className="custom-links"
          style={{ cursor: "pointer" }}
        >
          Copy Prompt
        </a>
        {isCopied && <span style={{ marginLeft: "10px" }}>Copied!</span>}
        <span
          style={{
            position: "absolute",
            top: 10,
            right: 20,
            color: "var(--vscode-editor-foreground)",
            opacity: 0.85,
            fontSize: "1.155em",
            // make brighter:
            filter: "brightness(1.2)",
          }}
        >
          Tokens: {tokenCount}
        </span>
      </div>

      <Modal
        mode="input"
        isOpen={isInputModalOpen}
        onClose={() => setInputModalOpen(false)}
        onSubmit={handleModalSubmit}
      />
      <Modal
        mode="select"
        isOpen={isSelectModalOpen}
        onClose={() => setSelectModalOpen(false)}
        onSubmit={handleModalSubmit}
        selectLoading={isLoadingFileTree}
        nodes={fileTreeNodes}
      />
      <span className="reordergroup">
        <Reorder.Group
          ref={parentRef}
          axis="y"
          onReorder={setItems}
          values={items}
          style={{
            width: "calc(100vw)",
            height: "calc(100vh - 200px)",
            maxHeight: "calc(100vh - 200px)",
            overflowY: enableScroll ? "scroll" : "hidden",
            boxSizing: "border-box",

            paddingLeft: "25px",
            paddingRight: "25px",
          }}
        >
          {items.map((item, index) => (
            <Item
              key={item.languageId + item.timestamp}
              item={item}
              style={{ height: `${heights[index]}px`, minHeight: "50px" }}
              onAddAbove={() => addItemAbove(index)}
              onAddBelow={() => addItemBelow(index)}
              parentWidth={parentWidth}
            />
          ))}
        </Reorder.Group>
      </span>

      <a
        onClick={handleClearAll}
        className="custom-links"
        style={{ cursor: "pointer" }}
      >
        Clear All
      </a>
    </div>
  );
}
