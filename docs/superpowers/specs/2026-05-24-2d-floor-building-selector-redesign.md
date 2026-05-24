# 2D 配置界面楼层与建筑选择器重构设计说明书 (Spec)

本说明书拟定对现有的 2D 配置界面（`TwoDView.vue`）中用于选择“建筑”与“楼层”的点击下拉菜单进行重构，改用直观平铺的列表选择器，并结合方案 C（右侧电梯按键面板）和方式 3（超多楼层自动双/多列网格自适应排布）进行升级。

---

## 1. 目标与背景

当前 2D 配置界面通过顶部的两个 Element Plus 下拉框选择建筑和楼层：
```html
<el-select v-model="currentBuildingId" placeholder="Building" ...>
<el-select v-model="currentFloorId" placeholder="Floor" ...>
```
这种方式需要用户执行两次“点击下拉 -> 寻找选项 -> 选中”的操作，效率较低，也缺乏直观的空间立体层次感。

本重构方案将：
* 去除顶部工具栏中的这两个下拉框；
* 在界面右侧（或地图上方合适位置）引入一个轻量级的、磨砂玻璃质感的**电梯控制面板悬浮组件**；
* 直接平铺展示所有可用楼层与建筑列表，用户只需一次点击即可切换楼层或建筑；
* 引入高楼层自适应网格排布机制（方式 3），保证在楼层极多（如 > 8 层）时，界面紧凑且美观。

---

## 2. 交互与视觉设计

### 2.1 组件结构

重构后的选择器划分为两个主要区块：

1. **顶部建筑切换器 (Building Switcher)**
   * 当项目有且仅有 1 个建筑时：默认不展示建筑选择栏，以最大程度精简界面。
   * 当有多个建筑时：展示为一个小型的横向分段按钮（Segmented Tabs），点击按钮即可切换建筑。

2. **主体楼层按键堆栈 (Elevator Floor Column)**
   * 展示为类似于电梯控制面板的垂直队列。
   * 楼层展示顺序符合建筑直觉：**高层在上，低层在下**（即 $N\text{F} \rightarrow 1\text{F} \rightarrow \text{B}1$ 从上到下排列）。
   * 选中的楼层高亮显示为 iOS 风格蓝色（`#0071e3`）圆形/圆角按键。

### 2.2 超多楼层自适应网格机制 (方式 3)

为了防止楼层过多导致垂直面板溢出屏幕：
* **阀值设定**：以 $8$ 层为分界线。
* **单列圆形模式（$\le 8$ 层）**：展示为单列圆形的电梯按钮（直径约 $28\text{px}$ - $32\text{px}$），上下排列，间距适中。
* **双列网格模式（$> 8$ 层）**：
  * 面板横向展宽，楼层列表自动折叠为两列（甚至多列）网格排布。
  * 按钮外观由圆形（`border-radius: 50%`）平滑过渡到圆角矩形（`border-radius: 6px`），字号及内边距微调，使整体高度保持在安全范围内，同时保持单次点击即可直达的高效体验。

---

## 3. 代码变动与技术选型

### 3.1 修改文件

#### [MODIFY] [TwoDView.vue](file:///d:/Users/30741/Desktop/程序开发/报警模拟器/Numens Fire Alarm Simulator/src/renderer/src/components/TwoDView.vue)
* **模板 `<template>`**：
  * 删除顶部的 `v-model="currentBuildingId"` 和 `v-model="currentFloorId"` 对应的 `<el-select>` 标签。
  * 在视图右侧或合适位置新增一个名为 `<div class="floor-navigator-panel">` 的浮动面板。
* **样式 `<style>`**：
  * 新增 `.floor-navigator-panel`、`.building-selector`、`.floor-grid` 等 iOS 磨砂玻璃风格 CSS 样式。
  * 实现基于 CSS Grid/Flexbox 的自适应双列布局，以及圆形到圆角矩形的过渡。
  * 编写在超多楼层时的 CSS 媒体查询或动态 class 绑定。

---

## 4. 关键实现逻辑

### 4.1 自动网格排布的 class 绑定

在 Vue 模板中，我们通过计算属性动态检测当前建筑的楼层数：
```typescript
const isMultiColumn = computed(() => {
  return availableFloors.value.length > 8
})
```

在模板中根据 `isMultiColumn` 动态渲染面板的类名，从而应用不同的布局样式：
```html
<div :class="['floor-buttons-container', { 'grid-layout': isMultiColumn }]">
  <button 
    v-for="floor in sortedFloors" 
    :key="floor.id" 
    :class="['floor-btn', { 'active': currentFloorId === floor.id, 'rect-btn': isMultiColumn }]"
    @click="currentFloorId = floor.id"
  >
    {{ getFloorAbbr(floor.name) }}
  </button>
</div>
```

### 4.2 楼层按顺序重新排列

因为数组里的楼层顺序可能不符合“物理空间高度”，所以我们需要将楼层进行物理层级上的倒序重排。例如，假设 `availableFloors` 是按照地下到地上或者配置顺序存储的，我们需要把它们根据名字或配置逻辑，让高楼层排在最上方：
```typescript
const sortedFloors = computed(() => {
  // 复制一份并进行排序，确保高层（如 4F, 3F）在数组头部（视觉顶部）
  // 排序算法：提取楼层名称中的数字进行逆序排列，地下楼层（B1, B2）值设为负数并排在最底部
  return [...availableFloors.value].sort((a, b) => {
    return getFloorWeight(b.name) - getFloorWeight(a.name)
  })
})
```

### 4.3 楼层缩略名转换

楼层显示字数不宜过多，需要转换为极简文本（如“主楼二层” $\rightarrow$ “2F” 或 “2层”，以最大程度节省按键空间）：
```typescript
const getFloorAbbr = (name: string): string => {
  // 正则匹配提取数字和字母
  // 如 "Floor 1" -> "1F", "2层" -> "2F", "Basement 1" -> "B1"
  // 若无法匹配，则截取前三个字符
  ...
}
```

---

## 5. 验证与测试计划

1. **功能完整性验证**：
   * 确保点击面板上的楼层按钮能正常响应，触发 2D 图纸的切换与重绘。
   * 确保切换建筑按钮能更新对应的楼层列表。
   * 确保初始化及树级定位逻辑（`store.focusRequest`）切换楼层时，右侧面板的高亮状态能同步更新。

2. **自适应样式验证**：
   * 创建一个包含 3 层楼层的建筑，验证面板为“单列圆形”样式。
   * 创建一个包含 12 层楼层的建筑，验证面板是否自动转换为“双列网格且为圆角矩形”样式，且高度正常，没有发生溢出或文字截断。

3. **视觉一致性审核**：
   * 确保面板背景色、半透明磨砂玻璃滤镜（`backdrop-filter`）、阴影和高亮色与 2D 配置界面现有的 iOS 风格无缝衔接。
