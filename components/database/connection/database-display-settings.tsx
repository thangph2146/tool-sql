"use client";

import { useState, useEffect } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getMaxDatabasesToShow,
  setMaxDatabasesToShow,
} from "@/lib/utils/db-config-storage";

interface DatabaseDisplaySettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DatabaseDisplaySettings({
  open,
  onOpenChange,
}: DatabaseDisplaySettingsProps) {
  const [maxDatabases, setMaxDatabases] = useState<1 | 2>(2);

  // Load current setting when dialog opens
  useEffect(() => {
    if (open) {
      setMaxDatabases(getMaxDatabasesToShow());
    }
  }, [open]);

  const handleSave = () => {
    setMaxDatabasesToShow(maxDatabases);
    onOpenChange(false);
    // Reload page to apply new setting
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Cấu hình hiển thị Database
          </DialogTitle>
          <DialogDescription>
            Chọn số lượng database hiển thị trên giao diện
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Số lượng database hiển thị</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="maxDatabases"
                  value="1"
                  checked={maxDatabases === 1}
                  onChange={() => setMaxDatabases(1)}
                  className="h-4 w-4"
                />
                <span>1 Database</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="maxDatabases"
                  value="2"
                  checked={maxDatabases === 2}
                  onChange={() => setMaxDatabases(2)}
                  className="h-4 w-4"
                />
                <span>2 Databases</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Chọn số lượng database card hiển thị trên trang chính. 
              Nếu chọn 1, chỉ database đầu tiên được enable sẽ hiển thị.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSave}>
            Lưu cấu hình
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

