# 🎨 AI Image Tool with Flux Kontext Integration

一个强大的AI图像编辑工具，集成了Flux Kontext API，提供专业级的图像处理和编辑功能。

## ✨ 主要功能

- 🖼️ **智能图像上传** - 支持拖拽上传，多种格式
- 🎯 **AI图像编辑** - 使用Flux Kontext进行精准编辑
- 🎨 **自定义提示词** - 用自然语言描述想要的修改
- ⚡ **快速操作** - 预设的常用编辑选项
- 📱 **响应式设计** - 完美适配各种设备
- 🔄 **实时进度** - 处理状态实时反馈

## 🚀 快速开始

### 1. 环境准备

确保你的系统已安装：
- Node.js (版本 16.0.0 或更高)
- npm 或 yarn

### 2. 安装依赖

```bash
# 克隆项目或下载文件
npm install

# 或使用 yarn
yarn install
```

### 3. 配置环境变量

1. 复制环境配置示例：
```bash
cp env-config-example.txt .env
```

2. 编辑 `.env` 文件，添加你的API密钥：

**推荐使用 Together AI（性能最佳）：**
```env
FLUX_PROVIDER=together
TOGETHER_API_KEY=your_together_api_key_here
```

**或者使用其他提供商：**
```env
# 使用 Replicate
FLUX_PROVIDER=replicate
REPLICATE_API_TOKEN=your_replicate_token_here

# 使用 Fal.ai
FLUX_PROVIDER=fal
FAL_KEY=your_fal_ai_key_here
```

### 4. 设置目录结构

```bash
mkdir public uploads
cp ai_image_tool_website.html public/index.html
```

### 5. 启动服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务器将在 `http://localhost:3000` 启动

## 🔑 API密钥获取

### Together AI（推荐）
1. 访问 [Together AI](https://api.together.xyz/settings/api-keys)
2. 注册账户并获取API密钥
3. 优势：速度快、价格合理、稳定性好

### Replicate
1. 访问 [Replicate](https://replicate.com/account/api-tokens)
2. 注册账户并获取API令牌
3. 优势：支持多种模型、社区活跃

### Fal.ai
1. 访问 [Fal.ai Dashboard](https://fal.ai/dashboard)
2. 注册账户并获取API密钥
3. 优势：JavaScript支持良好、队列系统完善

## 🛠️ API端点说明

### 图像上传
```
POST /api/upload-image
Content-Type: multipart/form-data

Body: 
- image: 图像文件
```

### Flux Kontext处理
```
POST /api/flux-kontext
Content-Type: application/json

Body: {
  "image_url": "图像URL",
  "prompt": "编辑指令",
  "guidance_scale": 3.5,
  "aspect_ratio": "1:1"
}
```

### 任务状态查询
```
GET /api/job-status/{jobId}
```

## 💡 使用示例

### 基础编辑
```javascript
// 背景移除
"Remove the background and make it transparent"

// 风格转换
"Transform this into a watercolor painting style"

// 颜色增强
"Enhance the colors and make the image more vibrant"
```

### 高级编辑
```javascript
// 对象替换
"Change the red car to a blue sports car"

// 背景更换
"Replace the background with a sunset beach scene"

// 人物修改
"Make the person wear a professional business suit"
```

## 🎛️ 参数说明

- **guidance_scale**: 控制AI对提示词的遵循程度
  - 2.5: 更有创意
  - 3.5: 平衡（推荐）
  - 5.0: 更精确
  - 7.0: 非常精确

- **aspect_ratio**: 输出图像比例
  - "1:1": 正方形
  - "4:3": 标准
  - "16:9": 宽屏
  - "9:16": 竖屏

## 📁 项目结构

```
├── flux-kontext-api-server.js  # 主服务器文件
├── package.json                # 依赖配置
├── env-config-example.txt      # 环境变量示例
├── ai_image_tool_website.html  # 前端界面
├── public/                     # 静态文件目录
│   └── index.html             # 主页面
├── uploads/                    # 上传文件目录
└── README.md                   # 说明文档
```

## 🔒 安全考虑

### 生产环境建议：
1. 使用HTTPS
2. 添加API密钥验证
3. 实现请求速率限制
4. 使用Redis存储任务状态
5. 添加文件类型和大小验证
6. 实现用户身份验证

### 示例安全配置：
```javascript
// 添加到服务器代码
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 100个请求
  message: '请求过于频繁，请稍后再试'
});

app.use('/api/', limiter);
```

## 🚨 故障排除

### 常见问题：

1. **API密钥错误**
   - 检查环境变量是否正确设置
   - 确认API密钥有效期和权限

2. **文件上传失败**
   - 检查文件大小是否超过限制
   - 确认uploads目录权限

3. **处理超时**
   - 增加超时时间设置
   - 检查网络连接

4. **依赖安装失败**
   ```bash
   # 清理缓存重新安装
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

## 📈 性能优化

1. **缓存策略**：为重复请求实现缓存
2. **CDN集成**：使用CDN加速图像传输
3. **队列管理**：实现任务队列避免并发过载
4. **图像压缩**：优化上传图像大小

## 🤝 贡献

欢迎提交Pull Request或Issue来改进这个项目！

## 📄 许可证

MIT License

## 🆘 支持

如需帮助，请：
1. 查看本README文档
2. 检查环境配置
3. 查看服务器日志
4. 提交Issue描述问题

---

**⚡ 现在就开始使用Flux Kontext创造令人惊艳的AI图像吧！** 