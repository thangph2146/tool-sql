# Script tu dong kiem tra va khac phuc ket noi SQL Server
# Tich hop tat ca chuc nang: Service, TCP/IP, Port, Windows Authentication, Login
# CHAY VOI QUYEN ADMINISTRATOR de co day du chuc nang - 
# Run with Administrator privileges - powershell -ExecutionPolicy Bypass -File ".\scripts\fix-sql-connection.ps1"
param(
    [string]$ServerName = "DESKTOP-F3UFVI3",
    [string]$InstanceName = "SQLEXPRESS",
    [int]$Port = 0  # 0 = tu dong tim port
)

# Cau hinh UTF-8 encoding cho PowerShell output (sau param)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
try {
    chcp 65001 | Out-Null
} catch {
    # Ignore neu khong the set code page
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tu dong kiem tra va khac phuc SQL Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$fullServerName = "$ServerName\$InstanceName"
$serviceName = "MSSQL`$$InstanceName"

# Kiem tra quyen Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

Write-Host "[INFO] Tai khoan hien tai: $currentUser" -ForegroundColor Green
if (-not $isAdmin) {
    Write-Host "[WARNING] Khong co quyen Administrator - mot so chuc nang se bi han che" -ForegroundColor Yellow
    Write-Host ""
}

# ========================================
# 1. KIEM TRA VA KHOI DONG SQL SERVER SERVICE
# ========================================
Write-Host "[1] Kiem tra SQL Server Service..." -ForegroundColor Yellow
$sqlService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($sqlService) {
    if ($sqlService.Status -eq "Running") {
        Write-Host "  [OK] SQL Server ($InstanceName) dang chay" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] SQL Server ($InstanceName) khong chay" -ForegroundColor Yellow
        if ($isAdmin) {
            Write-Host "  Dang khoi dong..." -ForegroundColor Gray
            Start-Service -Name $serviceName -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 3
            if ((Get-Service -Name $serviceName).Status -eq "Running") {
                Write-Host "  [OK] Da khoi dong SQL Server" -ForegroundColor Green
            } else {
                Write-Host "  [ERROR] Khong the khoi dong SQL Server" -ForegroundColor Red
            }
        } else {
            Write-Host "  Can quyen Administrator de khoi dong service" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  [ERROR] Khong tim thay SQL Server service: $serviceName" -ForegroundColor Red
    Write-Host "  Kiem tra: Get-Service | Where-Object {`$_.Name -like '*SQL*'}" -ForegroundColor Yellow
}

# ========================================
# 2. KIEM TRA VA KHOI DONG SQL BROWSER SERVICE
# ========================================
Write-Host ""
Write-Host "[2] Kiem tra SQL Server Browser Service..." -ForegroundColor Yellow
$browserService = Get-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
if ($browserService) {
    if ($browserService.Status -eq "Running") {
        Write-Host "  [OK] SQL Server Browser dang chay" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] SQL Server Browser khong chay" -ForegroundColor Yellow
        if ($isAdmin) {
            Write-Host "  Dang khoi dong..." -ForegroundColor Gray
            Start-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            if ((Get-Service -Name "SQLBrowser").Status -eq "Running") {
                Write-Host "  [OK] Da khoi dong SQL Browser" -ForegroundColor Green
            } else {
                Write-Host "  [ERROR] Khong the khoi dong SQL Browser" -ForegroundColor Red
            }
        } else {
            Write-Host "  Can quyen Administrator de khoi dong service" -ForegroundColor Yellow
        }
    }
    
    # Set StartupType = Automatic
    if ($isAdmin) {
        $startType = (Get-Service -Name "SQLBrowser").StartType
        if ($startType -ne "Automatic") {
            Write-Host "  Dang set StartupType = Automatic..." -ForegroundColor Gray
            Set-Service -Name "SQLBrowser" -StartupType Automatic -ErrorAction SilentlyContinue
            Write-Host "  [OK] Da set StartupType = Automatic" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  [WARNING] SQL Server Browser khong duoc tim thay" -ForegroundColor Yellow
}

# ========================================
# 3. KIEM TRA VA ENABLE TCP/IP
# ========================================
Write-Host ""
Write-Host "[3] Kiem tra TCP/IP Protocol..." -ForegroundColor Yellow
if ($isAdmin) {
    try {
        # Tim Instance ID
        $instanceReg = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL" -ErrorAction SilentlyContinue
        if ($instanceReg) {
            $instanceId = $instanceReg.$InstanceName
            if ($instanceId) {
                $tcpPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer\SuperSocketNetLib\Tcp"
                
                if (Test-Path $tcpPath) {
                    $tcpEnabled = (Get-ItemProperty -Path $tcpPath -Name "Enabled" -ErrorAction SilentlyContinue).Enabled
                    if ($tcpEnabled -eq 1) {
                        Write-Host "  [OK] TCP/IP da duoc enable" -ForegroundColor Green
                    } else {
                        Write-Host "  [WARNING] TCP/IP chua duoc enable" -ForegroundColor Yellow
                        Write-Host "  Dang enable TCP/IP..." -ForegroundColor Gray
                        Set-ItemProperty -Path $tcpPath -Name "Enabled" -Value 1 -ErrorAction Stop
                        Write-Host "  [OK] Da enable TCP/IP" -ForegroundColor Green
                        $needRestart = $true
                    }
                } else {
                    Write-Host "  [WARNING] Khong tim thay TCP configuration path" -ForegroundColor Yellow
                }
            }
        }
    } catch {
        Write-Host "  [ERROR] Loi khi kiem tra/enable TCP/IP: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  [INFO] Can quyen Administrator de kiem tra/enable TCP/IP" -ForegroundColor Yellow
}

# ========================================
# 4. TIM PORT SQL SERVER
# ========================================
Write-Host ""
Write-Host "[4] Tim port SQL Server..." -ForegroundColor Yellow
$foundPort = $null

if ($isAdmin) {
    try {
        $instanceReg = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL" -ErrorAction SilentlyContinue
        if ($instanceReg) {
            $instanceId = $instanceReg.$InstanceName
            if ($instanceId) {
                $ipAllPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer\SuperSocketNetLib\Tcp\IPAll"
                $tcpPort = (Get-ItemProperty -Path $ipAllPath -Name "TcpPort" -ErrorAction SilentlyContinue).TcpPort
                if ($tcpPort) {
                    $foundPort = $tcpPort
                    Write-Host "  [OK] Tim thay port: $foundPort" -ForegroundColor Green
                } else {
                    Write-Host "  [WARNING] Khong tim thay port trong registry" -ForegroundColor Yellow
                }
            }
        }
    } catch {
        Write-Host "  [WARNING] Khong the doc port tu registry" -ForegroundColor Yellow
    }
}

if (-not $foundPort -and $Port -gt 0) {
    $foundPort = $Port
    Write-Host "  [INFO] Su dung port duoc chi dinh: $foundPort" -ForegroundColor Green
}

# ========================================
# 5. KIEM TRA WINDOWS AUTHENTICATION MODE
# ========================================
Write-Host ""
Write-Host "[5] Kiem tra Windows Authentication Mode..." -ForegroundColor Yellow
if ($isAdmin) {
    try {
        $instanceReg = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL" -ErrorAction SilentlyContinue
        if ($instanceReg) {
            $instanceId = $instanceReg.$InstanceName
            if ($instanceId) {
                $loginModePath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer"
                $loginMode = (Get-ItemProperty -Path $loginModePath -Name "LoginMode" -ErrorAction SilentlyContinue).LoginMode
                
                if ($loginMode -eq 1) {
                    Write-Host "  [OK] Windows Authentication only" -ForegroundColor Green
                } elseif ($loginMode -eq 2) {
                    Write-Host "  [OK] Mixed Mode (Windows + SQL Server Authentication)" -ForegroundColor Green
                } else {
                    Write-Host "  [WARNING] Khong nhan dien duoc che do: $loginMode" -ForegroundColor Yellow
                }
            }
        }
    } catch {
        Write-Host "  [WARNING] Khong the doc LoginMode tu registry" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [INFO] Can quyen Administrator de kiem tra Authentication Mode" -ForegroundColor Yellow
}

# ========================================
# 6. KIEM TRA VA CAU HINH UTF-8 COLLATION
# ========================================
Write-Host ""
Write-Host "[6] Kiem tra UTF-8 Collation..." -ForegroundColor Yellow

# Kiem tra sqlcmd
$sqlcmdPath = Get-Command sqlcmd -ErrorAction SilentlyContinue
if ($sqlcmdPath) {
    Write-Host "  Tim thay sqlcmd" -ForegroundColor Green
    
    # Kiem tra collation hien tai
    $checkCollationQuery = "SELECT SERVERPROPERTY('Collation') as ServerCollation, DATABASEPROPERTYEX('master', 'Collation') as MasterCollation, SERVERPROPERTY('ProductVersion') as Version"
    $collationResult = & sqlcmd -S $fullServerName -E -Q $checkCollationQuery -h -1 -W 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Da kiem tra collation" -ForegroundColor Green
        
        # Parse ket qua
        $lines = $collationResult | Where-Object { $_ -match "ServerCollation|MasterCollation|Version" }
        foreach ($line in $lines) {
            if ($line -match "ServerCollation\s+(\S+)") {
                $serverCollation = $matches[1]
                Write-Host "  Server Collation: $serverCollation" -ForegroundColor Gray
            }
            if ($line -match "MasterCollation\s+(\S+)") {
                $masterCollation = $matches[1]
                Write-Host "  Master DB Collation: $masterCollation" -ForegroundColor Gray
            }
        }
        
        Write-Host "  [INFO] UTF-8 Encoding:" -ForegroundColor Cyan
        Write-Host "    - SQL Server tu dong ho tro UTF-8 qua NCHAR/NVARCHAR" -ForegroundColor White
        Write-Host "    - Next.js mssql library tu dong xu ly UTF-8" -ForegroundColor White
        Write-Host "    - Su dung N' prefix cho string literals trong SQL queries" -ForegroundColor White
        Write-Host "    - Database collation hien tai ho tro Unicode" -ForegroundColor White
    } else {
        Write-Host "  [WARNING] Khong the kiem tra collation" -ForegroundColor Yellow
        Write-Host "  [INFO] UTF-8 van duoc ho tro tu dong qua NCHAR/NVARCHAR" -ForegroundColor Gray
    }
} else {
    Write-Host "  [WARNING] Khong tim thay sqlcmd" -ForegroundColor Yellow
}

# ========================================
# 7. TAO SQL LOGIN CHO NEXT.JS (KHUYEN NGHI)
# ========================================
Write-Host ""
Write-Host "[6] Tao SQL Login cho Next.js..." -ForegroundColor Yellow

# Kiem tra sqlcmd
$sqlcmdPath = Get-Command sqlcmd -ErrorAction SilentlyContinue
if ($sqlcmdPath) {
    Write-Host "  Tim thay sqlcmd" -ForegroundColor Green
    
    # SQL Login name va password
    $sqlLoginName = "nextjs_user"
    $sqlLoginPassword = "NextJS@123"
    
    # Kiem tra SQL login da ton tai chua
    $checkSqlLoginQuery = "SELECT name FROM sys.sql_logins WHERE name = '$sqlLoginName'"
    $checkSqlLoginResult = & sqlcmd -S $fullServerName -E -Q $checkSqlLoginQuery -h -1 -W 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $checkSqlLoginResult -match $sqlLoginName) {
        Write-Host "  [OK] SQL Login '$sqlLoginName' da ton tai" -ForegroundColor Green
        Write-Host "  Neu quen password, xoa login va tao lai:" -ForegroundColor Gray
        Write-Host "    DROP LOGIN [$sqlLoginName];" -ForegroundColor Gray
    } else {
        Write-Host "  [INFO] SQL Login '$sqlLoginName' chua ton tai" -ForegroundColor Yellow
        
        if ($isAdmin) {
            Write-Host "  Dang tao SQL login..." -ForegroundColor Gray
            $createSqlLoginQuery = @"
IF NOT EXISTS (SELECT * FROM sys.sql_logins WHERE name = '$sqlLoginName')
BEGIN
    CREATE LOGIN [$sqlLoginName] WITH PASSWORD = '$sqlLoginPassword';
    ALTER SERVER ROLE sysadmin ADD MEMBER [$sqlLoginName];
    PRINT 'SQL Login da duoc tao va gan quyen sysadmin';
END
ELSE
BEGIN
    PRINT 'SQL Login da ton tai';
END
"@
            $tempFile = [System.IO.Path]::GetTempFileName()
            $createSqlLoginQuery | Out-File -FilePath $tempFile -Encoding UTF8
            
            $result = & sqlcmd -S $fullServerName -E -i $tempFile 2>&1
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] Da tao SQL login '$sqlLoginName' voi quyen sysadmin" -ForegroundColor Green
                Write-Host "  Password: $sqlLoginPassword" -ForegroundColor Gray
            } else {
                Write-Host "  [ERROR] Khong the tao SQL login: $result" -ForegroundColor Red
            }
        } else {
            Write-Host "  Can quyen Administrator de tao SQL login" -ForegroundColor Yellow
        }
    }
    
    # Kiem tra Windows Login (tuy chon)
    Write-Host ""
    Write-Host "  Kiem tra Windows Login (tuy chon)..." -ForegroundColor Gray
    $checkWindowsLoginQuery = "SELECT name FROM sys.server_principals WHERE name = '$currentUser'"
    $checkWindowsLoginResult = & sqlcmd -S $fullServerName -E -Q $checkWindowsLoginQuery -h -1 -W 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $checkWindowsLoginResult -match $currentUser) {
        Write-Host "  [OK] Windows Login '$currentUser' da ton tai" -ForegroundColor Green
    } else {
        Write-Host "  [INFO] Windows Login '$currentUser' chua ton tai" -ForegroundColor Gray
        Write-Host "  (Khong bat buoc - co the dung SQL Authentication)" -ForegroundColor Gray
    }
} else {
    Write-Host "  [WARNING] Khong tim thay sqlcmd" -ForegroundColor Yellow
    Write-Host "  Khong the tao SQL login tu dong" -ForegroundColor Gray
}

# ========================================
# 8. RESTART SERVICES (NEU CAN)
# ========================================
if ($needRestart -and $isAdmin) {
    Write-Host ""
    Write-Host "[7] Dang restart SQL Server services..." -ForegroundColor Yellow
    try {
        Restart-Service -Name $serviceName -ErrorAction Stop
        Write-Host "  [OK] Da restart SQL Server" -ForegroundColor Green
        
        Start-Sleep -Seconds 2
        Restart-Service -Name "SQLBrowser" -ErrorAction Stop
        Write-Host "  [OK] Da restart SQL Browser" -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Loi khi restart services: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ========================================
# 9. KET QUA VA HUONG DAN
# ========================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ket qua va cau hinh .env" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Them vao file .env:" -ForegroundColor Yellow
Write-Host ""

# Cau hinh SQL Server Authentication (khuyen nghi cho Next.js) - UTF-8
if ($foundPort) {
    Write-Host "# SQL Server Authentication - UTF-8 (KHUYEN NGHI cho Next.js)" -ForegroundColor Cyan
    Write-Host "DB_SERVER=$ServerName" -ForegroundColor White
    Write-Host "DB_PORT=$foundPort" -ForegroundColor White
    Write-Host "DB_DATABASE=master" -ForegroundColor White
    Write-Host "DB_USER=nextjs_user" -ForegroundColor White
    Write-Host "DB_PASSWORD=NextJS@123" -ForegroundColor White
    Write-Host "DB_USE_WINDOWS_AUTH=false" -ForegroundColor White
    Write-Host ""
    Write-Host "# UTF-8 Encoding:" -ForegroundColor Cyan
    Write-Host "# - SQL Server tu dong ho tro UTF-8 qua NCHAR/NVARCHAR" -ForegroundColor Gray
    Write-Host "# - Next.js mssql library tu dong xu ly UTF-8" -ForegroundColor Gray
    Write-Host "# - Dam bao database collation ho tro Unicode" -ForegroundColor Gray
    Write-Host ""
    Write-Host "# Hoac Windows Authentication (co the khong hoat dong voi tedious driver)" -ForegroundColor Gray
    Write-Host "# DB_SERVER=$fullServerName" -ForegroundColor Gray
    Write-Host "# DB_DATABASE=master" -ForegroundColor Gray
    Write-Host "# DB_USE_WINDOWS_AUTH=true" -ForegroundColor Gray
} else {
    Write-Host "# SQL Server Authentication - UTF-8 (KHUYEN NGHI cho Next.js)" -ForegroundColor Cyan
    Write-Host "DB_SERVER=$fullServerName" -ForegroundColor White
    Write-Host "DB_DATABASE=master" -ForegroundColor White
    Write-Host "DB_USER=nextjs_user" -ForegroundColor White
    Write-Host "DB_PASSWORD=NextJS@123" -ForegroundColor White
    Write-Host "DB_USE_WINDOWS_AUTH=false" -ForegroundColor White
    Write-Host ""
    Write-Host "# UTF-8 Encoding:" -ForegroundColor Cyan
    Write-Host "# - SQL Server tu dong ho tro UTF-8 qua NCHAR/NVARCHAR" -ForegroundColor Gray
    Write-Host "# - Next.js mssql library tu dong xu ly UTF-8" -ForegroundColor Gray
    Write-Host "# - Dam bao database collation ho tro Unicode" -ForegroundColor Gray
    Write-Host ""
    Write-Host "# Hoac Windows Authentication (co the khong hoat dong voi tedious driver)" -ForegroundColor Gray
    Write-Host "# DB_SERVER=$fullServerName" -ForegroundColor Gray
    Write-Host "# DB_DATABASE=master" -ForegroundColor Gray
    Write-Host "# DB_USE_WINDOWS_AUTH=true" -ForegroundColor Gray
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Luu y quan trong:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. SQL Server Authentication (KHUYEN NGHI):" -ForegroundColor Yellow
Write-Host "   - Da tao SQL login: nextjs_user / NextJS@123" -ForegroundColor White
Write-Host "   - Hoat dong tot voi Next.js va tedious driver" -ForegroundColor White
Write-Host "   - Cau hinh .env da duoc hien thi o tren" -ForegroundColor White
Write-Host ""
Write-Host "2. Windows Authentication:" -ForegroundColor Yellow
Write-Host "   - Co the khong hoat dong voi tedious driver tren Windows" -ForegroundColor White
Write-Host "   - Can dung msnodesqlv8 driver (can build native module)" -ForegroundColor White
Write-Host "   - Hoac them Windows login thu cong qua SSMS" -ForegroundColor White
Write-Host ""
Write-Host "3. UTF-8 Encoding:" -ForegroundColor Yellow
Write-Host "   - SQL Server tu dong ho tro UTF-8 qua NCHAR/NVARCHAR" -ForegroundColor White
Write-Host "   - Next.js mssql library tu dong xu ly UTF-8" -ForegroundColor White
Write-Host "   - Dam bao database collation ho tro Unicode" -ForegroundColor White
Write-Host ""
Write-Host "4. Sau khi cau hinh .env:" -ForegroundColor Yellow
Write-Host "   - Restart Next.js server: pnpm dev" -ForegroundColor White
Write-Host "   - Kiem tra log de xem ket noi thanh cong" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Hoan thanh!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ban co the thu ket noi lai tu ung dung Next.js." -ForegroundColor Green
Write-Host "Neu van loi, kiem tra log trong terminal." -ForegroundColor Gray
Write-Host ""

