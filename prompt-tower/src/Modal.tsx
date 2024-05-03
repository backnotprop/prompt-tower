import { useState } from "react";
import { useFloating, shift, offset } from "@floating-ui/react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { TextItem } from "./types";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (item: TextItem) => void;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [text, setText] = useState("");

  const { x, y, reference, floating, strategy } = useFloating({
    placement: "right",
    middleware: [offset(10), shift()],
  });

  const handleSubmit = () => {
    const newItem: TextItem = {
      type: "manual",
      text,
      languageId: "manual",
      textLength: text.length,
      previewText: text.substring(0, 50),
      timestamp: new Date().toLocaleTimeString(),
      fileName: "modal submit",
    };
    onSubmit(newItem);
    onClose();
    setText("");
  };

  const modalAnimation = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={modalAnimation}
          transition={{ duration: 0.2 }}
          style={{
            position: strategy,
            top: y ?? "",
            // left: 10,
            transform: "translateX(-100%)",
            backgroundColor: "var(--vscode-editor-background)",
            color: "var(--vscode-editor-foreground)",
            border: "1px solid var(--vscode-editorGroup-border)",
            padding: "20px",
            zIndex: 1000,
            width: "300px",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          }}
          ref={floating}
        >
          <div ref={reference}>
            <textarea
              style={{ marginBottom: "10px", width: "100%" }}
              placeholder="Text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
            />

            <button onClick={handleSubmit} style={{ marginRight: "10px" }}>
              Submit
            </button>
            <button onClick={onClose}>Close</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
