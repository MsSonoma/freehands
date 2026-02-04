$ErrorActionPreference = 'Stop'

$email = Read-Host -Prompt 'Email'
if (-not $email) { throw 'Email is required' }

$plan = Read-Host -Prompt 'Plan (free|trial|standard|pro|lifetime) [pro]'
if (-not $plan) { $plan = 'pro' }
$plan = $plan.Trim().ToLowerInvariant()
if (@('free','trial','standard','pro','lifetime') -notcontains $plan) {
  throw "Invalid plan: $plan"
}

$secure = Read-Host -Prompt 'Password' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

try {
  $env:CREATE_PREMIUM_USER_PASSWORD = $plain
  node "$PSScriptRoot\createPremiumUser.mjs" $email $plan
} finally {
  Remove-Item Env:CREATE_PREMIUM_USER_PASSWORD -ErrorAction SilentlyContinue
}
