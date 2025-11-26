"use client";

import { bufferToDataUrl, formatCellValue } from "@/lib/utils/table-cell-utils";

interface TableCellProps {
  value: unknown;
}

/**
 * Component to render table cell with support for images and various data types
 */
export function TableCell({ value }: TableCellProps) {
  const dataUrl = bufferToDataUrl(value);
  const displayText = formatCellValue(value);
  
  if (dataUrl) {
    return (
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt="Table image"
          className="h-12 w-12 object-contain rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            // Open image in new window/tab
            const newWindow = window.open();
            if (newWindow) {
              newWindow.document.write(`
                <html>
                  <head><title>Image Viewer</title></head>
                  <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#1a1a1a;">
                    <img src="${dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                  </body>
                </html>
              `);
            }
          }}
          title="Click to view full size"
        />
        <span className="text-xs text-muted-foreground truncate">{displayText}</span>
      </div>
    );
  }
  
  return (
    <div className="truncate" title={displayText}>
      {value !== null && value !== undefined ? (
        displayText
      ) : (
        <span className="text-muted-foreground italic">NULL</span>
      )}
    </div>
  );
}

