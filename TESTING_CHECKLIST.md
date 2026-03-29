# 浏览器兼容性测试清单

## 桌面浏览器测试

### Google Chrome (最新版本)
- [ ] 页面正常加载
- [ ] 毛玻璃效果 (backdrop-filter) 正常显示
- [ ] 响应式布局在 1920x1080 正常
- [ ] Flex/Grid 布局正确
- [ ] Button hover 动画流畅
- [ ] 地图交互正常
- [ ] Select 下拉框显示正确

### Mozilla Firefox (最新版本)
- [ ] 页面正常加载
- [ ] 毛玻璃效果降级正确（Firefox 不支持）
- [ ] 布局仍然正确
- [ ] Button transform 动画也能工作
- [ ] 文本抗锯齿 (`-moz-osx-font-smoothing`) 效果
- [ ] Select 自定义箭头显示

### Microsoft Edge (最新版本)
- [ ] 所有 Chrome 功能都支持
- [ ] 特别检查 Grid 布局
- [ ] Windows 系统字体显示

### Apple Safari (macOS 最新版本)
- [ ] 毛玻璃效果完美显示
- [ ] `-webkit-` 前缀生效
- [ ] 触控板滚动平滑 (`-webkit-overflow-scrolling`)
- [ ] 字体渲染清晰

---

## 移动设备浏览器测试

### iOS Safari (iOS 14+)
- [ ] 竖屏布局 (≤480px)
  - [ ] 侧栏显示正常
  - [ ] 地图高度 45vh 正确
  - [ ] 表格高度 55vh 正确
  - [ ] 按钮尺寸适合触摸
- [ ] 横屏布局 (768px+)
  - [ ] 自动转换为平板布局
  - [ ] 地图 50vh 表格 50vh
- [ ] 刘海屏适配 (`viewport-fit=cover`)
- [ ] 触摸滚动流畅 (`-webkit-overflow-scrolling`)
- [ ] Safari 地址栏主题颜色

### Android Chrome
- [ ] 竖屏布局正常
- [ ] 横屏布局正常
- [ ] 地图缩放和平移流畅
- [ ] 触摸在小屏幕上响应准确
- [ ] 表单输入无缩放问题

### Android Firefox
- [ ] 基本功能正常
- [ ] 布局响应式工作
- [ ] 性能可接受

---

## 响应式布局测试

使用浏览器开发者工具（F12 → 设备模拟）

### 小手机 (375px)
- [ ] iPhone SE
  - 侧栏全宽显示
  - 地图显示正确
  - 所有按钮可点击
  - 文字大小合适

### 普通手机 (414px)
- [ ] iPhone 12/13
  - 按钮响应正确
  - 表单输入体验好
  - 搜索框显示完整

### 大屏手机 (540px)
- [ ] Samsung Galaxy
  - 布局不拥挤
  - 交互空间充足

### 小平板 (768px)
- [ ] iPad Mini
  - 切换为平板布局
  - 侧栏+主体区域分离
  - 地图和表格并排

### 大平板 (1024px)
- [ ] iPad Pro
  - 两列布局正常
  - 字体大小合适
  - 交互不拥挤

### 桌面 (1920x1080)
- [ ] 全屏显示
  - 侧栏宽度 400px
  - 主工作区充分
  - 地图右边有表格

---

## 功能特性测试

### CSS 特性
- [ ] **CSS Grid Layout**
  - 侧栏+主体 grid 布局
  - 响应式列调整
  
- [ ] **Flexbox**
  - 按钮组水平排列
  - 地图搜索框内元素排列
  - Footer 元素对齐

- [ ] **Backdrop Filter**
  - 毛玻璃效果显示（支持的浏览器）
  - 降级到纯色背景（不支持的浏览器）

- [ ] **Transform & Transition**
  - Button hover 动画
  - 过渡效果平滑

- [ ] **Custom Properties (CSS 变量)**
  - 颜色定义正确
  - 主题应用一致

### 表单控件
- [ ] Text Input
  - 焦点状态正确
  - 文本输入流畅
  - 占位符显示

- [ ] Select Dropdown
  - 自定义箭头显示
  - 选项列表可用
  - 跨浏览器一致性

- [ ] Color Picker
  - 颜色选择功能
  - 显示当前颜色

- [ ] File Upload
  - 文件选择对话框
  - 文件名显示

### 地图功能
- [ ] 地图加载
- [ ] 地图缩放
- [ ] 地图平移
- [ ] 搜索功能
- [ ] 图层显示

---

## 性能检查

### Desktop Performance (Chrome DevTools)
- [ ] Lighthouse score > 80
- [ ] First Contentful Paint < 2s
- [ ] Largest Contentful Paint < 3s
- [ ] Cumulative Layout Shift < 0.1
- [ ] 内存占用 < 200MB

### Mobile Performance
- [ ] 首屏加载 < 3s
- [ ] 交互响应 < 100ms
- [ ] 滚动帧率 > 50fps
- [ ] 无明显卡顿

---

## 无障碍 (Accessibility)
- [ ] Tab 导航正确顺序
- [ ] 按钮有 focus 状态
- [ ] 颜色对比度足够
- [ ] 表单标签关联正确
- [ ] 屏幕阅读器可用性

---

## 错误日志检查

打开浏览器控制台 (F12 → Console) 检查：
- [ ] 无 JavaScript 错误
- [ ] 无 CSS 解析错误
- [ ] 无网络错误
- [ ] 无废弃 API 警告

---

## 跨浏览器一致性

| 功能 | Chrome | Firefox | Safari | Edge | Android Chr. |
|-----|--------|---------|--------|------|-------------|
| 布局 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 毛玻璃 | ✓ | ✗ | ✓ | ✓ | ✓ |
| 动画 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Select样式 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 字体 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 触摸 | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 报告模板

如发现问题，请报告：

```
浏览器: [名称] [版本]
操作系统: [系统] [版本]
设备: [手机/平板/桌面] [型号]
分辨率: [宽度]x[高度]

问题描述:
[详细描述问题]

重现步骤:
1. 
2. 
3. 

预期结果:
[应该发生什么]

实际结果:
[实际发生了什么]

截图/视频:
[如可能，附加视觉证据]

控制台错误:
[console 日志]
```

---

**最后更新**: 2026-03-29
