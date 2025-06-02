import fs from "fs";

const FOLDER_SIZE_KEY = "/__FOlDER_SIZE__\\";
const FOLDER_FILES_TOTAL_KEY = "/__FOLDER_CHILDREN__\\";

function bytesToString(bytes: number): string {
  let size = 0;
  let unit = "";

  if (bytes > 1048576) {
    size = Math.round(bytes / 10485.76) / 100;
    unit = "MB";
  } else {
    size = Math.round(bytes / 10.24) / 100;
    unit = "KB";
  }
  return `${size} ${unit}`;
}

function createTreeOutput(
  fileSystem: any,
  maxDepth: number,
  showFileSize: boolean = false
): string[] {
  const createFileOutput = (
    prefix: string,
    fileName: string,
    fileSize: number
  ) => {
    let fileSizeString = "";
    if (fileSize >= 0 && showFileSize) {
      // Display even 0 byte files, but only if showFileSize is true
      fileSizeString = `[${bytesToString(fileSize)}]`;
    }
    // Removed coloring
    return `${prefix}${fileName} ${fileSizeString}`;
  };

  const createFolderOutput = (
    prefix: string,
    filesCount: number,
    folderSize: number,
    folderName: string,
    depth: number
  ) => {
    if (depth < maxDepth) {
      // Max depth is not reached, print only the folder name
      return prefix + `${folderName}/`;
    }

    // Max depth is reached, print the folder name and additional metadata
    const folder = `${folderName}/`;
    const numFilesString = `(${filesCount} ${
      filesCount === 1 ? "file" : "files"
    })`;

    let output = `${prefix}${folder} ${numFilesString}`;

    // Only add folder size if showFileSize is true
    if (showFileSize) {
      const folderSizeString = bytesToString(folderSize);
      const folderSizeFormatted = `[${folderSizeString}]`;
      output += ` ${folderSizeFormatted}`;
    }

    return output;
  };

  const createTreeLayerOutput = (
    tree: any,
    depth: number,
    prefix: string,
    path: string
  ) => {
    // Print all files before folders
    const sortedFolderKeys = Object.keys(tree)
      .filter((key) => typeof tree[key] !== "number")
      .sort();
    const sortedFileKeys = Object.keys(tree)
      .filter((key) => typeof tree[key] === "number")
      .sort();
    const sortedKeys = [...sortedFileKeys, ...sortedFolderKeys].filter(
      (key) => key !== FOLDER_SIZE_KEY && key !== FOLDER_FILES_TOTAL_KEY
    );

    const output: string[] = [];
    for (let i = 0; i < sortedKeys.length; i++) {
      const key = sortedKeys[i];
      const isLast = i === sortedKeys.length - 1;
      const localPrefix = prefix + (isLast ? "└─ " : "├─ ");
      const childPrefix = prefix + (isLast ? "   " : "│  "); // Adjusted spacing slightly for alignment

      if (typeof tree[key] === "number") {
        // It's a file
        output.push(createFileOutput(localPrefix, key, tree[key]));
      } else {
        // It's a folder
        output.push(
          createFolderOutput(
            localPrefix,
            tree[key][FOLDER_FILES_TOTAL_KEY],
            tree[key][FOLDER_SIZE_KEY],
            key,
            depth
          )
        );
        if (depth < maxDepth) {
          output.push(
            ...createTreeLayerOutput(
              tree[key],
              depth + 1,
              childPrefix,
              path + key + "/"
            )
          );
        }
      }
    }
    return output;
  };

  return createTreeLayerOutput(fileSystem, 0, "", "");
}

export async function generateFileStructureTree(
  rootFolder: string,
  filePaths: { origin: string; tree: string }[],
  printLinesLimit: number = Number.MAX_VALUE,
  options: {
    showFileSize?: boolean;
  } = {
    showFileSize: false,
  }
): Promise<string> {
  const folderTree: any = {};
  const depthCounts: number[] = [];

  // Build a tree structure from the file paths
  for (const filePath of filePaths) {
    const parts = filePath.tree.split("/");
    let currentLevel = folderTree;

    parts.forEach((part, depth) => {
      const isFile = depth === parts.length - 1;
      if (!currentLevel[part]) {
        if (isFile) {
          currentLevel[part] = 0; // Initialize file size
        } else {
          currentLevel[part] = {};
          currentLevel[part][FOLDER_SIZE_KEY] = 0;
          currentLevel[part][FOLDER_FILES_TOTAL_KEY] = 0;
        }
        if (depthCounts.length <= depth) {
          depthCounts.push(0);
        }
        depthCounts[depth]++;
      }
      // Traverse down
      // Check if part exists before assigning, handle potential edge cases if needed
      if (currentLevel[part] !== undefined) {
        currentLevel = currentLevel[part];
        // Count children only if it's a folder structure we're descending into
        // And ensure we don't increment count for the special keys
        if (
          !isFile &&
          typeof currentLevel === "object" &&
          currentLevel !== null
        ) {
          // Check if the next part is not the last one (i.e., it's a folder)
          // This check might be redundant if isFile logic is correct, but belt-and-suspenders
          if (depth + 1 < parts.length) {
            // Ensure the key exists before trying to access FOLDER_FILES_TOTAL_KEY
            // This structure is created above if it doesn't exist, but let's be safe
            if (currentLevel.hasOwnProperty(FOLDER_FILES_TOTAL_KEY)) {
              currentLevel[FOLDER_FILES_TOTAL_KEY]++;
            }
          }
        }
      } else {
        // This case should ideally not happen based on the creation logic above
        // But if it does, log an error or handle appropriately
        console.error(
          `Error: Path traversal issue at part '${part}' in path '${filePath.tree}'`
        );
        // Potentially throw an error or break if state becomes invalid
        throw new Error(`Path traversal failed for ${filePath.tree}`);
      }
    });
  }

  // Get max depth depending on the maximum number of lines allowed to print
  let currentDepth = 0;
  let countUpToCurrentDepth = (depthCounts[0] || 0) + 1; /* root folder */ // Handle potentially empty depthCounts[0]
  for (let i = 1; i < depthCounts.length; i++) {
    if (countUpToCurrentDepth + depthCounts[i] > printLinesLimit) {
      break;
    }
    currentDepth++;
    countUpToCurrentDepth += depthCounts[i];
  }
  const maxDepth = currentDepth;

  // Get all file sizes
  const fileSizes: [number, string][] = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        // Ensure the origin path exists and is a file before stating
        const stats = await fs.promises.stat(filePath.origin);
        if (stats.isFile()) {
          return [stats.size, filePath.tree];
        } else {
          console.warn(
            `Warning: Path is not a file, skipping size calculation: ${filePath.origin}`
          );
          return [0, filePath.tree]; // Return 0 size for directories or non-files based on tree structure intent
        }
      } catch (error: any) {
        // Log specific error for debugging
        if (error.code === "ENOENT") {
          console.warn(
            `Warning: File not found, skipping size calculation: ${filePath.origin}`
          );
        } else {
          console.error(`Error stating file ${filePath.origin}:`, error);
        }
        return [0, filePath.tree]; // Return 0 size on error, use filePath.tree for consistency in mapping back
      }
    })
  );

  // Store all file sizes in the tree and calculate total size

  fileSizes.forEach(([size, treePath]) => {
    // Use treePath here for consistency

    const parts = treePath.split("/"); // Use treePath here
    let currentLevel = folderTree;
    parts.forEach((part, index) => {
      // Check if currentLevel exists before proceeding
      if (currentLevel === undefined || currentLevel === null) {
        // This indicates an issue with the tree structure or path
        console.error(
          `Error: Invalid level reached for part '${part}' in path '${treePath}'`
        );
        // Depending on desired robustness, you might throw an error or try to recover/skip
        throw new Error(`Invalid tree structure encountered for ${treePath}`);
      }

      const isLastPart = index === parts.length - 1;

      if (isLastPart && typeof currentLevel[part] === "number") {
        // It's the file leaf node, assign its size
        currentLevel[part] = size;
      } else if (
        !isLastPart &&
        typeof currentLevel[part] === "object" &&
        currentLevel[part] !== null
      ) {
        // It's a folder node, add size to its total and descend
        if (currentLevel[part].hasOwnProperty(FOLDER_SIZE_KEY)) {
          currentLevel[part][FOLDER_SIZE_KEY] += size;
        } else {
          // This case implies the folder node wasn't initialized correctly
          console.warn(
            `Warning: Folder node missing expected keys for part '${part}' in path '${treePath}'`
          );
          // Initialize if necessary? Or handle as error? For now, just add size if possible.
          currentLevel[part][FOLDER_SIZE_KEY] = size; // Attempt recovery
        }
        currentLevel = currentLevel[part]; // Descend to the next level
      } else if (currentLevel.hasOwnProperty(part)) {
        // It exists, but it's not the expected type (e.g., trying to traverse into a file as if it's a folder)
        console.error(
          `Error: Structure mismatch at part '${part}' in path '${treePath}'. Expected ${
            isLastPart ? "number (file)" : "object (folder)"
          }, found ${typeof currentLevel[part]}`
        );
        throw new Error(`Structure mismatch encountered for ${treePath}`);
      } else {
        // Part doesn't exist - this shouldn't happen if the initial tree build was correct
        console.error(
          `Error: Missing part '${part}' in tree structure for path '${treePath}'`
        );
        throw new Error(`Inconsistent tree structure for ${treePath}`);
      }
    });
  });

  const rootFolderName = rootFolder.split("/").pop() || "";
  // --- Assemble final output string ---
  let outputLines: string[] = [];
  outputLines.push(rootFolderName); // Use rootFolder name directly
  outputLines.push(
    ...createTreeOutput(folderTree, maxDepth, options.showFileSize)
  ); // Get the tree lines

  // Join lines and log to console
  const finalOutputString = outputLines.join("\n");
  return finalOutputString;
}
