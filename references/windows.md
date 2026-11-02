# Windows evidence and commands

PowerShell is the host shell. Quote literal paths with spaces. Do not translate macOS launch, Homebrew, `lipo`, Mach-O or `.mxo` assumptions mechanically.

```powershell
& '<skill>\scripts\probe-max.ps1' -MaxRoot 'E:\Applications\Max 9'
& '<skill>\scripts\reference.ps1' -MaxRoot 'E:\Applications\Max 9' -Name 'cycle~' -Domain 'msp'
node '<skill>\scripts\maxpat.mjs' validate '<project>\instrument.maxpat'
```

Use returned resource paths. On the verified installation, references are under `resources\docs\refpages`, help under `resources\help`, snippets under `resources\snippets`, examples next to Max.exe, and bundled packages under `resources\packages`. User Documents can be redirected; query `Environment.GetFolderPath('MyDocuments')` rather than hardcoding a user profile. Max's `C74:` virtual prefix resolves relative to its resources; it is not a normal Windows drive.

For wider search use `rg --files '<resource root>' -g '*.maxhelp'`, then `rg -l -F 'objectname' '<examples>' -g '*.maxpat'`. XML lookup is exact: aliases (`t` → `trigger`) and symbolic operators can have different documentation filenames. Do not infer port types from a tilde in the object name: MSP objects can also emit messages.

For installed package objects, establish package/version, actual `.mxe64` or abstraction, help file and dependency resolution. A `.mxo` directory is a macOS external, not a Windows plugin. C++ changes require the appropriate Max SDK and Windows compiler/toolchain, followed by loading the built `.mxe64` in Max. A successful CMake configure is insufficient.

For audio, inspect the actual device/driver, channel mapping, sample rate and vector sizes in Max. Do not silently change system defaults or assume ASIO hardware is present. Leave these settings as observed until the task requires changes.

Sources: [Search Path](https://docs.cycling74.com/userguide/search_path/), [Packages](https://docs.cycling74.com/userguide/packages/), [Externals](https://docs.cycling74.com/userguide/externals/).
