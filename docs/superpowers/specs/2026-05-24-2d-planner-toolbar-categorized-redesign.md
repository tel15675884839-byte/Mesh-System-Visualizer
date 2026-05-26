# 2D 配置界面工具栏分类悬浮重构设计说明书 (Spec)

本设计说明书旨在对 2D 图纸配置界面（`Planner2D.vue`）中顶部的操作工具栏进行视觉与交互重构，采用**方案 A：轻量化悬浮分类坞 (Floating Categorized Glass Dock)**，并引入高精细度的矢量 SVG 图标（SVGRepo 风格）替代原先的部分默认 Element Plus 按钮图标，使界面显得更加专业和极具现代感。

---

## 1. 重构方案设计 (方案 A)

### 1.1 布局调整 (Layout)

- **位置悬浮化**：原先的顶部全宽通栏（`.planner-toolbar`）将被改造成一个**悬浮式 Dock 工具坞**，绝对定位在 `canvas-shell` 的顶部水平居中位置 (`position: absolute; top: 15px; left: 50%; transform: translateX(-50%);`)。
- **背景与磨砂**：背景采用高透磨砂玻璃效果 (`background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(15px);`)，外围配以半透明的超细边框（`border: 1px solid rgba(255, 255, 255, 0.4)`），底部带有柔和的投影（`box-shadow`）。

### 1.2 板块分类与标题展示 (Categorization)

我们将工具栏分割为四个独立却连贯的工具组块，每个组块顶部增加极其轻量的小字分类标题（如 `图纸楼层`、`探测防区`、`回路连线`、`视图缩放`），下方排列对应的具体按钮：

1. **图纸与楼层 (Drawing & Floor)**
   - 包含：导入图纸 (Upload)、添加建筑 (Add Building)、删除建筑 (Delete Building)、添加楼层 (Add Floor)、删除楼层 (Delete Floor)。
2. **探测防区 (Zones)**
   - 包含：防区选择下拉框 (`el-select`)、选择工具 (Cursor)、矩形防区工具 (Rectangle)、多边形防区工具 (Polygon)、取消/关闭工具 (Cancel)。
3. **回路连线 (Loops)**
   - 包含：回路选择下拉框 (`el-select`)、回路布线工具 (Wiring)、绘制回路工具 (Draw Loop)、清除/删除回路连线、自动路由工具 (Auto Routing)、已连设备数徽标 (Badge)。
4. **画布视图 (Viewport)**
   - 包含：缩放图标、滑块 (`el-slider`)、当前百分比与缩放比示值。

各板块之间使用半透明的垂直超细线作为物理分割线（`width: 1px; height: 32px; background: rgba(0, 0, 0, 0.08)`）。

### 1.3 高精细矢量图标引入 (SVGRepo Icons)

删除原本 Element Plus 默认的纯色大扁平按钮图标，替换为精心配置的手绘/极简细线风格的 inline SVG 图标（线条粗细 `stroke-width: 2.2px` / `2.5px`），使得视觉精度提升一个级别。

例如：

- **导入/上传**：带有托盘的上指箭头 `upload`。
- **添加建筑**：精美的多层写字楼网格轮廓。
- **添加楼层**：三层菱形图层叠加的 `layers` 结构。
- **删除**：细线构成的垃圾桶图标。
- **选择**：细线尖角鼠标指针。
- **回路连线**：带倾斜弧度的链条链接图标。

---

## 2. 代码变动清单

### 2.1 修改文件

#### [MODIFY] [Planner2D.vue](file:///d:/Users/30741/Desktop/程序开发/报警模拟器/Numens Fire Alarm Simulator/src/renderer/src/components/fire/Planner2D.vue)

- **模板 `<template>`**：
  - 将整个 `<header class="planner-toolbar">` 移动到 `<div class="canvas-shell">` 内部的顶部。
  - 将工具栏中的按钮拆分为带分类容器的网格，结构如下：
    ```html
    <div class="toolbar-section">
      <span class="section-tag">图纸楼层</span>
      <div class="btn-group">
        <!-- 按钮 -->
      </div>
    </div>
    ```
  - 将 Element Plus 的按钮图标（如 `:icon="Upload"` 等）替换为 inline `<svg>` 代码。
- **样式 `<style scoped>`**：
  - 添加 `.planner-toolbar` 悬浮以及磨砂玻璃风格相关样式。
  - 编写 `.section-tag` 顶部小分类字标的定位与排版 CSS（`font-size: 9px`，浅灰色，居中展示）。
  - 为按钮设计微弹动效（`transform: scale`）及呼吸投影效果。
  - 深度定制 Element Plus 的 `el-select` 和 `el-slider` 在悬浮面板内的紧凑布局及无缝结合度。

---

## 3. 验证与测试计划

1. **结构与样式审查**：
   - 确保工具栏能正确悬浮在图纸上方，且不遮挡正常的图纸绘制（可以利用鼠标穿透或留白解决）。
   - 检查所有 inline SVG 图标在不同屏幕分辨率下缩放清晰，无拉伸。
2. **交互完整性确认**：
   - 验证每个按钮点击时绑定的原 Vue 逻辑和状态（如 `activeTool`、`store.activeTool`）工作如初。
   - 确保切换防区和回路下拉菜单时，选择状态同步更新且视图重绘正常。
3. **打包与构建测试**：
   - 运行 `npm run typecheck:web` 以确保无 TypeScript 错误。
   - 运行 `npm run build` 检验生产打包是否顺利。
