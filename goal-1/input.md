你是 Codex，当前任务是正式开始实现 Numens Fire Alarm Simulator。

项目路径：
D:\Users\30741\Desktop\程序开发\报警模拟器\Numens Fire Alarm Simulator

先读取并遵守：
AGENTS.md
docs/superpowers/specs/2026-05-22-numens-fire-alarm-simulator-design.md
docs/superpowers/plans/2026-05-22-numens-fire-alarm-simulator-implementation.md

执行方式：
你作为 manager / final reviewer，不要重新讨论产品需求，不要重新设计架构。按照 implementation plan 从 Task 1 开始推进。使用 SubAgent 驱动开发：SubAgent 负责编码、测试、初检；你负责分派任务、检查结果、做 spec compliance review、code quality review 和最终验收。

重要规则：
- 不要 revert 用户已有改动。
- 不要执行 git reset --hard 或丢弃未确认改动。
- 每个 SubAgent 只分配明确文件范围，避免冲突。
- 每个任务必须有测试或验证命令结果。
- 不允许把旧 Mesh / RSSI / Leader / Router / HTML topology 作为产品功能保留下来。
- `.cpd` 导入只作为配置源；`.fireproj` 是完整项目保存格式。
- 严格按设计文档实现 CIE 模拟逻辑，包括 Fire Alarm、Evacuate、Fault、Fire Brigade、Sounder、I/O、Delay、Inhibit、Disabled、BUZZER SILENCE、SYSTEM RESET。
- 完成每个任务后报告：改动文件、验证命令、结果、风险。
- 进入下一个任务前，必须先审查当前任务是否符合设计文档和实施计划。

现在开始：
1. 读取 AGENTS.md。
2. 读取设计文档和实施计划。
3. 检查 git status。
4. 从实施计划 Task 1 开始，启动 SubAgent 执行。 [$goal-mode](C:\\Users\\30741\\.codex\\skills\\goal-mode\\SKILL.md) 
