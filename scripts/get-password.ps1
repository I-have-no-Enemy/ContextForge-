# Copies a ContextForge account password from Windows Credential Manager to the clipboard.
# It is never printed. Usage:
#   pwsh scripts/get-password.ps1                     # admin@contextforge.dev
#   pwsh scripts/get-password.ps1 maintainer@contextforge.dev
param([string]$Email = 'admin@contextforge.dev')

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CredRead2 {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist;
    public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool CredRead(string target, int type, int flags, out IntPtr cred);
  [DllImport("advapi32.dll")] static extern void CredFree(IntPtr p);
  public static string Read(string target) {
    IntPtr p; if (!CredRead(target, 1, 0, out p)) return null;
    try { var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
      return Marshal.PtrToStringUni(c.CredentialBlob, c.CredentialBlobSize / 2); }
    finally { CredFree(p); }
  }
}
'@

$secret = [CredRead2]::Read("ContextForge/$Email")
if (-not $secret) {
  Write-Error "No credential 'ContextForge/$Email' in Windows Credential Manager."
  exit 1
}
Set-Clipboard -Value $secret
"Password for $Email copied to the clipboard."
