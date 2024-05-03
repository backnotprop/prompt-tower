import { TextItem } from "./types";

export const calculateHeight = (
  items: Array<TextItem>,
  parentHeight: number
) => {
  const minHeight = 50;
  const baseHeight = parentHeight - 100; // Room for padding or other elements
  const totalMinHeight = items.length * minHeight;
  let remainingHeight = baseHeight - totalMinHeight;

  // Handle case when even minimum heights cannot be accommodated
  if (remainingHeight < 0) {
    return items.map(() => minHeight); // All items at minimum height
  }

  // Calculate the proportion of each item based on text length
  const totalTextLength = items.reduce((sum, item) => sum + item.textLength, 0);
  const additionalHeights = items.map((item) => {
    return (item.textLength / totalTextLength) * remainingHeight;
  });

  // Add minimum height to the additional height calculated proportionally
  const finalHeights = additionalHeights.map(
    (additionalHeight) => additionalHeight + minHeight
  );

  // Ensure the total does not exceed the baseHeight
  const totalFinalHeight = finalHeights.reduce(
    (sum, height) => sum + height,
    0
  );
  if (totalFinalHeight > baseHeight) {
    const scalingFactor = baseHeight / totalFinalHeight;
    return finalHeights.map(
      (height) => minHeight + (height - minHeight) * scalingFactor
    );
  }

  return finalHeights;
};
