# CPD Fixtures

This directory contains generated 6002 `.cpd` files used to test CPD import and simulation behavior.

Regenerate from the simulator project root:

```powershell
.\tools\CpdFixtureGenerator\generate.ps1
node .\scripts\verify-cpd-fixtures.mjs
```

`manifest.json` describes each fixture and its expected behavior. `extracted/` contains JSON snapshots produced by `CpdExtractorPortable` for deterministic tests.

Delay-focused fixtures intentionally include both sides of the Zone switch:

- `6002-global-sounder-delay.cpd`: global 60-second Sounder Delay with Zone `DelayedSounders=true`.
- `6002-zone-no-delayed-sounders.cpd`: global 60-second Sounder Delay with Zone `DelayedSounders=false`, proving the Zone does not enter delayed Sounder output unless the CPD enables that field.
- `6002-delay-edge-fields.cpd`: keeps Zone 1 Sounder Group activation delayed, including the manual call point at address `04`; manual override behavior is covered separately by `6002-manual-callpoint-override-delay.cpd`.
