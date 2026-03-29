# 浏览器兼容性说明 - GeoScope Spatial Lab

## 支持的浏览器

### ✅ 完全支持
- **Google Chrome** 90+
- **Microsoft Edge** 90+
- **Mozilla Firefox** 88+
- **Apple Safari** 14+
- **iOS Safari** 14+
- **Android Chrome** 90+

---

## 实现的浏览器兼容特性

### CSS 前缀支持
1. **Backdrop Filter (毛玻璃效果)**
   - `-webkit-backdrop-filter` - Safari/Chrome
   - `backdrop-filter` - 标准

2. **Flexbox 布局**
   - `-webkit-flex` / `-webkit-align-items` / `-webkit-justify-content` - 旧版 WebKit
   - 标准 `flex` 语法 - 现代浏览器

3. **CSS Grid 布局**
   - `-webkit-grid` / `-webkit-grid-template-columns` / `-webkit-grid-gap` - 旧版 WebKit
   - 标准 `grid` 语法 - 现代浏览器

4. **Transform & Transition**
   - `-webkit-transform` - Safari/Chrome
   - `-moz-transform` - Firefox
   - 标准 `transform` - 现代浏览器

5. **User Select**
   - `-webkit-user-select` - WebKit
   - `-moz-user-select` - Firefox
   - 标准 `user-select` - 现代浏览器

6. **Appearance**
   - `-webkit-appearance` - 隐藏 select 默认箭头
   - `-moz-appearance` - Firefox 兼容
   - 标准 `appearance` - 现代浏览器

7. **Font Smoothing**
   - `-webkit-font-smoothing: antialiased` - 文本抗锯齿 (Safari/Chrome)
   - `-moz-osx-font-smoothing: grayscale` - Firefox 抗锯齿

8. **Touch Scrolling**
   - `-webkit-overflow-scrolling: touch` - 平滑触摸滚动 (iOS)

---

## HTML 里增强

### Meta 标签优化
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta http-equiv="X-UA-Compatible" content="ie=edge" />
<meta name="theme-color" content="#3e8b85" />
```

- `viewport-fit=cover` - 支持 iPhone X+ 的刘海屏
- `X-UA-Compatible` - 强制 IE 使用最新引擎
- `theme-color` - 安卓浏览器地址栏颜色

---

## 响应式设计断点

| 断点 | 设备类型 | 布局方式 |
|-----|--------|--------|
| ≤480px | 手机 | 单列堆叠，优化触摸 |
| 481-768px | 小平板/大手机 | 单列，适应屏宽 |
| 769-960px | 平板横屏 | 单列，部分横排 |
| >960px | 桌面/宽屏 | 两列(侧栏+工作区) |

---

## 已知限制

### 不支持的浏览器
- Internet Explorer 11 及以下 ❌
- 旧版 Safari (< 14) 中的某些功能
- 旧版 Firefox (< 88) 中的某些功能

### 降级处理
- 使用标准 CSS 属性作为主要实现
- 浏览器前缀作为兼容性回退
- 网格和 Flex 布局有完整的回退方案

---

## 性能优化

- 使用 CSS 变量 (Custom Properties) 实现主题定制
- 硬件加速的 3D transforms
- 移动端触摸优化 (`-webkit-overflow-scrolling`)
- 字体抗锯齿处理

---

## 测试建议

建议在以下环境中测试：
- [ ] Chrome (最新版)
- [ ] Firefox (最新版)
- [ ] Safari (macOS 最新版)
- [ ] Safari (iOS 14+)
- [ ] Chrome (Android)
- [ ] Edge (Windows)

---

## 更新记录

**版本 1.0** - 2026-03-29
- 添加完整的浏览器前缀支持
- 优化响应式设计
- 增强移动设备兼容性
- 改进 select 元素样式
