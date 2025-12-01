"use client";

import { useState, useEffect, useMemo } from "react";
import { Settings, Save, RotateCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { DatabaseName, DatabaseConfigItem } from "@/lib/db-config";
import { getDatabaseConfig } from "@/lib/db-config";
import {
  getMergedDatabaseConfig,
  updateUserDatabaseConfig,
  getUserDatabaseConfig,
  resetUserDatabaseConfig,
} from "@/lib/utils/db-config-storage";
import { DEFAULT_DB_PORT, DEFAULT_CONNECTION_TIMEOUT, DEFAULT_REQUEST_TIMEOUT } from "@/lib/constants/db-constants";

interface DatabaseConfigDialogProps {
  databaseName: DatabaseName;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigSaved?: () => void;
}

export function DatabaseConfigDialog({
  databaseName,
  open,
  onOpenChange,
  onConfigSaved,
}: DatabaseConfigDialogProps) {
  const envConfig = getDatabaseConfig(databaseName);
  const mergedConfig = getMergedDatabaseConfig(databaseName);

  const [config, setConfig] = useState<Partial<DatabaseConfigItem>>({
    displayName: mergedConfig.displayName,
    server: mergedConfig.server,
    port: mergedConfig.port,
    instanceName: mergedConfig.instanceName,
    database: mergedConfig.database,
    useWindowsAuth: mergedConfig.useWindowsAuth,
    user: mergedConfig.user,
    password: mergedConfig.password,
    connectionTimeout: mergedConfig.connectionTimeout,
    requestTimeout: mergedConfig.requestTimeout,
    enabled: mergedConfig.enabled,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset config when dialog opens or database changes
  useEffect(() => {
    if (open) {
      const currentMerged = getMergedDatabaseConfig(databaseName);
      // Use setTimeout to defer state update and avoid cascading renders
      setTimeout(() => {
        setConfig({
          displayName: currentMerged.displayName,
          server: currentMerged.server,
          port: currentMerged.port,
          instanceName: currentMerged.instanceName,
          database: currentMerged.database,
          useWindowsAuth: currentMerged.useWindowsAuth,
          user: currentMerged.user,
          password: currentMerged.password,
          connectionTimeout: currentMerged.connectionTimeout,
          requestTimeout: currentMerged.requestTimeout,
          enabled: currentMerged.enabled,
        });
        setHasChanges(false);
      }, 0);
    }
  }, [open, databaseName]);

  // Check for changes
  useEffect(() => {
    const currentMerged = getMergedDatabaseConfig(databaseName);
    const hasChangesCheck =
      config.displayName !== currentMerged.displayName ||
      config.server !== currentMerged.server ||
      config.port !== currentMerged.port ||
      config.instanceName !== currentMerged.instanceName ||
      config.database !== currentMerged.database ||
      config.useWindowsAuth !== currentMerged.useWindowsAuth ||
      config.user !== currentMerged.user ||
      config.password !== currentMerged.password ||
      config.connectionTimeout !== currentMerged.connectionTimeout ||
      config.requestTimeout !== currentMerged.requestTimeout ||
      config.enabled !== currentMerged.enabled;

    // Use setTimeout to defer state update and avoid cascading renders
    setTimeout(() => {
      setHasChanges(hasChangesCheck);
    }, 0);
  }, [config, databaseName]);

  const handleSave = () => {
    updateUserDatabaseConfig(databaseName, config);
    setHasChanges(false);
    onConfigSaved?.();
    // Reload page to apply new config
    window.location.reload();
  };

  const handleReset = () => {
    resetUserDatabaseConfig(databaseName);
    setConfig({
      displayName: envConfig.displayName,
      server: envConfig.server,
      port: envConfig.port,
      instanceName: envConfig.instanceName,
      database: envConfig.database,
      useWindowsAuth: envConfig.useWindowsAuth,
      user: envConfig.user,
      password: envConfig.password,
      connectionTimeout: envConfig.connectionTimeout,
      requestTimeout: envConfig.requestTimeout,
      enabled: envConfig.enabled,
    });
    setHasChanges(false);
    onConfigSaved?.();
    // Reload page to apply reset config
    window.location.reload();
  };

  const isUsingUserConfig = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const userConfigs = getUserDatabaseConfig();
    return !!userConfigs[databaseName];
  }, [databaseName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Cấu hình Database: {databaseName}
          </DialogTitle>
          <DialogDescription>
            Nhập thông số kết nối database. Nếu để trống, hệ thống sẽ sử dụng cấu hình từ file .env
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Display Name */}
          <Field>
            <FieldLabel>Tên hiển thị</FieldLabel>
            <FieldContent>
              <Input
                value={config.displayName || ""}
                onChange={(e) =>
                  setConfig({ ...config, displayName: e.target.value })
                }
                placeholder={envConfig.displayName}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Giá trị mặc định: {envConfig.displayName}
              </p>
            </FieldContent>
          </Field>

          {/* Server */}
          <Field>
            <FieldLabel>Server *</FieldLabel>
            <FieldContent>
              <Input
                value={config.server || ""}
                onChange={(e) =>
                  setConfig({ ...config, server: e.target.value })
                }
                placeholder={envConfig.server}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ví dụ: DESKTOP-F3UFVI3\SQLEXPRESS hoặc localhost
              </p>
            </FieldContent>
          </Field>

          {/* Port and Instance Name */}
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Port</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  value={config.port || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      port: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder={envConfig.port?.toString() || String(DEFAULT_DB_PORT)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mặc định: {envConfig.port || "Không có"}
                </p>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>Instance Name</FieldLabel>
              <FieldContent>
                <Input
                  value={config.instanceName || ""}
                  onChange={(e) =>
                    setConfig({ ...config, instanceName: e.target.value || undefined })
                  }
                  placeholder={envConfig.instanceName || "SQLEXPRESS"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mặc định: {envConfig.instanceName || "Không có"}
                </p>
              </FieldContent>
            </Field>
          </div>

          {/* Database Name */}
          <Field>
            <FieldLabel>Tên Database *</FieldLabel>
            <FieldContent>
              <Input
                value={config.database || ""}
                onChange={(e) =>
                  setConfig({ ...config, database: e.target.value })
                }
                placeholder={envConfig.database}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Giá trị mặc định: {envConfig.database}
              </p>
            </FieldContent>
          </Field>

          {/* Windows Authentication */}
          <Field>
            <FieldContent>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useWindowsAuth"
                  checked={config.useWindowsAuth ?? true}
                  onChange={(e) =>
                    setConfig({ ...config, useWindowsAuth: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="useWindowsAuth" className="cursor-pointer">
                  Sử dụng Windows Authentication
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mặc định: {envConfig.useWindowsAuth ? "Có" : "Không"}
              </p>
            </FieldContent>
          </Field>

          {/* User and Password (only if not using Windows Auth) */}
          {!config.useWindowsAuth && (
            <>
              <Field>
                <FieldLabel>User</FieldLabel>
                <FieldContent>
                  <Input
                    value={config.user || ""}
                    onChange={(e) =>
                      setConfig({ ...config, user: e.target.value || undefined })
                    }
                    placeholder={envConfig.user || "sa"}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Mặc định: {envConfig.user || "Không có"}
                  </p>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>Password</FieldLabel>
                <FieldContent>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={config.password || ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          password: e.target.value || undefined,
                        })
                      }
                      placeholder="••••••••"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    >
                      {showPassword ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mặc định: {envConfig.password ? "••••••••" : "Không có"}
                  </p>
                </FieldContent>
              </Field>
            </>
          )}

          {/* Timeouts */}
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Connection Timeout (ms)</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  value={config.connectionTimeout || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      connectionTimeout: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder={envConfig.connectionTimeout?.toString() || String(DEFAULT_CONNECTION_TIMEOUT)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mặc định: {envConfig.connectionTimeout || DEFAULT_CONNECTION_TIMEOUT}ms
                </p>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>Request Timeout (ms)</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  value={config.requestTimeout || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      requestTimeout: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder={envConfig.requestTimeout?.toString() || String(DEFAULT_REQUEST_TIMEOUT)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mặc định: {envConfig.requestTimeout || DEFAULT_REQUEST_TIMEOUT}ms
                </p>
              </FieldContent>
            </Field>
          </div>

          {/* Enabled */}
          <Field>
            <FieldContent>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={config.enabled ?? true}
                  onChange={(e) =>
                    setConfig({ ...config, enabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="enabled" className="cursor-pointer">
                  Kích hoạt database này
                </Label>
              </div>
            </FieldContent>
          </Field>

          {/* Info about current config source */}
          {isUsingUserConfig && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                ⓘ Đang sử dụng cấu hình người dùng. Nhấn &quot;Reset về mặc định&quot; để quay lại cấu hình từ .env
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!isUsingUserConfig}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset về mặc định
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              Lưu cấu hình
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

