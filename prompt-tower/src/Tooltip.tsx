import {
  FloatingPortal,
  Placement,
  autoUpdate,
  // flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { ReactNode, cloneElement, useState } from "react";
import "./Tooltip.css";

export type TooltipProps = {
  content: ReactNode;
  showDelay?: number;
  hideDelay?: number;
  placement?: Placement;
  children: JSX.Element;
  maxWidth?: number;
};

export const Tooltip = ({
  content,
  showDelay = 500,
  hideDelay = 100,
  placement = "left-start",
  children,
  maxWidth,
}: TooltipProps) => {
  const [open, setOpen] = useState(false);

  const {
    x,
    y,
    reference,
    floating,
    strategy,
    context,
    placement: _computedPlacement,
  } = useFloating({
    placement,
    open,
    onOpenChange(open) {
      setOpen(open);
    },
    middleware: [offset(5), shift({ padding: 8 })], // flip(),
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { delay: showDelay, restMs: hideDelay }),
    useFocus(context),
    useRole(context, { role: "tooltip" }),
    useDismiss(context),
  ]);

  return (
    <>
      {cloneElement(
        children,
        getReferenceProps({ ref: reference, ...children.props })
      )}
      <FloatingPortal>
        {open && (
          <div
            {...getFloatingProps({
              ref: floating,
              className: "Tooltip",
              style: {
                position: strategy,
                top: y ?? 0,
                left: x ?? 0,
                // overflowY: "auto",
                // overflowX: "scroll",
                maxWidth: maxWidth ? maxWidth - 50 : "auto",
              },
            })}
          >
            {content}
          </div>
        )}
      </FloatingPortal>
    </>
  );
};
