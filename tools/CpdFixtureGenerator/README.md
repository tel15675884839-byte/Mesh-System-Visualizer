# CPD Fixture Generator

This tool generates 6002 `.cpd` fixtures for the Numens Fire Alarm Simulator by reusing the original SmartControlPad Configurator serializer and template.

Run from the simulator project root:

```powershell
.\tools\CpdFixtureGenerator\generate.ps1
```

List fixture names without writing files:

```powershell
.\tools\CpdFixtureGenerator\generate.ps1 -List
```

The default Configurator source is resolved as:

```text
..\..\Configurator_v3.6.0_2025-12-24
```

Generated files are written to:

```text
fixtures/cpd/
```

The generator does not modify Configurator binaries or simulator runtime code.
