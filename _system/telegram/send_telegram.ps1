# Vyom Planner -> Telegram. Roz subah Windows khud chalata hai (Setup_Telegram.bat ek baar chalao).
# Token: E:\Vyom Class 9 Planner\telegram.txt (kabhi kisi ko mat bhejna)
param([string]$Date = (Get-Date -Format 'yyyy-MM-dd'), [switch]$Test, [switch]$FindChat, [switch]$Register)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # ...\Vyom Class 9 Planner
$Sys  = Join-Path $Root '_system\telegram'
$Log  = Join-Path $Sys 'log.txt'
function Log($m){ Add-Content -Path $Log -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $m) -Encoding UTF8 }
if (-not ($Test -or $FindChat -or $Register)) {
  $message = 'Purana Telegram schedule paused hai: 12 October wale planner ke messages aur PDFs regenerate karne ke baad hi auto-send dobara enable karein.'
  Log $message
  throw $message
}
$tok = (Get-Content (Join-Path $Root 'telegram.txt') -Raw).Trim()
if ($tok -notmatch '^\d+:[A-Za-z0-9_-]+$') { $m=[regex]::Match($tok,'\d{6,}:[A-Za-z0-9_-]{30,}'); $tok=$m.Value }
$api = "https://api.telegram.org/bot$tok"
$chatFile = Join-Path $Sys 'chat_id.txt'
if ($FindChat -or -not (Test-Path $chatFile)) {
  $u = Invoke-RestMethod -Uri "$api/getUpdates" -Method Get
  $chats = @($u.result | ForEach-Object { $_.message.chat; $_.my_chat_member.chat } | Where-Object { $_ -and $_.type -ne 'private' })
  if (-not $chats) { $chats = @($u.result | ForEach-Object { $_.message.chat } | Where-Object { $_ }) }
  if (-not $chats) { Write-Host "Chat nahi mila. Group me bot add karke group me /start likho, phir dobara chalao."; Log 'chat not found'; exit 1 }
  $c = $chats[-1]; Set-Content -Path $chatFile -Value $c.id -Encoding ASCII
  Write-Host ("Chat mil gaya: {0} ({1})" -f $c.title, $c.id); Log ("chat set " + $c.id)
  if ($FindChat) { exit 0 }
}
$chat = (Get-Content $chatFile -Raw).Trim()
function SendText([string]$file){
  $r = & curl.exe -s -X POST "$api/sendMessage" -F "chat_id=$chat" -F "text=<$file"
  if ($r -notmatch '"ok":true') { Log ("sendMessage FAIL " + $file + " " + $r) } else { Log ("sent " + (Split-Path $file -Leaf)) }
}
function SendDoc([string]$path, [string]$cap){
  $r = & curl.exe -s -X POST "$api/sendDocument" -F "chat_id=$chat" -F "caption=$cap" -F "document=@$path"
  if ($r -notmatch '"ok":true') { Log ("sendDocument FAIL " + $path + " " + $r) } else { Log ("doc " + (Split-Path $path -Leaf)) }
}
if ($Register) {
  $a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $PSCommandPath + '"')
  $t = New-ScheduledTaskTrigger -Daily -At 6:15am
  $st = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName 'Vyom Planner Telegram' -Action $a -Trigger $t -Settings $st -Force | Out-Null
  Write-Host 'Auto-message set: roz subah 6:15 (computer band tha to on hote hi).'; Log 'registered'; exit 0
}
if ($Test) {
  $t = Join-Path $Sys 'test_msg.txt'
  Set-Content -Path $t -Value "✅ Vyom Planner bot jud gaya! Ab roz subah 6:15 baje 'aaj kya karna hai' aur Sunday ko hafte ki update yahin aayegi." -Encoding UTF8
  SendText $t; Write-Host 'Test message bhej diya — Telegram group dekho.'; exit 0
}
$M = Get-Content (Join-Path $Sys 'messages.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$day = $M.$Date
$tmp = Join-Path $Sys 'last_msg.txt'
function SendStr([string]$txt){ [System.IO.File]::WriteAllText($tmp, $txt, (New-Object System.Text.UTF8Encoding($false))); SendText $tmp }
if ($day -and $day.msg) { SendStr $day.msg }
if ($day -and $day.sunday) { SendStr $day.sunday }
$prog = Join-Path $Sys "progress_$Date.txt"     # Claude ka weekly progress (agar aaya ho)
if (Test-Path $prog) { SendText $prog }
if ($day -and $day.attach) {
  foreach ($r in $day.attach) { $p = Join-Path $Root $r; if (Test-Path $p) { SendDoc $p 'Aaj ka test paper' } else { Log ("missing " + $r) } }
} else {
  $ds = Get-ChildItem (Join-Path $Root '4_Daily_Sheets') -Filter "${Date}_*_Vyom.pdf" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($ds) { SendDoc $ds.FullName 'Aaj ka daily test (3:30-4:00)' }
}
