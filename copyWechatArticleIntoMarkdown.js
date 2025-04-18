// ==UserScript==
// @name         微信公众号文章转Markdown (增强版)
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  一键复制微信公众号文章为Markdown格式，增强代码块处理和语言检测
// @author       木偶 (增强版)
// @match        https://mp.weixin.qq.com/s/*
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      cdn.jsdelivr.net
// @run-at       document-end
// ==/UserScript==

// 每次脚本重新加载时，都在控制台打印时间戳，确认最新版本已被加载。
console.log('脚本已加载:', new Date().toLocaleTimeString())

// 更可靠地加载highlight.js用于语言检测
function loadHighlightJS() {
  return new Promise((resolve, reject) => {
    // 先检查是否已经加载
    if (window.hljs) {
      console.log('highlight.js 已加载')
      return resolve(window.hljs)
    }

    // 先通过CDN加载highlight.js核心库
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/lib/core.min.js'
    script.onload = () => {
      console.log('highlight.js 核心库加载成功')

      // 增加更完整的编程语言支持
      const commonLanguages = [
        'javascript',
        'typescript',
        'jsx',
        'tsx',
        'python',
        'java',
        'go',
        'cpp',
        'c',
        'csharp',
        'php',
        'ruby',
        'swift',
        'kotlin',
        'rust',
        'bash',
        'shell',
        'powershell',
        'sql',
        'html',
        'css',
        'scss',
        'less',
        'xml',
        'json',
        'yaml',
        'markdown',
        'dart',
        'objectivec',
        'scala',
        'perl',
      ]

      // 创建一个计数器来跟踪加载进度
      let loadedCount = 0
      commonLanguages.forEach(lang => {
        const langScript = document.createElement('script')
        langScript.src = `https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/lib/languages/${lang}.min.js`
        langScript.onload = () => {
          loadedCount++
          if (loadedCount === commonLanguages.length) {
            console.log('highlight.js 语言包加载完成')
            // 确保语言注册成功
            if (window.hljs) {
              try {
                // 注册所有加载的语言
                commonLanguages.forEach(l => {
                  if (window.hljs.getLanguage(l)) {
                    console.log(`语言 ${l} 已注册`)
                  }
                })
              } catch (e) {
                console.warn('注册语言时出错:', e)
              }
            }
            resolve(window.hljs)
          }
        }
        langScript.onerror = err => {
          console.warn(`加载语言 ${lang} 失败:`, err)
          loadedCount++
          if (loadedCount === commonLanguages.length) {
            console.log('highlight.js 语言包部分加载完成')
            resolve(window.hljs)
          }
        }
        document.head.appendChild(langScript)
      })
    }
    script.onerror = err => {
      console.error('加载 highlight.js 失败:', err)
      reject(err)
    }
    document.head.appendChild(script)
  })
}

// 主流程代码
;(function () {
  'use strict'
  let hljs = null

  // 提取文章内容
  function extractContent() {
    const title = document.querySelector('#activity-name')?.innerText.trim() || '未找到标题'
    const author = document.querySelector('#js_name')?.innerText.trim() || '未找到作者'
    const content = document.querySelector('#js_content')
    if (!content) return ''

    // 构建Markdown格式的文章
    let markdown = `# ${title}\n\n`
    markdown += `作者: ${author}\n\n`
    markdown += `---\n\n`

    // 将HTML内容转换为Markdown格式
    markdown += htmlToMarkdown(content)
    return markdown
  }

  // 改进的代码语言检测
  function detectCodeLanguage(code) {
    // 如果代码太短，可能不好检测
    if (code.length < 10) return ''

    if (hljs) {
      try {
        // 使用highlight.js自动检测语言
        const result = hljs.highlightAuto(code, null)
        // 只有当置信度较高时才返回检测到的语言
        if (result && result.language && result.relevance > 5) {
          console.log(`检测到语言: ${result.language}, 相关度: ${result.relevance}`)
          return result.language
        }
      } catch (err) {
        console.warn('语言检测失败:', err)
      }
    }

    // 备用检测逻辑 - 通过关键字和语法特征检测
    // JavaScript
    if (
      /\b(const|let|var|function|=>|class|import|export|document\.|window\.)\b/.test(code) ||
      /\$\(.*\)\..*\(/.test(code) || // jQuery
      /console\.log\(/.test(code) ||
      code.includes('addEventListener(')
    ) {
      return 'javascript'
    }

    // TypeScript
    if (
      /\b(interface|namespace|implements|private|protected|readonly|as\s+\w+)\b/.test(code) ||
      /:\s*(string|number|boolean|any|void|never)\b/.test(code)
    ) {
      return 'typescript'
    }

    // Python
    if (
      /\bdef\s+\w+\s*\(.*\):|import\s+\w+|from\s+\w+\s+import|if\s+__name__\s*==\s*('|")__main__('|")/.test(code) ||
      /print\s*\(.+\)/.test(code)
    ) {
      return 'python'
    }

    // Java
    if (
      /public\s+(static\s+)?(void|class|interface)|private|protected|@Override/.test(code) ||
      /import\s+java\./.test(code) ||
      /System\.out\.print(ln)?\(/.test(code)
    ) {
      return 'java'
    }

    // Go
    if (/func\s+\w+\s*\(.*\)\s*(\w+\s*)?\{|package\s+\w+|import\s+\(|go\s+func/.test(code)) {
      return 'go'
    }

    // C/C++
    if (/\b(include\s*<|using\s+namespace|#define|int\s+main\s*\(|std::)/.test(code)) {
      return code.includes('cout') || code.includes('cin') || code.includes('vector<') ? 'cpp' : 'c'
    }

    // C#
    if (/\b(using\s+System|namespace\s+\w+|public\s+class|private\s+void)/.test(code)) {
      return 'csharp'
    }

    // HTML
    if (/<(!DOCTYPE|html|head|body|div|span|a|img|script|link|meta)\b/.test(code) || /<\/\w+>/.test(code)) {
      return 'html'
    }

    // CSS
    if (/[\w-]+\s*:\s*[^{};]+;/.test(code) && /\{[\s\S]*?\}/.test(code)) {
      return 'css'
    }

    // SQL
    if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|GROUP BY|ORDER BY|HAVING)\b/i.test(code)) {
      return 'sql'
    }

    // Shell/Bash
    if (/\$\s*\w+|#!/.test(code) || /\b(echo|grep|awk|sed|find|chmod|mkdir|ls|cd)\b/.test(code)) {
      return 'bash'
    }

    // 默认值
    return ''
  }

  // 检查元素是否为引用块
  function isQuoteBlock(element) {
    // 检查通用的引用块特征
    const style = window.getComputedStyle(element)
    const backgroundColor = style.backgroundColor.toLowerCase()
    const borderLeft = style.borderLeft.toLowerCase()
    const padding = style.padding

    // 微信引用块通常有特定的样式特征
    const hasQuoteStyle =
      (backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') ||
      borderLeft.includes('solid') ||
      element.classList.contains('blockquote_info') ||
      element.classList.contains('js_blockquote_wrap') ||
      element.querySelector('.blockquote_info') !== null ||
      element.tagName.toLowerCase() === 'blockquote'

    // 如果元素有引用样式且不是很大的元素（避免误判整个文章容器）
    return hasQuoteStyle && element.textContent.trim().length < 2000
  }

  // 改进的代码块检测函数
  function isCodeBlock(element) {
    // 首先检查是否是大容器（可能不是代码块）
    if (element.clientHeight > 500 && element.clientWidth > 500) {
      // 大容器可能不是代码块
      return false
    }

    // 检查是否是主内容容器
    if (element.id === 'js_content' || element.classList.contains('rich_media_content')) {
      return false
    }

    // 检查常见的代码块标识符
    if (
      element.tagName.toLowerCase() === 'pre' ||
      element.classList.contains('code-snippet') ||
      element.classList.contains('code_snippet') ||
      element.classList.contains('highlight') ||
      element.classList.contains('prism') ||
      element.querySelector('code') !== null
    ) {
      return true
    }

    // 检查代码块的样式特征
    const style = window.getComputedStyle(element)
    const fontFamily = style.fontFamily.toLowerCase()
    const backgroundColor = style.backgroundColor.toLowerCase()

    // 代码字体检测
    const isCodeFont =
      fontFamily.includes('monospace') ||
      fontFamily.includes('courier') ||
      fontFamily.includes('consolas') ||
      fontFamily.includes('menlo') ||
      fontFamily.includes('monaco') ||
      fontFamily.includes('source code') ||
      fontFamily.includes('fira code') ||
      fontFamily.includes('jetbrains')

    // 背景颜色检查 - 许多代码块有特殊的背景
    const hasDistinctBackground =
      backgroundColor !== 'rgba(0, 0, 0, 0)' &&
      backgroundColor !== 'transparent' &&
      backgroundColor !== 'rgb(255, 255, 255)' && // 白色
      backgroundColor !== '#ffffff'

    // 检查代码属性
    const hasCodeAttributes =
      element.getAttribute('data-lang') !== null ||
      element.classList.contains('language-') ||
      Array.from(element.classList).some(cls => cls.startsWith('language-'))

    // 内容检查 - 代码块通常有特定的字符
    const textContent = element.textContent.trim()
    const hasCodeSyntax = /[{};()=><\[\]]/g.test(textContent)
    const isReasonableCodeSize = textContent.length > 0 && textContent.length < 5000

    // 综合判断代码块特征
    return (
      (isCodeFont && (hasDistinctBackground || hasCodeAttributes || hasCodeSyntax)) ||
      (hasDistinctBackground && isReasonableCodeSize && hasCodeSyntax) ||
      hasCodeAttributes ||
      (element.parentElement && element.parentElement.tagName.toLowerCase() === 'pre')
    )
  }

  // 处理代码块
  function processCodeBlock(element) {
    // 提取代码内容，保留格式
    let codeText = element.innerText.trim()

    // 如果是空的代码块，返回空字符串
    if (!codeText) return ''

    // 检测语言 - 增强版
    const language = detectCodeLanguage(codeText)

    // 构建Markdown代码块
    return `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`
  }

  // HTML转Markdown的实现
  function htmlToMarkdown(contentElement) {
    let markdown = ''
    // 创建一个Set来跟踪已处理的元素
    const processedElements = new Set()

    // 递归处理所有子元素
    function processElement(element, depth = 0) {
      if (processedElements.has(element)) return ''
      processedElements.add(element)

      // 跳过隐藏元素
      if (element.offsetParent === null && element.tagName.toLowerCase() !== 'img') return ''

      let result = ''

      // 跳过处理主内容容器作为特殊块
      if (element.id === 'js_content' || element.classList.contains('rich_media_content')) {
        // 直接处理子元素，无需特殊处理
        for (const child of element.children) {
          result += processElement(child, depth + 1)
        }
        return result
      }

      // 检查是否为代码块
      if (isCodeBlock(element)) {
        return processCodeBlock(element)
      }

      // 检查是否为引用块
      if (isQuoteBlock(element) && depth <= 1) {
        // 引用块内容处理
        const quoteContent = element.textContent.trim()
        if (quoteContent) {
          const lines = quoteContent.split('\n')
          for (const line of lines) {
            if (line.trim()) {
              result += `> ${line.trim()}\n`
            }
          }
          result += '\n'
        }
        return result
      }

      // 根据元素类型进行转换
      switch (element.tagName.toLowerCase()) {
        case 'h1':
          result += `# ${element.textContent.trim()}\n\n`
          break
        case 'h2':
          result += `## ${element.textContent.trim()}\n\n`
          break
        case 'h3':
          result += `### ${element.textContent.trim()}\n\n`
          break
        case 'h4':
          result += `#### ${element.textContent.trim()}\n\n`
          break
        case 'h5':
          result += `##### ${element.textContent.trim()}\n\n`
          break
        case 'h6':
          result += `###### ${element.textContent.trim()}\n\n`
          break
        case 'p':
          if (element.textContent.trim()) {
            result += `${element.textContent.trim()}\n\n`
          }
          break
        case 'blockquote':
          const quoteText = element.textContent.trim()
          if (quoteText) {
            const lines = quoteText.split('\n')
            for (const line of lines) {
              if (line.trim()) {
                result += `> ${line.trim()}\n`
              }
            }
            result += '\n'
          }
          break
        case 'ul':
          // 处理列表项
          const items = element.querySelectorAll('li')
          for (const item of items) {
            processedElements.add(item)
            result += `- ${item.textContent.trim()}\n`
          }
          result += '\n'
          break
        case 'ol':
          // 处理有序列表
          const orderedItems = element.querySelectorAll('li')
          let i = 1
          for (const item of orderedItems) {
            processedElements.add(item)
            result += `${i}. ${item.textContent.trim()}\n`
            i++
          }
          result += '\n'
          break
        case 'li':
          // 单独的li元素（不在ul/ol中）
          if (
            !element.parentElement ||
            (element.parentElement.tagName.toLowerCase() !== 'ul' &&
              element.parentElement.tagName.toLowerCase() !== 'ol')
          ) {
            result += `- ${element.textContent.trim()}\n\n`
          }
          break
        case 'img':
          const src = element.getAttribute('data-src') || element.src
          const alt = element.getAttribute('alt') || '图片'
          if (src) {
            result += `![${alt}](${src})\n\n`
          }
          break
        case 'pre':
          // 直接使用代码块处理
          return processCodeBlock(element)
        case 'code':
          // 如果不是pre的子元素，当作行内代码处理
          if (element.parentElement && element.parentElement.tagName.toLowerCase() !== 'pre') {
            result += `\`${element.textContent.trim()}\``
          } else {
            // 已在pre中处理
            return ''
          }
          break
        case 'a':
          const href = element.getAttribute('href')
          if (href) {
            result += `[${element.textContent.trim()}](${href})`
          } else {
            result += element.textContent.trim()
          }
          break
        case 'strong':
        case 'b':
          result += `**${element.textContent.trim()}**`
          break
        case 'em':
        case 'i':
          result += `*${element.textContent.trim()}*`
          break
        case 'br':
          result += '\n'
          break
        case 'div':
        case 'section':
          // 递归处理子元素
          let hasProcessedChildren = false
          const childElements = element.children
          for (const child of childElements) {
            const childResult = processElement(child, depth + 1)
            if (childResult) {
              result += childResult
              hasProcessedChildren = true
            }
          }

          // 如果没有处理任何子元素，且元素有文本内容，按段落处理
          if (!hasProcessedChildren && element.textContent.trim()) {
            // 检查是否只有纯文本，没有特殊格式的内联元素
            const hasFormattingElement = Array.from(element.children).some(child =>
              ['strong', 'b', 'em', 'i', 'a', 'code'].includes(child.tagName.toLowerCase())
            )

            if (!hasFormattingElement) {
              result += `${element.textContent.trim()}\n\n`
            }
          }
          break
        default:
          // 对于其他元素，如果有文本内容但没有子元素，则直接输出文本
          if (element.textContent.trim() && element.children.length === 0) {
            result += `${element.textContent.trim()}\n\n`
          } else {
            // 递归处理子元素
            for (const child of element.children) {
              result += processElement(child, depth + 1)
            }
          }
      }

      return result
    }

    // 开始处理内容元素
    markdown = processElement(contentElement)

    // 清理连续的空行
    markdown = markdown.replace(/\n{3,}/g, '\n\n')

    return markdown
  }

  // 复制到剪切板
  function copyToClipboard(content) {
    try {
      GM_setClipboard(content, 'text')
      showNotification('已复制Markdown内容到剪切板！')
    } catch (error) {
      console.error('复制到剪切板失败:', error)
      showNotification('复制失败: ' + error.message, true)
    }
  }

  // 显示通知
  function showNotification(message, isError = false) {
    const notification = document.createElement('div')
    notification.textContent = message
    notification.style.position = 'fixed'
    notification.style.top = '20px'
    notification.style.left = '50%'
    notification.style.transform = 'translateX(-50%)'
    notification.style.padding = '10px 20px'
    notification.style.backgroundColor = isError ? '#ff4d4f' : '#52c41a'
    notification.style.color = 'white'
    notification.style.borderRadius = '4px'
    notification.style.zIndex = '10000'
    notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
    document.body.appendChild(notification)

    // 3秒后消失
    setTimeout(() => {
      notification.style.opacity = '0'
      notification.style.transition = 'opacity 0.5s'
      setTimeout(() => {
        document.body.removeChild(notification)
      }, 500)
    }, 3000)
  }

  // 主函数：复制文章为Markdown
  async function copyArticleAsMarkdown() {
    try {
      // 显示加载中状态
      const loadingBtn = document.querySelector('#wechat-to-md-btn')
      if (loadingBtn) {
        const originalText = loadingBtn.textContent
        loadingBtn.textContent = '处理中...'
        loadingBtn.disabled = true

        // 尝试加载highlight.js（如果未加载）
        if (!hljs) {
          try {
            hljs = await loadHighlightJS()
            console.log('highlight.js 加载状态:', !!hljs)
          } catch (error) {
            console.warn('加载highlight.js失败，将使用备选方案进行语言检测', error)
          }
        }

        const markdown = extractContent()
        if (markdown) {
          copyToClipboard(markdown)
        } else {
          showNotification('未能提取文章内容！', true)
        }

        // 恢复按钮状态
        loadingBtn.textContent = originalText
        loadingBtn.disabled = false
      } else {
        // 尝试加载highlight.js（如果未加载）
        if (!hljs) {
          try {
            hljs = await loadHighlightJS()
            console.log('highlight.js 加载状态:', !!hljs)
          } catch (error) {
            console.warn('加载highlight.js失败，将使用备选方案进行语言检测', error)
          }
        }

        const markdown = extractContent()
        if (markdown) {
          copyToClipboard(markdown)
        } else {
          showNotification('未能提取文章内容！', true)
        }
      }
    } catch (error) {
      console.error('处理文章内容失败:', error)
      showNotification('处理失败: ' + error.message, true)

      // 恢复按钮状态（如果有按钮）
      const loadingBtn = document.querySelector('#wechat-to-md-btn')
      if (loadingBtn) {
        loadingBtn.textContent = '复制为Markdown'
        loadingBtn.disabled = false
      }
    }
  }

  // 添加样式
  function addStyles() {
    GM_addStyle(`
      #wechat-to-md-btn {
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 9999;
        padding: 8px 12px;
        background-color: #07C160;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        font-size: 14px;
        transition: all 0.3s;
      }
      
      #wechat-to-md-btn:hover {
        background-color: #06AD56;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      
      #wechat-to-md-btn:active {
        transform: scale(0.98);
      }
      
      #wechat-to-md-btn:disabled {
        background-color: #CCCCCC;
        cursor: not-allowed;
      }
    `)
  }

  // 添加浮动按钮
  function addFloatingButton() {
    const button = document.createElement('button')
    button.id = 'wechat-to-md-btn'
    button.textContent = '复制为Markdown'
    button.onclick = copyArticleAsMarkdown
    document.body.appendChild(button)

    // 添加按钮提示
    button.title = '将当前公众号文章转换为Markdown格式并复制到剪贴板'
  }

  // 初始化
  function init() {
    // 添加样式
    addStyles()

    // 注册菜单命令
    GM_registerMenuCommand('复制为Markdown', copyArticleAsMarkdown)

    // 添加浮动按钮
    setTimeout(addFloatingButton, 1000)

    // 尝试预加载highlight.js
    loadHighlightJS()
      .then(loadedHljs => {
        hljs = loadedHljs
        console.log('highlight.js 预加载成功')
      })
      .catch(err => {
        console.warn('highlight.js 预加载失败:', err)
      })
  }

  // 初始化脚本
  init()
})()
