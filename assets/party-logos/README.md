# Party Logos

This folder contains current registered-party logo files sourced from INEC's official list of political parties:

```text
https://inecnigeria.org/list-of-political-parties/
```

Files use uppercase party codes as filenames, for example:

- `APC.svg`
- `PDP.svg`
- `LP.svg`
- `NNPP.svg`
- `APGA.svg`

`party-logos.js` maps party codes to local files and original INEC source URLs. The dashboard falls back to generated badge marks when no logo is available.
