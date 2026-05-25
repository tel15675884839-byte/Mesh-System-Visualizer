using System;
using System.Collections;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Reflection;
using System.Text;

namespace CpdFixtureGenerator
{
    internal static class Program
    {
        private const BindingFlags InstanceFlags = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;

        private static string configuratorDir = "";
        private static Assembly bllAssembly;
        private static Assembly commonAssembly;
        private static MethodInfo readMethod;
        private static MethodInfo writeMethod;

        private static readonly FixtureDefinition[] Fixtures = new[]
        {
            new FixtureDefinition(
                "6002-basic-zone-linkage.cpd",
                "Basic Zone first-stage local sounder and second-stage evacuation linkage.",
                new FixtureOptions { DelayedSounders = false }),
            new FixtureDefinition(
                "6002-global-sounder-delay.cpd",
                "Global sounder delay for ordinary detector activation.",
                new FixtureOptions { DelayedSounders = true, SounderDelaySeconds = 60 }),
            new FixtureDefinition(
                "6002-zone-no-delayed-sounders.cpd",
                "Global sounder delay configured while Zone Delayed Sounders is off; ordinary detector activation should not be delayed.",
                new FixtureOptions { DelayedSounders = false, SounderDelaySeconds = 60 }),
            new FixtureDefinition(
                "6002-manual-callpoint-override-delay.cpd",
                "Manual call points override the configured global sounder delay.",
                new FixtureOptions { DelayedSounders = true, SounderDelaySeconds = 60, ManualOverride = true }),
            new FixtureDefinition(
                "6002-disabled-and-inhibited.cpd",
                "Disabled detector and inhibited relay module behavior.",
                new FixtureOptions { DelayedSounders = false, DisableDevice21 = true, InhibitRelays17 = true }),
            new FixtureDefinition(
                "6002-io-stage-linkage.cpd",
                "Zone 1 first-stage and second-stage I/O linkage.",
                new FixtureOptions { DelayedSounders = false, IoStage = true, InputOutputDelaySeconds = 30 }),
            new FixtureDefinition(
                "6002-delay-edge-fields.cpd",
                "Optional delay edge fields when supported by the source tables.",
                new FixtureOptions
                {
                    DelayedSounders = true,
                    SounderDelaySeconds = 60,
                    InputOutputDelaySeconds = 45,
                    FireBrigadeDelaySeconds = 30,
                    IoStage = true,
                    OptionalEdgeFields = true,
                    IoOverrideDelayAddress4 = false,
                    SetEvacuateTimerAddress4 = false
                }),
            new FixtureDefinition(
                "6002-realistic-building-composite.cpd",
                "Composite 6002 building fixture with delay, override, staged sounder and I/O linkage, disabled maintenance detector, and inhibited relay.",
                new FixtureOptions
                {
                    DelayedSounders = true,
                    SounderDelaySeconds = 60,
                    InputOutputDelaySeconds = 30,
                    ManualOverride = true,
                    DisableDevice21 = true,
                    InhibitRelays17 = true,
                    IoStage = true
                })
        };

        [STAThread]
        private static int Main(string[] args)
        {
            try
            {
                var parsed = ParseArgs(args);
                if (parsed.ListOnly)
                {
                    foreach (var fixture in Fixtures)
                    {
                        Console.WriteLine(fixture.FileName);
                    }

                    return Exit(0);
                }

                configuratorDir = Path.GetFullPath(parsed.ConfiguratorDir);
                var outputDir = Path.GetFullPath(parsed.OutputDir);

                if (!Directory.Exists(configuratorDir))
                {
                    throw new DirectoryNotFoundException("Configurator directory not found: " + configuratorDir);
                }

                Directory.CreateDirectory(outputDir);
                Directory.CreateDirectory(Path.Combine(outputDir, "extracted"));
                LoadConfiguratorAssemblies();

                var manifestEntries = new List<ManifestEntry>();
                foreach (var fixture in Fixtures)
                {
                    Console.WriteLine("Generating " + fixture.FileName);
                    manifestEntries.Add(GenerateFixture(fixture, outputDir));
                }

                WriteManifest(outputDir, manifestEntries);
                Console.WriteLine("Generated " + manifestEntries.Count + " CPD fixtures in " + outputDir);
                return Exit(0);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("CPD fixture generation failed: " + ex);
                return Exit(1);
            }
        }

        private static int Exit(int code)
        {
            Environment.Exit(code);
            return code;
        }

        private static ParsedArgs ParseArgs(string[] args)
        {
            var parsed = new ParsedArgs
            {
                ConfiguratorDir = Path.GetFullPath(Path.Combine(Environment.CurrentDirectory, "..", "..", "Configurator_v3.6.0_2025-12-24")),
                OutputDir = Path.GetFullPath(Path.Combine(Environment.CurrentDirectory, "fixtures", "cpd")),
                ListOnly = false
            };

            for (var i = 0; i < args.Length; i++)
            {
                var arg = args[i];
                if (arg == "--list")
                {
                    parsed.ListOnly = true;
                    continue;
                }

                if (arg == "--configurator" && i + 1 < args.Length)
                {
                    parsed.ConfiguratorDir = args[++i];
                    continue;
                }

                if (arg == "--output" && i + 1 < args.Length)
                {
                    parsed.OutputDir = args[++i];
                    continue;
                }

                throw new ArgumentException("Unknown or incomplete argument: " + arg);
            }

            return parsed;
        }

        private static void LoadConfiguratorAssemblies()
        {
            AppDomain.CurrentDomain.AssemblyResolve += ResolveConfiguratorAssembly;

            var bllPath = Path.Combine(configuratorDir, "BLL.dll");
            var commonPath = Path.Combine(configuratorDir, "Common.dll");

            if (!File.Exists(bllPath) || !File.Exists(commonPath))
            {
                throw new FileNotFoundException("Expected BLL.dll and Common.dll in " + configuratorDir);
            }

            bllAssembly = Assembly.LoadFrom(bllPath);
            commonAssembly = Assembly.LoadFrom(commonPath);
            var serializerHelperType = commonAssembly.GetType("Common.SerializerHelper", true);
            readMethod = serializerHelperType.GetMethod("ReadFromFileCompression", new[] { typeof(string) });
            writeMethod = serializerHelperType.GetMethod("SaveToFileCompression", new[] { typeof(string), typeof(object) });

            if (readMethod == null || writeMethod == null)
            {
                throw new MissingMethodException("Common.SerializerHelper read/write methods were not found.");
            }
        }

        private static Assembly ResolveConfiguratorAssembly(object sender, ResolveEventArgs args)
        {
            var fileName = new AssemblyName(args.Name).Name + ".dll";
            var candidate = Path.Combine(configuratorDir, fileName);
            return File.Exists(candidate) ? Assembly.LoadFrom(candidate) : null;
        }

        private static ManifestEntry GenerateFixture(FixtureDefinition fixture, string outputDir)
        {
            var templatePath = Path.Combine(configuratorDir, "templet project", "6002.cpd");
            if (!File.Exists(templatePath))
            {
                throw new FileNotFoundException("6002 template not found: " + templatePath);
            }

            var project = readMethod.Invoke(null, new object[] { templatePath });
            var panel = GetFirstPanel(project);
            var loop = GetLoop(panel, 0);
            ResetLoopDevices(loop);

            var options = fixture.Options;
            var optional = new OptionalFieldTracker();
            ApplyDeviceRows(loop, options, optional);
            var sysConfig = GetRequiredField(panel, "controlPanelSystemConfig");
            ApplyGeneral(sysConfig, options);
            ApplyZones(sysConfig, options, optional);
            ApplySounderGroups(sysConfig);
            ApplyIOGroups(sysConfig, options);

            SaveFixture(project, Path.Combine(outputDir, fixture.FileName));

            return new ManifestEntry
            {
                FileName = fixture.FileName,
                Purpose = fixture.Purpose,
                Expected = ExpectedFor(options),
                OptionalPresent = optional.Present,
                OptionalSkipped = optional.Skipped
            };
        }

        private static void SaveFixture(object project, string outputPath)
        {
            var tempPath = outputPath + ".tmp";
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }

            writeMethod.Invoke(null, new object[] { tempPath, project });

            if (File.Exists(outputPath))
            {
                File.Delete(outputPath);
            }

            File.Move(tempPath, outputPath);
        }

        private static object GetFirstPanel(object project)
        {
            var controlPanelList = (IList)GetRequiredField(project, "controlPanelList");
            if (controlPanelList.Count == 0)
            {
                throw new InvalidOperationException("Template has no control panels.");
            }

            return controlPanelList[0];
        }

        private static object GetLoop(object panel, int index)
        {
            var loopList = (IList)GetRequiredField(panel, "loopList");
            if (loopList.Count <= index)
            {
                throw new InvalidOperationException("Template does not contain loop index " + index);
            }

            return loopList[index];
        }

        private static void ResetLoopDevices(object loop)
        {
            var detectorModelEnum = bllAssembly.GetType("BLL.DetectorModelEnum", true);
            var alarmModelEnum = bllAssembly.GetType("BLL.AlarmModelEnum", true);
            var callPointModelEnum = bllAssembly.GetType("BLL.CallPointModelEnum", true);
            var modulesModelEnum = bllAssembly.GetType("BLL.ModulesModelEnum", true);
            var deviceTypeEnum = bllAssembly.GetType("BLL.DeviceTypeEnum", true);

            var appendDetector = GetMethod(loop, "AppendDecetor", detectorModelEnum, deviceTypeEnum, typeof(int));
            var appendAlarm = GetMethod(loop, "AppendAlarm", alarmModelEnum, deviceTypeEnum, typeof(int));
            var appendCallPoint = GetMethod(loop, "AppendCallPoint", callPointModelEnum, deviceTypeEnum, typeof(int));
            var appendModule = GetMethod(loop, "AppendModule", modulesModelEnum, deviceTypeEnum, typeof(int));

            ((IList)GetRequiredField(loop, "devices")).Clear();

            AppendDetector(appendDetector, loop, detectorModelEnum, deviceTypeEnum, "Optical_Det", "Optical_Det", 1);
            AppendDetector(appendDetector, loop, detectorModelEnum, deviceTypeEnum, "Heat_Det", "Heat_Det", 2);
            AppendDetector(appendDetector, loop, detectorModelEnum, deviceTypeEnum, "Optical_Det", "Optical_Det", 3);
            AppendCallPoint(appendCallPoint, loop, callPointModelEnum, deviceTypeEnum, 4);
            AppendModule(appendModule, loop, modulesModelEnum, deviceTypeEnum, 7);
            AppendModule(appendModule, loop, modulesModelEnum, deviceTypeEnum, 8);
            AppendAlarm(appendAlarm, loop, alarmModelEnum, deviceTypeEnum, 94);
            AppendAlarm(appendAlarm, loop, alarmModelEnum, deviceTypeEnum, 95);

            AppendDetector(appendDetector, loop, detectorModelEnum, deviceTypeEnum, "Optical_Det", "Optical_Det", 11);
            AppendDetector(appendDetector, loop, detectorModelEnum, deviceTypeEnum, "Optical_Det", "Optical_Det", 12);
            AppendDetector(appendDetector, loop, detectorModelEnum, deviceTypeEnum, "Heat_Det", "Heat_Det", 13);
            AppendCallPoint(appendCallPoint, loop, callPointModelEnum, deviceTypeEnum, 14);
            AppendModule(appendModule, loop, modulesModelEnum, deviceTypeEnum, 17);
            AppendAlarm(appendAlarm, loop, alarmModelEnum, deviceTypeEnum, 104);
            AppendAlarm(appendAlarm, loop, alarmModelEnum, deviceTypeEnum, 105);

            AppendDetector(appendDetector, loop, detectorModelEnum, deviceTypeEnum, "Optical_Det", "Optical_Det", 21);
            AppendDetector(appendDetector, loop, detectorModelEnum, deviceTypeEnum, "Optical_Det", "Optical_Det", 22);
            AppendDetector(appendDetector, loop, detectorModelEnum, deviceTypeEnum, "Optical_Det", "Optical_Det", 23);
            AppendCallPoint(appendCallPoint, loop, callPointModelEnum, deviceTypeEnum, 24);
            AppendAlarm(appendAlarm, loop, alarmModelEnum, deviceTypeEnum, 114);
        }

        private static void AppendDetector(MethodInfo method, object loop, Type modelEnum, Type deviceTypeEnum, string model, string type, int address)
        {
            method.Invoke(loop, new[] { Enum.Parse(modelEnum, model), Enum.Parse(deviceTypeEnum, type), (object)address });
        }

        private static void AppendAlarm(MethodInfo method, object loop, Type modelEnum, Type deviceTypeEnum, int address)
        {
            method.Invoke(loop, new[] { Enum.Parse(modelEnum, "Sounder"), Enum.Parse(deviceTypeEnum, "Sounder"), (object)address });
        }

        private static void AppendCallPoint(MethodInfo method, object loop, Type modelEnum, Type deviceTypeEnum, int address)
        {
            method.Invoke(loop, new[] { Enum.Parse(modelEnum, "ManualCallPoint"), Enum.Parse(deviceTypeEnum, "Manual_Call_Point"), (object)address });
        }

        private static void AppendModule(MethodInfo method, object loop, Type modelEnum, Type deviceTypeEnum, int address)
        {
            method.Invoke(loop, new[] { Enum.Parse(modelEnum, "Modules_InputOutput"), Enum.Parse(deviceTypeEnum, "Input_Output"), (object)address });
        }

        private static void ApplyDeviceRows(object loop, FixtureOptions options, OptionalFieldTracker optional)
        {
            var configs = StandardConfigs();
            var devices = (IList)GetRequiredField(loop, "devices");

            foreach (var device in devices)
            {
                var address = Convert.ToInt32(GetRequiredField(device, "physicalAddress"));
                DeviceConfig config;
                if (!configs.TryGetValue(address, out config))
                {
                    continue;
                }

                var table = GetDataTable(device, "GData");
                if (table.Rows.Count == 0)
                {
                    throw new InvalidOperationException("Device " + address + " has no GData row.");
                }

                var row = table.Rows[0];
                SetRequired(row, "DeviceLocationText", config.Location);
                SetRequired(row, "Zone", config.Zone);
                SetRequired(row, "SounderGroup", config.SounderGroup);
                SetOptional(row, "IOGroup", 0, null);
                SetRequired(row, "OverrideDelays", options.ManualOverride && (address == 4 || address == 14 || address == 24));
                SetRequired(row, "DeviceDisabled", options.DisableDevice21 && address == 21);
                SetRequired(row, "InhibitRelays", options.InhibitRelays17 && address == 17 ? 1 : 0);
                SetOptional(row, "InhibitIO", 0, null);
                SetOptional(row, "InhibitSounders", 0, null);

                if (options.OptionalEdgeFields)
                {
                    SetOptional(row, "IOOverrideDelay", options.IoOverrideDelayAddress4 && address == 4, optional);
                    SetOptional(row, "SetEvacuateTimer", options.SetEvacuateTimerAddress4 && address == 4, optional);
                }
            }
        }

        private static void ApplyGeneral(object sysConfig, FixtureOptions options)
        {
            var general = GetRequiredField(sysConfig, "general");
            var table = GetDataTable(general, "GData");
            if (table.Rows.Count == 0)
            {
                throw new InvalidOperationException("General GData has no rows.");
            }

            var row = table.Rows[0];
            SetRequired(row, "SounderDelayMM", options.SounderDelaySeconds / 60);
            SetRequired(row, "SounderDelaySS", options.SounderDelaySeconds % 60);
            SetRequired(row, "InputOutputDelayMM", options.InputOutputDelaySeconds / 60);
            SetRequired(row, "InputOutputDelaySS", options.InputOutputDelaySeconds % 60);
            SetRequired(row, "FireBrigadeDelayMM", options.FireBrigadeDelaySeconds / 60);
            SetRequired(row, "FireBrigadeDelaySS", options.FireBrigadeDelaySeconds % 60);
            SetRequired(row, "EvacuteDelayMM", 0);
            SetRequired(row, "EvacuteDelaySS", 0);
        }

        private static void ApplyZones(object sysConfig, FixtureOptions options, OptionalFieldTracker optional)
        {
            var zoneObj = GetRequiredField(sysConfig, "zone");
            var table = GetDataTable(zoneObj, "GData");

            for (var zone = 1; zone <= 3; zone++)
            {
                var row = GetRowByInt(table, "ZoneNumber", zone);
                if (row == null)
                {
                    throw new InvalidOperationException("Zone " + zone + " row was not found.");
                }

                SetRequired(row, "ZoneTexts", zone == 1 ? "1st Floor" : zone == 2 ? "2nd Floor" : "3rd Floor");
                SetRequired(row, "ZoneEnabled", true);
                SetRequired(row, "DelayedSounders", options.DelayedSounders);
                optional.MarkPresent("DelayedSounders");
                SetRequired(row, "SounderGroupAlarm1", zone);
                SetRequired(row, "SounderGroupAlarm2", 10);
                SetRequired(row, "IOGroup1Alarm1", options.IoStage && zone == 1 ? 1 : 0);
                SetRequired(row, "IOGroup1Alarm2", options.IoStage && zone == 1 ? 2 : 0);
                SetRequired(row, "IOGroup2Alarm1", 0);
                SetRequired(row, "IOGroup3Alarm1", 0);
                SetRequired(row, "IOGroup4Alarm1", 0);
                SetOptional(row, "AlarmMode", "double", null);
            }
        }

        private static void ApplySounderGroups(object sysConfig)
        {
            var sounderObj = GetRequiredField(sysConfig, "sounderGroups");
            var groupTable = GetDataTable(sounderObj, "GData");

            SetSounderGroupTitle(groupTable, 1, "Zone 1 Local Sounders");
            SetSounderGroupTitle(groupTable, 2, "Zone 2 Local Sounders");
            SetSounderGroupTitle(groupTable, 3, "Zone 3 Local Sounders");
            SetSounderGroupTitle(groupTable, 10, "All Evacuation");

            var detail = (Hashtable)GetRequiredField(sounderObj, "GDataDetail");
            foreach (DictionaryEntry entry in detail)
            {
                var table = entry.Value as DataTable;
                if (table != null)
                {
                    table.Clear();
                }
            }

            AddSounderMembers(detail, 1, new[] { 94, 95 });
            AddSounderMembers(detail, 2, new[] { 104, 105 });
            AddSounderMembers(detail, 3, new[] { 114 });
            AddSounderMembers(detail, 10, new[] { 94, 95, 104, 105, 114 });
        }

        private static void SetSounderGroupTitle(DataTable table, int groupId, string title)
        {
            var row = GetRowByInt(table, "SounderGroupID", groupId);
            if (row == null)
            {
                return;
            }

            SetRequired(row, "SounderGroupTitle", title);
            SetOptional(row, "NonAddressable1", "Intermittent", null);
            SetOptional(row, "NonAddressable2", "Continuous", null);
        }

        private static void AddSounderMembers(Hashtable detail, int groupId, int[] addresses)
        {
            if (!detail.ContainsKey(groupId))
            {
                return;
            }

            var table = detail[groupId] as DataTable;
            if (table == null)
            {
                return;
            }

            foreach (var address in addresses)
            {
                var row = table.NewRow();
                SetRequired(row, "SounderGroupID", groupId);
                SetRequired(row, "LoopID", 1);
                SetRequired(row, "PhysicalAddress", address);
                SetOptional(row, "SounderStatus", "Continuous", null);
                table.Rows.Add(row);
            }
        }

        private static void ApplyIOGroups(object sysConfig, FixtureOptions options)
        {
            var ioObj = GetRequiredField(sysConfig, "ioGroup");
            var table = GetDataTable(ioObj, "GData");

            foreach (DataRow row in table.Rows)
            {
                SetOptional(row, "Loop", 0, null);
                SetOptional(row, "Device", 0, null);
                SetOptional(row, "Text", "", null);
            }

            if (options.IoStage)
            {
                SetIOGroupEntry(table, 1, 1, 7, "1F Shutter Half-Down");
                SetIOGroupEntry(table, 2, 1, 8, "1F Shutter Full-Down");
            }

            if (options.InhibitRelays17)
            {
                SetIOGroupEntry(table, 3, 1, 17, "2F Sprinkler Relay");
            }
        }

        private static void SetIOGroupEntry(DataTable table, int groupId, int loop, int device, string text)
        {
            foreach (DataRow row in table.Rows)
            {
                if (Convert.ToInt32(row["IOGroup"]) == groupId && Convert.ToInt32(row["Entry"]) == 1)
                {
                    SetRequired(row, "Loop", loop);
                    SetRequired(row, "Device", device);
                    SetRequired(row, "Text", text);
                    return;
                }
            }

            throw new InvalidOperationException("I/O group " + groupId + " entry 1 was not found.");
        }

        private static Dictionary<int, DeviceConfig> StandardConfigs()
        {
            return new Dictionary<int, DeviceConfig>
            {
                { 1, new DeviceConfig("1F Lobby Smoke", 1, 0) },
                { 2, new DeviceConfig("1F Plant Heat", 1, 0) },
                { 3, new DeviceConfig("1F Corridor Smoke", 1, 0) },
                { 4, new DeviceConfig("1F Corridor MCP", 1, 0) },
                { 7, new DeviceConfig("1F Shutter Half-Down", 1, 0) },
                { 8, new DeviceConfig("1F Shutter Full-Down", 1, 0) },
                { 94, new DeviceConfig("1F Corridor Sounder", 0, 1) },
                { 95, new DeviceConfig("1F Lobby Sounder", 0, 1) },
                { 11, new DeviceConfig("2F Meeting Room Smoke", 2, 0) },
                { 12, new DeviceConfig("2F R&D Area Smoke", 2, 0) },
                { 13, new DeviceConfig("2F Kitchen Heat", 2, 0) },
                { 14, new DeviceConfig("2F Exit MCP", 2, 0) },
                { 17, new DeviceConfig("2F Sprinkler Relay", 2, 0) },
                { 104, new DeviceConfig("2F Corridor Sounder 1", 0, 2) },
                { 105, new DeviceConfig("2F Corridor Sounder 2", 0, 2) },
                { 21, new DeviceConfig("3F Archive Smoke", 3, 0) },
                { 22, new DeviceConfig("3F Manager Office Smoke", 3, 0) },
                { 23, new DeviceConfig("3F Corridor Smoke", 3, 0) },
                { 24, new DeviceConfig("3F Corridor MCP", 3, 0) },
                { 114, new DeviceConfig("3F Corridor Sounder", 0, 3) }
            };
        }

        private static Dictionary<string, object> ExpectedFor(FixtureOptions options)
        {
            var expected = new Dictionary<string, object>
            {
                { "deviceCount", 20 },
                { "zones", new[] { 1, 2, 3 } },
                { "sounderGroups", new[] { 1, 2, 3, 10 } },
                { "sounderDelaySeconds", options.SounderDelaySeconds },
                { "inputOutputDelaySeconds", options.InputOutputDelaySeconds },
                { "fireBrigadeDelaySeconds", options.FireBrigadeDelaySeconds },
                { "delayedSounders", options.DelayedSounders },
                { "manualOverride", options.ManualOverride },
                { "disabledAddress", options.DisableDevice21 ? 21 : 0 },
                { "inhibitedRelayAddress", options.InhibitRelays17 ? 17 : 0 },
                { "ioGroups", options.IoStage ? new[] { 1, 2 } : new int[0] }
            };

            return expected;
        }

        private static MethodInfo GetMethod(object instance, string name, params Type[] types)
        {
            var method = instance.GetType().GetMethod(name, types);
            if (method == null)
            {
                throw new MissingMethodException(instance.GetType().FullName, name);
            }

            return method;
        }

        private static object GetRequiredField(object instance, string name)
        {
            var field = instance.GetType().GetField(name, InstanceFlags);
            if (field == null)
            {
                throw new MissingFieldException(instance.GetType().FullName, name);
            }

            return field.GetValue(instance);
        }

        private static DataTable GetDataTable(object instance, string fieldName)
        {
            var table = GetRequiredField(instance, fieldName) as DataTable;
            if (table == null)
            {
                throw new InvalidOperationException(instance.GetType().FullName + "." + fieldName + " is not a DataTable.");
            }

            return table;
        }

        private static DataRow GetRowByInt(DataTable table, string column, int value)
        {
            foreach (DataRow row in table.Rows)
            {
                if (table.Columns.Contains(column) && Convert.ToInt32(row[column]) == value)
                {
                    return row;
                }
            }

            return null;
        }

        private static void SetRequired(DataRow row, string column, object value)
        {
            if (!row.Table.Columns.Contains(column))
            {
                throw new InvalidOperationException("Required column missing: " + column);
            }

            row[column] = CoerceValue(row.Table.Columns[column], value);
        }

        private static void SetOptional(DataRow row, string column, object value, OptionalFieldTracker optional)
        {
            if (!row.Table.Columns.Contains(column))
            {
                if (optional != null)
                {
                    optional.MarkSkipped(column);
                }

                return;
            }

            row[column] = CoerceValue(row.Table.Columns[column], value);
            if (optional != null)
            {
                optional.MarkPresent(column);
            }
        }

        private static object CoerceValue(DataColumn column, object value)
        {
            if (value == null)
            {
                return DBNull.Value;
            }

            var target = column.DataType;
            if (target == typeof(string))
            {
                return Convert.ToString(value);
            }

            if (target == typeof(bool))
            {
                if (value is bool)
                {
                    return value;
                }

                return Convert.ToInt32(value) != 0;
            }

            if (target.IsEnum)
            {
                return Enum.Parse(target, Convert.ToString(value));
            }

            return Convert.ChangeType(value, target);
        }

        private static void WriteManifest(string outputDir, List<ManifestEntry> entries)
        {
            var builder = new StringBuilder();
            builder.AppendLine("{");
            builder.AppendLine("  \"schemaVersion\": 1,");
            builder.AppendLine("  \"generatedAt\": " + Json(DateTime.UtcNow.ToString("o")) + ",");
            builder.AppendLine("  \"sourceTemplate\": \"Configurator templet project/6002.cpd\",");
            builder.AppendLine("  \"fixtures\": [");

            for (var i = 0; i < entries.Count; i++)
            {
                var entry = entries[i];
                builder.AppendLine("    {");
                builder.AppendLine("      \"fileName\": " + Json(entry.FileName) + ",");
                builder.AppendLine("      \"purpose\": " + Json(entry.Purpose) + ",");
                builder.AppendLine("      \"expected\": " + DictionaryToJson(entry.Expected) + ",");
                builder.AppendLine("      \"optionalFields\": {");
                builder.AppendLine("        \"present\": " + StringArrayToJson(entry.OptionalPresent) + ",");
                builder.AppendLine("        \"skipped\": " + StringArrayToJson(entry.OptionalSkipped));
                builder.AppendLine("      }");
                builder.Append("    }");
                builder.AppendLine(i == entries.Count - 1 ? "" : ",");
            }

            builder.AppendLine("  ]");
            builder.AppendLine("}");

            File.WriteAllText(Path.Combine(outputDir, "manifest.json"), builder.ToString(), new UTF8Encoding(false));
        }

        private static string DictionaryToJson(Dictionary<string, object> value)
        {
            var parts = new List<string>();
            foreach (var kvp in value)
            {
                parts.Add(Json(kvp.Key) + ": " + ValueToJson(kvp.Value));
            }

            return "{ " + string.Join(", ", parts.ToArray()) + " }";
        }

        private static string ValueToJson(object value)
        {
            if (value is string)
            {
                return Json((string)value);
            }

            if (value is bool)
            {
                return (bool)value ? "true" : "false";
            }

            if (value is int)
            {
                return Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture);
            }

            if (value is int[])
            {
                var numbers = Array.ConvertAll((int[])value, item => Convert.ToString(item, System.Globalization.CultureInfo.InvariantCulture));
                return "[" + string.Join(", ", numbers) + "]";
            }

            return Json(Convert.ToString(value));
        }

        private static string StringArrayToJson(IEnumerable<string> values)
        {
            var escaped = new List<string>();
            foreach (var value in values)
            {
                escaped.Add(Json(value));
            }

            return "[" + string.Join(", ", escaped.ToArray()) + "]";
        }

        private static string Json(string value)
        {
            return "\"" + (value ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n") + "\"";
        }
    }

    internal sealed class ParsedArgs
    {
        public string ConfiguratorDir;
        public string OutputDir;
        public bool ListOnly;
    }

    internal sealed class FixtureDefinition
    {
        public FixtureDefinition(string fileName, string purpose, FixtureOptions options)
        {
            FileName = fileName;
            Purpose = purpose;
            Options = options;
        }

        public string FileName { get; private set; }
        public string Purpose { get; private set; }
        public FixtureOptions Options { get; private set; }
    }

    internal sealed class FixtureOptions
    {
        public bool DelayedSounders;
        public int SounderDelaySeconds;
        public int InputOutputDelaySeconds;
        public int FireBrigadeDelaySeconds;
        public bool ManualOverride;
        public bool DisableDevice21;
        public bool InhibitRelays17;
        public bool IoStage;
        public bool OptionalEdgeFields;
        public bool IoOverrideDelayAddress4;
        public bool SetEvacuateTimerAddress4;
    }

    internal sealed class DeviceConfig
    {
        public DeviceConfig(string location, int zone, int sounderGroup)
        {
            Location = location;
            Zone = zone;
            SounderGroup = sounderGroup;
        }

        public string Location { get; private set; }
        public int Zone { get; private set; }
        public int SounderGroup { get; private set; }
    }

    internal sealed class OptionalFieldTracker
    {
        private readonly HashSet<string> present = new HashSet<string>();
        private readonly HashSet<string> skipped = new HashSet<string>();

        public IEnumerable<string> Present { get { return Sorted(present); } }
        public IEnumerable<string> Skipped { get { return Sorted(skipped); } }

        public void MarkPresent(string field)
        {
            present.Add(field);
            skipped.Remove(field);
        }

        public void MarkSkipped(string field)
        {
            if (!present.Contains(field))
            {
                skipped.Add(field);
            }
        }

        private static IEnumerable<string> Sorted(HashSet<string> values)
        {
            var list = new List<string>(values);
            list.Sort(StringComparer.Ordinal);
            return list;
        }
    }

    internal sealed class ManifestEntry
    {
        public string FileName;
        public string Purpose;
        public Dictionary<string, object> Expected;
        public IEnumerable<string> OptionalPresent;
        public IEnumerable<string> OptionalSkipped;
    }
}
