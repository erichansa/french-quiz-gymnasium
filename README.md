# Gymnasium 10e Français Studio (Studio d'Apprentissage & Quiz)

专门为德国/瑞士 **Gymnasium 10年级（初三/高一，6年级起步二外，对应 Découvertes 5 / 欧标 B1 水平）** 定制开发的法语多功能学习与测评系统。

---

## 🌟 核心功能模块

1. **🎯 语法专项与闯关测验（Grammaire & Quiz）**
   * 覆盖 10 年级核心语法高频考点：
     * **Le Subjonctif Présent**（触发词、规则与不规则变位、*bien que* 专项）
     * **Conditionnel & Si-Sätze**（假设句 Typ 1, 2, 3 及委婉语气）
     * **Les pronoms `y` et `en` & 双宾语代词**（代词顺序与替换）
     * **Les pronoms relatifs composés**（*lequel, laquelle, auquel, duquel*）
     * **Passé composé vs Imparfait & Plus-que-parfait**
   * 即时判分反馈，附带**德语（Gymnasium 标准术语）与中文双语深度解析**及考点记忆卡（💡 Merkhilfe）。

2. **📚 核心词汇、词族与动词搭配（Vocabulaire & SRS）**
   * **Collocations 搭配库**：拒绝孤立记词，成串记忆高级动词短语（如 *prendre une décision, être responsable de, réduire son empreinte écologique*）。
   * **词族派生（Famille de mots）**：动词 ➔ 名词 ➔ 形容词规律串联。
   * **原生法语真人级发音（🔊）**：集成浏览器 Web Speech API，一键朗读任意单词与例句。
   * **艾宾浩斯间隔复习算法（SRS）**：针对生词标记“Nochmal / Schwer / Gut / Leicht”，系统自动推算下一次复习时间。

3. **⏱️ 45分钟仿真模考（Klassenarbeit Simulation）**
   * 仿真 Gymnasium 考试标准试卷结构：
     * **Partie I : Compréhension de l'écrit**（长篇阅读理解与细节判断题）
     * **Partie II : Grammaire & Vocabulaire**（语境填空与句型转换）
     * **Partie III : Expression écrite**（论述题与写作规范）
   * 倒计时提醒与自动提交，生成多维度得分分析报告。

4. **✍️ AI 写作工坊（Atelier d'Écriture）**
   * 解决高中生写作瓶颈：
     * **可点击逻辑连接词库（Connecteurs logiques）**：一键插入 *À mon avis, Bien que, En outre, Cependant, Non seulement... mais aussi*。
     * **PEE 写作法则提醒**：Point（论点） ➔ Explanation（解释） ➔ Example（例证）。
     * **AI 评阅与句式升维**：像阅卷老师一样给出 15 分制评分、标出语法时态错误，并给出 **B1+/B2 级高分句式改写建议**。

5. **📖 智能错题本（Carnet d'Erreurs）**
   * 练习中做错的题目自动入库，支持“一键专项重练”，直到掌握后自动移出。

6. **⚡ 讲义/课件一键转题库（Notizen ➔ Quiz）**
   * 可将学校老师发的课件、PDF文字或课堂笔记直接粘贴进来，AI 自动提炼考点生成新的选择题并持久化保存。

---

## 🚀 启动与使用方式

### 方式一：双击启动（最简单）
直接双击运行项目根目录下的 **`start_quiz.bat`**：
* 自动启动本地服务器
* 自动在默认浏览器中打开 `http://localhost:8765`

### 方式二：命令行启动
打开终端进入该目录执行：
```powershell
python server.py
```
随后在浏览器访问：`http://localhost:8765`

---

## ⚙️ AI 功能配置（可选）

* 本程序完全**支持纯离线运行**：所有内置的 10 年级语法题库、词汇卡、试卷及启发式写作分析均无需联网即可秒开运行。
* 若需开启 **实时 AI 作文深度批改** 及 **课件笔记自动出题**：
  1. 打开网页右上角 **「Einstellungen / 设置」** 页面；
  2. 填入你的 Google Gemini API Key（支持免费个人 Key）；
  3. 点击保存即可。

---

## 📂 项目代码与数据结构（严格遵循解耦规范）

```text
C:\Dokumente\Tools\Frech-Quiz\
├── data/                             # 所有数据均隔离为独立 JSON，无大内存驻留
│   ├── config.json                   # 系统与 API 配置
│   ├── vocabulary_decouvertes.json   # 10年级单元核心词汇与搭配
│   ├── grammar_exercises.json        # 语法分类题库与双语解析
│   ├── exam_simulations.json         # 45分钟标准 Klassenarbeit 试卷
│   ├── writing_templates.json        # 写作连接词库与升级模板
│   ├── user_progress.json            # 学习进度、错题本与 SRS 算法卡片
│   └── user_custom_quizzes.json      # 课件笔记自动生成的题库
├── modules/
│   ├── api_client.py                 # 网络与 AI 请求模块（含离线启发式降级）
│   ├── processor.py                  # 纯计算处理：SRS复习算法、文本分析与统计
│   └── quiz_manager.py               # 数据读写、错题本调度与测验编排
├── static/
│   ├── css/style.css                 # 现代化响应式界面样式
│   └── js/app.js                     # 前端交互、发音合成与答题调度
├── templates/
│   └── index.html                    # 单页应用（SPA）主界面
├── server.py                         # 调度层 HTTP 主服务
├── start_quiz.bat                    # Windows 桌面一键启动脚本
└── README.md                         # 项目使用说明
```
