# XcLENCE - build a single self-contained HTML file (for sharing / static hosting).
#   powershell -ExecutionPolicy Bypass -File build-bundle.ps1
# Output: dist\XcLENCE.html - pure ASCII (non-ASCII in JS escaped to \uXXXX) so it renders
# correctly even where the host doesn't declare charset=utf-8. Runs in localStorage mode.
$ErrorActionPreference = "Stop"
$dir = $PSScriptRoot
$utf8 = [Text.Encoding]::UTF8

function Read-Utf8($name) { [IO.File]::ReadAllText((Join-Path $dir $name), $utf8) }
function Escape-Js($s) {
  $sb = New-Object Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    $c = [int]$ch
    if ($c -gt 126) { [void]$sb.Append(('\u{0:x4}' -f $c)) } else { [void]$sb.Append($ch) }
  }
  $sb.ToString()
}
function Ascii-Css($s) { [regex]::Replace($s, '[^\x00-\x7E]', '-') }  # only comments carry non-ASCII

$css = Ascii-Css (Read-Utf8 "styles.css")
$js = ("data.js", "logic.js", "views.js", "app.js" | ForEach-Object { Read-Utf8 $_ }) -join "`n;`n"
if ($js -match '</script') { throw "JS contains '</script' - cannot inline safely." }
$logo = "data:image/webp;base64," + [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $dir "logo.webp")))
$js = $js.Replace('const LOGO = "logo.webp"', "const LOGO = `"$logo`"")
$js = Escape-Js $js

$html = "<!doctype html>`n<html lang=`"en`">`n<head>`n<meta charset=`"utf-8`">`n<meta name=`"viewport`" content=`"width=device-width, initial-scale=1`">`n<title>XcLENCE</title>`n<style>`n" + $css + "`n</style>`n</head>`n<body>`n<div id=`"app`"></div>`n<script>`n" + $js + "`n</script>`n</body>`n</html>`n"

$out = Join-Path $dir "dist"
New-Item -ItemType Directory -Force $out | Out-Null
$file = Join-Path $out "XcLENCE.html"
[IO.File]::WriteAllText($file, $html, (New-Object Text.UTF8Encoding($false)))
$bytes = [IO.File]::ReadAllBytes($file)
$nonAscii = ($bytes | Where-Object { $_ -gt 127 }).Count
"Built $file  ($([math]::Round($bytes.Length / 1KB)) KB, non-ASCII bytes: $nonAscii)"
