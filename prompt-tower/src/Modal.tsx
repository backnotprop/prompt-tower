import { useState } from "react";
import { useFloating, shift, offset } from "@floating-ui/react-dom";
import { AnimatePresence, motion } from "framer-motion";
import CheckboxTree, { Node } from "react-checkbox-tree";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckSquare,
  faSquare,
  faChevronRight,
  faChevronDown,
  faPlusSquare,
  faMinusSquare,
  faFolder,
  faFolderOpen,
  faFile,
} from "@fortawesome/free-solid-svg-icons";

import { TextItem } from "./types";

declare function acquireVsCodeApi(): any;
// //  ^ will exist in window object
// interface vscode {
//   postMessage(message: any): void;
// }

// declare const vscode: vscode;

const icons = {
  check: (
    <FontAwesomeIcon
      color="var(--vscode-editor-foreground)"
      className="rct-icon rct-icon-check"
      icon={faCheckSquare}
    />
  ),
  uncheck: (
    <FontAwesomeIcon
      color="var(--vscode-editor-foreground)"
      className="rct-icon rct-icon-uncheck"
      icon={faSquare}
    />
  ),
  halfCheck: (
    <FontAwesomeIcon
      color="var(--vscode-editor-foreground)"
      className="rct-icon rct-icon-half-check"
      icon={faCheckSquare}
    />
  ),
  expandClose: (
    <FontAwesomeIcon
      color="var(--vscode-editor-foreground)"
      className="rct-icon rct-icon-expand-close"
      icon={faChevronRight}
    />
  ),
  expandOpen: (
    <FontAwesomeIcon
      color="var(--vscode-editor-foreground)"
      className="rct-icon rct-icon-expand-close"
      // icon="chevron-down"
      icon={faChevronDown}
    />
  ),
  expandAll: (
    <FontAwesomeIcon
      color="var(--vscode-editor-foreground)"
      className="rct-icon rct-icon-expand-close"
      // icon="plus-square"
      icon={faPlusSquare}
    />
  ),
  collapseAll: (
    <FontAwesomeIcon
      color="var(--vscode-editor-foreground)"
      className="rct-icon rct-icon-expand-close"
      // icon="minus-square"
      icon={faMinusSquare}
    />
  ),
  parentClose: (
    <FontAwesomeIcon
      color="var(--vscode-editor-foreground)"
      className="rct-icon rct-icon-expand-close"
      // icon="folder"
      icon={faFolder}
    />
  ),
  parentOpen: (
    <FontAwesomeIcon
      color="var(--vscode-editor-foreground)"
      className="rct-icon rct-icon-expand-close"
      // icon="folder-open"
      icon={faFolderOpen}
    />
  ),
  leaf: (
    <FontAwesomeIcon
      color="var(--vscode-editor-foreground)"
      className="rct-icon rct-icon-expand-close"
      // icon="file"
      icon={faFile}
    />
  ),
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (item: TextItem) => void;
  mode: "input" | "select";
  selectLoading?: boolean;
  nodes?: Node[];
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  mode,
  selectLoading,
  nodes,
}) => {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<Array<string>>([]);
  const [expanded, setExpanded] = useState<Array<string>>([]);

  // const [showChecked, setShowChecked] = useState(false);

  const { y, reference, floating, strategy } = useFloating({
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

  const handleMultiSubmit = () => {
    const vscode = acquireVsCodeApi();
    console.log(vscode);
    checked.map((item) => {
      vscode.postMessage({
        command: "requestFileContent",
        filePath: item,
      });
    });
    onClose();

    // console.log(checked);
    // setShowChecked(true);
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
            top: mode == "input" ? y ?? "" : mode === "select" ? "25px" : 0,
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
            {mode === "input" && (
              <>
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
              </>
            )}
            {mode === "select" && (
              <>
                {selectLoading && (
                  <div style={{ marginBottom: "10px" }}>Loading...</div>
                )}
                {!selectLoading && nodes && (
                  <div
                    // mif checkbox grows we need to be able to scroll
                    style={{
                      overflowY: "auto",
                      maxHeight: "calc(100vh - 200px)",
                      width: "100%",
                    }}
                  >
                    <CheckboxTree
                      nodes={nodes as Node[]}
                      checked={checked}
                      expanded={expanded}
                      onCheck={(checked) => setChecked(checked)}
                      onExpand={(expanded) => setExpanded(expanded)}
                      icons={icons}
                    />
                    <br />
                    <p
                      style={{
                        color: "var(--vscode-editor-foreground)",
                        display: "flex",
                        justifyContent: "center",
                        width: "100%",
                      }}
                    >
                      ({checked.length} selected)
                    </p>
                    <br />
                    <a
                      onClick={handleMultiSubmit}
                      style={{
                        cursor: "pointer",
                        color: "--var( --vscode-textLink-foreground)",
                        display: "flex",
                        justifyContent: "center",
                        width: "100%",
                      }}
                    >
                      Submit
                    </a>
                    {/* {showChecked && (
                      <div>
                        {checked.map((item) => (
                          <div key={item}>{item}</div>
                        ))}
                      </div>
                    )} */}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
