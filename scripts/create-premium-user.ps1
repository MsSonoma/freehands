param(
  [Parameter(Mandatory = $true)]
  [string]$Email,

  [ValidateSet('free','trial','standard','pro','lifetime')]
  [string]$Plan = 'pro'
)

$ErrorActionPreference = 'Stop'

# Prompt for password without echoing.
$secure = Read-Host -Prompt 'Password' -AsSecureString

# Convert SecureString to plaintext for the child process env var.
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

try {
  $env:CREATE_PREMIUM_USER_PASSWORD = $plain
  node "$PSScriptRoot\createPremiumUser.mjs" $Email $Plan
} finally {
  Remove-Item Env:CREATE_PREMIUM_USER_PASSWORD -ErrorAction SilentlyContinue
}
